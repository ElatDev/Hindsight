import type { AnalysisResult, AnalyzeRequest } from '../../shared/ipc';
import { Game } from './game';

/**
 * Per-position analysis record. One entry is produced for every ply that was
 * actually played in the source game, capturing the engine's read on the
 * position the player faced at that moment **and** the position they left
 * behind. All eval fields are normalised to the moving player's POV (i.e. the
 * `*After` fields are sign-flipped from the engine's raw output, since after
 * the move the opponent is to move and the engine reports from the new STM's
 * perspective).
 */
export type MoveAnalysis = {
  /** 1-based ply index (1 = white's first move, 2 = black's first reply). */
  ply: number;
  /** SAN of the move actually played at this ply. */
  san: string;
  /** UCI of the move actually played (e.g. "e2e4", "e7e8q"). */
  uciPlayed: string;
  /** FEN of the position the player faced *before* making this move. */
  fenBefore: string;
  /** Centipawn score before the move, from the moving player's POV. null when
   *  the position was mate-scored. */
  evalCp: number | null;
  /** Mate distance before the move, from the moving player's POV. */
  mateIn: number | null;
  /** Engine's preferred move (UCI) from `fenBefore`, or null if no legal moves. */
  bestMove: string | null;
  /** Centipawn score after the move, normalised to the *moving player's* POV
   *  (i.e. positive = good for them). null when the resulting position was
   *  mate-scored, or when the move ended the game. */
  evalCpAfter: number | null;
  /** Mate distance after the move, from the *moving player's* POV (positive
   *  = they're delivering mate, negative = they're getting mated). null when
   *  the resulting position was cp-scored, or when the move ended the game. */
  mateInAfter: number | null;
};

export type AnalyzeFn = (req: AnalyzeRequest) => Promise<AnalysisResult>;

export type AnalyzeGameOptions = {
  /** Search depth per position. Phase 6 first-pass default is 16. */
  depth: number;
  /**
   * Analysis IPC. Defaults to `window.hindsight.engine.analyze`. Injectable so
   * tests can drive the orchestrator without spinning up Stockfish.
   */
  analyze?: AnalyzeFn;
  /** Called after each ply with the just-completed analysis. */
  onProgress?: (done: number, total: number, last: MoveAnalysis) => void;
  /** Set to true from the caller to abort early; the in-flight analysis
   *  finishes but no further plies are dispatched. */
  signal?: AbortSignal;
  /** When true (default), each ply gets a second engine call against the
   *  resulting position so consumers can compute centipawn loss. Set to false
   *  to halve the engine load when only the pre-move eval is needed. */
  analyzeAfter?: boolean;
};

const moveToUci = (move: {
  from: string;
  to: string;
  promotion?: string;
}): string =>
  move.promotion
    ? `${move.from}${move.to}${move.promotion}`
    : `${move.from}${move.to}`;

const defaultAnalyze: AnalyzeFn = (req) => window.hindsight.engine.analyze(req);

/**
 * Walk a game move-by-move and ask the engine to evaluate every position the
 * mover faced. Returns one `MoveAnalysis` per ply. Sequential by design so the
 * single Stockfish process isn't asked to interleave searches.
 */
export async function analyzeGame(
  game: Game,
  opts: AnalyzeGameOptions,
): Promise<MoveAnalysis[]> {
  const verbose = game.historyVerbose();
  const total = verbose.length;
  const results: MoveAnalysis[] = [];
  const replay = new Game();
  const analyze = opts.analyze ?? defaultAnalyze;
  const wantAfter = opts.analyzeAfter ?? true;

  for (let i = 0; i < total; i += 1) {
    if (opts.signal?.aborted) break;
    const fenBefore = replay.fen();
    const move = verbose[i];
    const before = await analyze({ fen: fenBefore, depth: opts.depth });
    const beforeTop = before.lines[0];
    replay.move(move.san);

    let evalCpAfter: number | null = null;
    let mateInAfter: number | null = null;
    if (wantAfter && !replay.isGameOver()) {
      const after = await analyze({ fen: replay.fen(), depth: opts.depth });
      const afterTop = after.lines[0];
      // Engine eval is reported from the side-to-move's POV. After our move
      // the opponent is to move, so flip the sign back to the original
      // mover's POV.
      evalCpAfter = afterTop?.evalCp != null ? -afterTop.evalCp : null;
      mateInAfter = afterTop?.mateIn != null ? -afterTop.mateIn : null;
    }

    const record: MoveAnalysis = {
      ply: i + 1,
      san: move.san,
      uciPlayed: moveToUci(move),
      fenBefore,
      evalCp: beforeTop?.evalCp ?? null,
      mateIn: beforeTop?.mateIn ?? null,
      bestMove: before.bestMove,
      evalCpAfter,
      mateInAfter,
    };
    results.push(record);
    opts.onProgress?.(i + 1, total, record);
  }

  return results;
}
