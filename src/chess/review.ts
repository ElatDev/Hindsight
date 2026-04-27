/**
 * Phase 11 orchestration: take a played game, run the analysis pipeline end
 * to end (engine eval → classification → motif detection → opening lookup),
 * then for each ply pick a template via `TemplateSelector` and render it via
 * `TemplateRegistry`. The result is a per-ply record the Review UI can show
 * directly.
 *
 * The module is decoupled from React and from the IPC layer: the engine call
 * is injectable, the RNG is injectable, and the only side effect is the
 * engine analyze (driven by `analyzeGame`). Tests live in
 * `__tests__/review.test.ts`.
 */

import type { Color, Move, PieceSymbol, Square } from 'chess.js';
import { gameAccuracy, type GameAccuracy } from './accuracy';
import { analyzeGame, type AnalyzeFn, type MoveAnalysis } from './analysis';
import {
  classifyAnalyses,
  isFlaggedClassification,
  type Classification,
  type ClassifiedMove,
} from './classify';
import { criticalMoments, type CriticalMoment } from './critical';
import { Game } from './game';
import { findHangingPieces } from './motifs/hanging';
import { findForks } from './motifs/fork';
import { findPins } from './motifs/pin';
import { findSkewers } from './motifs/skewer';
import { findBackRankWeaknesses } from './motifs/backRank';
import { findDoubleAttacks } from './motifs/doubleAttack';
import { findOverloadedPieces } from './motifs/overloaded';
import { PIECE_VALUE } from './motifs/util';
import { identifyOpening, type EcoEntry } from './openings';
import { detectGamePhase, type GamePhase } from './positional/gamePhase';
import { TemplateRegistry } from './templates/registry';
import {
  TemplateSelector,
  type MotifTag,
  type Rng,
} from './templates/selector';
import type { RenderContext } from './templates/dsl';
import { loadLibrary } from './templates/library';

export type EvalSnapshot = {
  /** Centipawn score from white's POV. Null when mate-scored. */
  readonly cp: number | null;
  /** Mate distance from white's POV. Positive = white mates in N. */
  readonly mate: number | null;
};

/** One engine-suggested alternative line at the pre-move position, resolved
 *  to SAN. Mover-POV evals (positive = good for the side that was to move). */
export type ReviewedAlternative = {
  /** UCI of the alternative's first move. */
  readonly uci: string;
  /** SAN of the first move, resolved at the pre-move FEN. */
  readonly san: string;
  /** Mover-POV centipawn score; null when this line resolves to mate. */
  readonly evalCp: number | null;
  /** Mover-POV mate distance (positive = mover delivers mate in N). */
  readonly mateIn: number | null;
};

export type ReviewedMove = {
  readonly ply: number;
  readonly san: string;
  /** Destination square of the played move. Surfaced so the UI can pin grade
   *  badges to the right square without re-parsing SAN. */
  readonly toSquare: Square;
  readonly classification: Classification;
  readonly cpLoss: number | null;
  /** Eval white-POV facing the move (i.e. snapshot of the position the mover
   *  saw). */
  readonly evalBefore: EvalSnapshot;
  /** Eval white-POV after the move was played. */
  readonly evalAfter: EvalSnapshot;
  readonly bestUci: string | null;
  readonly bestSan: string | null;
  readonly motifs: readonly MotifTag[];
  readonly phase: GamePhase;
  /** Selected template id, or null when nothing matched. */
  readonly templateId: string | null;
  /** Rendered explanation. Empty string when no template matched. */
  readonly explanation: string;
  /** Top engine alternatives at the pre-move position, with the played
   *  move filtered out and SAN resolved. Empty when the move wasn't
   *  flagged or no second-pass analysis ran. */
  readonly alternatives: readonly ReviewedAlternative[];
};

/** Counts of each classification grouped by side. Every classification key
 *  is always present (zero when none) so the UI never needs optional-chaining
 *  while rendering rows. */
export type ClassificationCounts = Record<Classification, number>;

export type GameSummary = {
  readonly accuracy: GameAccuracy;
  readonly counts: {
    readonly white: ClassificationCounts;
    readonly black: ClassificationCounts;
  };
  readonly criticalMoments: readonly CriticalMoment[];
};

export type GameReview = {
  readonly perMove: readonly ReviewedMove[];
  readonly opening: EcoEntry | null;
  readonly summary: GameSummary;
};

export type RunGameReviewOptions = {
  /** Search depth for both pre- and post-move analyses. Default 12 — chosen
   *  for review responsiveness over peak strength. */
  readonly depth?: number;
  /** Engine call to use. Defaults to `window.hindsight.engine.analyze`. */
  readonly analyze?: AnalyzeFn;
  /** Bail out early; in-flight call still finishes. */
  readonly signal?: AbortSignal;
  /** Per-ply progress callback. Called once per analysis pair, immediately
   *  after `analyzeGame` reports. */
  readonly onProgress?: (done: number, total: number) => void;
  /** Source of randomness for template selection variety. Defaults to
   *  `Math.random`; tests inject a deterministic rng. */
  readonly rng?: Rng;
  /** Skip surfacing multi-PV alternatives for flagged moves. Defaults to
   *  false — alternatives are pulled from the first-pass `multiPV=3` lines
   *  so they cost nothing extra. Tests set true to keep the per-ply lines
   *  field predictable. */
  readonly skipAlternatives?: boolean;
  /** First-pass multi-PV requested from the engine. Default 3 so flagged
   *  moves carry alternative lines without a second engine pass; lower
   *  values (1) trade alternatives for slightly faster searches. */
  readonly multiPV?: number;
};

const PIECE_NAME: Record<PieceSymbol, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const COLOR_NAME: Record<Color, string> = {
  w: 'white',
  b: 'black',
};

/**
 * Detect static motifs in the position *after* `moveSan` is played from
 * `before`, from the mover's perspective: motifs we surface are ones that
 * the mover *suffered* (their own pieces hanging, opponent forking them,
 * etc.). That matches how the explanation library writes templates ("{san}
 * leaves the {hangingPiece} hanging") — the motif fingerprint is on the
 * mover's side.
 *
 * Discovered attack/check is harder to detect statically (requires looking
 * at the opponent's prospective replies); v1 leaves them out. The relevant
 * templates simply won't fire — selector specificity falls back to the
 * generic-classification pool.
 */
export function detectMoveMotifs(
  before: Game,
  moveSan: string,
): { motifs: MotifTag[]; data: MotifData } {
  const replay = Game.fromFen(before.fen());
  const move = replay.move(moveSan);
  if (!move) return { motifs: [], data: {} };

  const mover = move.color;
  const opponent: Color = mover === 'w' ? 'b' : 'w';
  const tags: MotifTag[] = [];
  const data: MotifData = {};
  // True when the played move itself delivered check (chess.js appends `+`
  // or `#` to the SAN). The check-resolved status governs the back-rank
  // motif — its templates ("the rook delivers mate on the back rank")
  // imply an immediate exploitation that the opponent can't perform while
  // they're forced to address a check. Other static motifs (fork, pin,
  // skewer, hanging) describe geometric patterns that hold regardless of
  // whose turn it is and stay informative even alongside a check.
  const moverGaveCheck = /[+#]$/.test(move.san);

  const hanging = findHangingPieces(replay).filter((p) => p.color === mover);
  if (hanging.length > 0) {
    const worst = hanging.reduce((a, b) =>
      PIECE_VALUE[a.type] >= PIECE_VALUE[b.type] ? a : b,
    );
    tags.push('hanging');
    data.hangingPiece = PIECE_NAME[worst.type];
    data.hangingSquare = worst.square;
  }

  const forks = findForks(replay).filter((f) => f.forker.color === opponent);
  if (forks.length > 0) {
    const f = forks[0];
    tags.push('fork');
    data.forkTargets = f.targets.map((t) => PIECE_NAME[t.type]);
    data.attackerPiece = PIECE_NAME[f.forker.type];
  }

  const pins = findPins(replay).filter((p) => p.pinner.color === opponent);
  if (pins.length > 0) {
    const p = pins[0];
    tags.push('pin');
    data.pinnedPiece = PIECE_NAME[p.pinned.type];
    data.pinTo = PIECE_NAME[p.behind.type];
  }

  const skewers = findSkewers(replay).filter(
    (s) => s.skewerer.color === opponent,
  );
  if (skewers.length > 0) {
    const s = skewers[0];
    tags.push('skewer');
    data.skeweredPiece = PIECE_NAME[s.front.type];
    data.skeweredBy = PIECE_NAME[s.skewerer.type];
  }

  const backRank = findBackRankWeaknesses(replay).filter(
    (w) => w.king.color === mover,
  );
  if (backRank.length > 0 && !moverGaveCheck) {
    tags.push('backRank');
    data.backRankPiece = 'rook';
  }

  const doubleAttacks = findDoubleAttacks(replay).filter(
    (d) => d.attacker.color === opponent,
  );
  if (doubleAttacks.length > 0 && !tags.includes('fork')) {
    // A fork is itself a double attack; only surface the broader tag when no
    // fork was reported, so the more-specific motif data wins.
    const d = doubleAttacks[0];
    tags.push('doubleAttack');
    data.attackerPiece ??= PIECE_NAME[d.attacker.type];
  }

  const overloaded = findOverloadedPieces(replay).filter(
    (o) => o.defender.color === mover,
  );
  if (overloaded.length > 0) {
    const o = overloaded[0];
    tags.push('overloaded');
    const first = o.defending[0];
    data.defendedPiece = PIECE_NAME[first.type];
    data.defendedSquare = first.square;
  }

  return { motifs: tags, data };
}

/**
 * Scratch type holding optional motif-data fields. Promoted to context vars
 * by `buildRenderContext`. Kept loose because not every motif populates every
 * field.
 */
export type MotifData = {
  forkTargets?: readonly string[];
  attackerPiece?: string;
  pinnedPiece?: string;
  pinTo?: string;
  skeweredPiece?: string;
  skeweredBy?: string;
  hangingPiece?: string;
  hangingSquare?: Square;
  backRankPiece?: string;
  defendedPiece?: string;
  defendedSquare?: Square;
};

/**
 * Convert an engine-best UCI move into the SAN + piece info the templates
 * want. Returns null when the UCI is illegal at `fenBefore` (shouldn't
 * happen in practice — Stockfish is reliable here — but let's not crash).
 */
export function uciToMoveInfo(
  fenBefore: string,
  uci: string,
): { san: string; piece: PieceSymbol; to: Square } | null {
  const g = Game.fromFen(fenBefore);
  const from = uci.slice(0, 2);
  const to = uci.slice(2, 4);
  const promotion =
    uci.length >= 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
  const move = g.move({ from, to, promotion });
  if (!move) return null;
  return { san: move.san, piece: move.piece, to: move.to };
}

/**
 * Format an eval-snapshot pair as the human-readable string templates use.
 * Mate scores come out as `Mn` / `M-n`; cp scores as a signed pawn fraction
 * (`+0.65`, `-1.20`); missing eval renders as `?`.
 */
export function formatEval(snap: EvalSnapshot): string {
  if (snap.mate != null) {
    return snap.mate >= 0 ? `M${snap.mate}` : `M-${Math.abs(snap.mate)}`;
  }
  if (snap.cp != null) {
    const pawns = snap.cp / 100;
    const sign = pawns > 0 ? '+' : '';
    return `${sign}${pawns.toFixed(2)}`;
  }
  return '?';
}

/**
 * Convert a MoveAnalysis (mover-POV evals) into white-POV `EvalSnapshot`s.
 * The convention is shared with the eval bar so the review UI doesn't have
 * to flip signs again.
 */
export function snapshotsFromAnalysis(record: MoveAnalysis): {
  evalBefore: EvalSnapshot;
  evalAfter: EvalSnapshot;
} {
  // mover at ply N (1-based) = white when N is odd.
  const moverIsWhite = record.ply % 2 === 1;
  const flip = moverIsWhite ? 1 : -1;
  return {
    evalBefore: {
      cp: record.evalCp != null ? record.evalCp * flip : null,
      mate: record.mateIn != null ? record.mateIn * flip : null,
    },
    evalAfter: {
      cp: record.evalCpAfter != null ? record.evalCpAfter * flip : null,
      mate: record.mateInAfter != null ? record.mateInAfter * flip : null,
    },
  };
}

/**
 * Build the `RenderContext` for one ply. Always populates every variable the
 * library references — the DSL throws on missing keys, so leaving any out
 * would break templates that happen to reference them.
 */
export function buildRenderContext(args: {
  played: Move;
  classified: ClassifiedMove;
  beforeGame: Game;
  motifs: MotifData;
  phase: GamePhase;
  bestSan: string | null;
  bestPiece: PieceSymbol | null;
  bestTo: Square | null;
  evalBefore: EvalSnapshot;
  evalAfter: EvalSnapshot;
  opening: EcoEntry | null;
}): RenderContext {
  const { played, classified, motifs, bestSan, bestPiece, bestTo } = args;
  const moverColor = played.color;

  const isCapture = played.flags.includes('c') || played.flags.includes('e');
  // `inCheck()` after the move tells us whether the mover gave check.
  const replay = Game.fromFen(args.beforeGame.fen());
  replay.move(played.san);
  const isCheck = replay.inCheck();

  const wasMating = classified.mateIn != null && classified.mateIn > 0;
  const nowBeingMated =
    classified.mateInAfter != null && classified.mateInAfter < 0;

  return {
    // identity
    mover: COLOR_NAME[moverColor],
    opponent: COLOR_NAME[moverColor === 'w' ? 'b' : 'w'],
    san: played.san,
    piece: PIECE_NAME[played.piece],
    from: played.from,
    to: played.to,
    captured: played.captured ? PIECE_NAME[played.captured] : null,
    // flags
    isCapture,
    isCheck,
    // eval
    cpLoss: classified.cpLoss,
    evalBefore: formatEval(args.evalBefore),
    evalAfter: formatEval(args.evalAfter),
    bestSan,
    bestPiece: bestPiece ? PIECE_NAME[bestPiece] : null,
    bestTo,
    // phase
    phase: args.phase,
    // mate
    wasMating,
    nowBeingMated,
    mateIn: classified.mateIn,
    mateInAfter: classified.mateInAfter,
    // motif data
    forkTargets: motifs.forkTargets ?? null,
    pinnedPiece: motifs.pinnedPiece ?? null,
    pinTo: motifs.pinTo ?? null,
    skeweredPiece: motifs.skeweredPiece ?? null,
    skeweredBy: motifs.skeweredBy ?? null,
    hangingPiece: motifs.hangingPiece ?? null,
    hangingSquare: motifs.hangingSquare ?? null,
    attackerPiece: motifs.attackerPiece ?? null,
    defendedPiece: motifs.defendedPiece ?? null,
    defendedSquare: motifs.defendedSquare ?? null,
    backRankPiece: motifs.backRankPiece ?? null,
    threatSan: null,
    attackedSquare: null,
    // opening
    opening: args.opening?.name ?? null,
    ecoCode: args.opening?.eco ?? null,
  };
}

/**
 * Run the full review pipeline. Engine-bound — call once per game. Returns
 * a per-ply array plus the identified opening (if any).
 *
 * The function is sequential by design: `analyzeGame` already runs one
 * engine call at a time, and template selection / motif detection are cheap
 * so doing them in the same loop keeps memory pressure minimal.
 */
export async function runGameReview(
  game: Game,
  opts: RunGameReviewOptions = {},
): Promise<GameReview> {
  const depth = opts.depth ?? 12;
  const verbose = game.historyVerbose();
  const total = verbose.length;

  if (total === 0) {
    return emptyReview();
  }

  // Phase 12 / Task 6 perf win: ask the first pass for `multiPV` lines so
  // flagged moves get alternatives "for free" — no separate engine call.
  // Skipping alternatives drops back to MultiPV=1 to keep the search
  // narrowly focused (cheaper for tests, marginally faster in production).
  const wantAlternatives = !opts.skipAlternatives;
  const multiPV = wantAlternatives ? (opts.multiPV ?? 3) : 1;
  const analyses: MoveAnalysis[] = await analyzeGame(game, {
    depth,
    multiPV,
    analyze: opts.analyze,
    signal: opts.signal,
    onProgress: (done, totalPlies) => opts.onProgress?.(done, totalPlies),
  });

  const baseClassifications = classifyAnalyses(analyses);
  const classifications = wantAlternatives
    ? attachAlternativesFromFirstPass(baseClassifications)
    : baseClassifications;
  const opening = identifyOpening(game.history());
  const registry = new TemplateRegistry();
  const selector = new TemplateSelector();
  loadLibrary(registry, selector);

  const perMove: ReviewedMove[] = [];
  for (let i = 0; i < classifications.length; i += 1) {
    const classified = classifications[i];
    const played = verbose[i];
    const before = Game.fromFen(classified.fenBefore);
    const phase = detectGamePhase(before);
    const motifs = detectMoveMotifs(before, classified.san);
    const bestInfo = classified.bestMove
      ? uciToMoveInfo(classified.fenBefore, classified.bestMove)
      : null;
    const { evalBefore, evalAfter } = snapshotsFromAnalysis(classified);

    const ctx = buildRenderContext({
      played,
      classified,
      beforeGame: before,
      motifs: motifs.data,
      phase,
      bestSan: bestInfo?.san ?? null,
      bestPiece: bestInfo?.piece ?? null,
      bestTo: bestInfo?.to ?? null,
      evalBefore,
      evalAfter,
      opening,
    });

    const templateId = selector.pick(
      {
        classification: classified.classification,
        motifs: motifs.motifs,
        phase,
      },
      opts.rng,
    );
    const explanation = templateId ? registry.render(templateId, ctx) : '';

    const alternatives = resolveAlternatives(classified);

    perMove.push({
      ply: classified.ply,
      san: classified.san,
      toSquare: played.to,
      classification: classified.classification,
      cpLoss: classified.cpLoss,
      evalBefore,
      evalAfter,
      bestUci: classified.bestMove,
      bestSan: bestInfo?.san ?? null,
      motifs: motifs.motifs,
      phase,
      templateId,
      explanation,
      alternatives,
    });
  }

  const summary: GameSummary = {
    accuracy: gameAccuracy(classifications),
    counts: countClassifications(classifications),
    criticalMoments: criticalMoments(classifications, { topN: 5 }),
  };

  return { perMove, opening, summary };
}

const ZERO_COUNTS = (): ClassificationCounts => ({
  sharp: 0,
  best: 0,
  excellent: 0,
  good: 0,
  inaccuracy: 0,
  mistake: 0,
  blunder: 0,
  miss: 0,
  book: 0,
});

/**
 * Tally classifications per side. Side is taken from the FEN's STM at the
 * pre-move position so review of games started from a non-standard position
 * still attributes correctly.
 */
export function countClassifications(records: readonly ClassifiedMove[]): {
  readonly white: ClassificationCounts;
  readonly black: ClassificationCounts;
} {
  const white = ZERO_COUNTS();
  const black = ZERO_COUNTS();
  for (const rec of records) {
    const stm = rec.fenBefore.split(' ')[1] === 'b' ? 'b' : 'w';
    const bucket = stm === 'w' ? white : black;
    bucket[rec.classification] += 1;
  }
  return { white, black };
}

/** Zero-state review used by the UI when there are no moves to analyze. */
export function emptyReview(): GameReview {
  return { perMove: [], opening: null, summary: emptySummary() };
}

/**
 * Lift the multi-PV first-pass output (`linesBefore`, when present) onto
 * each flagged classification's `alternatives` field. Unflagged moves are
 * passed through untouched — no point cluttering Best/Excellent records
 * with "engine also liked..." noise. Phase 12 / Task 6 perf win: this
 * replaces the dedicated second engine pass that previously ran per
 * flagged move.
 */
export function attachAlternativesFromFirstPass(
  records: ClassifiedMove[],
): ClassifiedMove[] {
  return records.map((rec) => {
    if (!isFlaggedClassification(rec.classification)) return rec;
    if (!rec.linesBefore || rec.linesBefore.length === 0) return rec;
    return { ...rec, alternatives: rec.linesBefore };
  });
}

/**
 * Resolve a `ClassifiedMove`'s raw multi-PV `alternatives` (UCI lines from
 * the engine) into the SAN-resolved tuples the UI consumes. The played UCI
 * is filtered out so the panel doesn't echo "Alternative: e4" when the
 * player already played e4. Returns an empty array when no alternatives
 * are present (unflagged moves, or `skipAlternatives` was set).
 */
export function resolveAlternatives(
  classified: ClassifiedMove,
): readonly ReviewedAlternative[] {
  if (!isFlaggedClassification(classified.classification)) return [];
  const lines = classified.alternatives;
  if (!lines || lines.length === 0) return [];
  const out: ReviewedAlternative[] = [];
  for (const line of lines) {
    const uci = line.pv[0];
    if (!uci) continue;
    if (uci === classified.uciPlayed) continue;
    const info = uciToMoveInfo(classified.fenBefore, uci);
    if (!info) continue;
    out.push({
      uci,
      san: info.san,
      evalCp: line.evalCp,
      mateIn: line.mateIn,
    });
  }
  return out;
}

function emptySummary(): GameSummary {
  return {
    accuracy: {
      white: { perMove: [], overall: 0 },
      black: { perMove: [], overall: 0 },
    },
    counts: { white: ZERO_COUNTS(), black: ZERO_COUNTS() },
    criticalMoments: [],
  };
}
