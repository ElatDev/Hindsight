import type {
  AnalysisLine,
  AnalysisResult,
  AnalyzeRequest,
} from '../../shared/ipc';
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
  /** Full multi-PV result for the pre-move analysis, sorted by `multipv`.
   *  Only populated when the caller passes `multiPV > 1`; lets downstream
   *  consumers (review pipeline) source alternatives without a second
   *  engine pass. */
  linesBefore?: AnalysisLine[];
};

export type AnalyzeFn = (req: AnalyzeRequest) => Promise<AnalysisResult>;

export type AnalyzeGameOptions = {
  /** Search depth per position. */
  depth: number;
  /**
   * Analysis IPC. Defaults to `window.hindsight.engine.analyze`. Injectable so
   * tests can drive the orchestrator without spinning up Stockfish.
   */
  analyze?: AnalyzeFn;
  /** Called after each ply's pre-move analysis finishes. */
  onProgress?: (done: number, total: number) => void;
  /** Set to true from the caller to abort early. In-flight analyses still
   *  finish (we can't cancel an IPC dispatch that's already on the wire),
   *  but no further plies are dispatched and the result array short-circuits
   *  to whatever the user already has. */
  signal?: AbortSignal;
  /** When true (default), every ply gets an "after" eval as well. We share
   *  it with the next ply's "before" — same FEN, one engine call covers
   *  both — so this isn't twice the cost. Set to false to drop the trailing
   *  position's analysis when only pre-move evals are needed. */
  analyzeAfter?: boolean;
  /** Number of principal variations to request from each pre-move analysis.
   *  Defaults to 1. When > 1 the full `lines` array surfaces on
   *  `linesBefore`, so the review pipeline can populate flagged-move
   *  alternatives without a separate second pass. */
  multiPV?: number;
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
 * Walk a game and ask the engine to evaluate every position the mover faced.
 *
 * **Concurrency**: every analysis is dispatched up front via `Promise.all`,
 * so the main-process engine pool can fan them out across its parallel
 * Stockfish processes. With a 4-process pool, a 60-move game's review
 * runs ~4× faster than the previous single-engine sequential loop.
 *
 * **Dedup**: ply N's "after" position equals ply N+1's "before" position,
 * so we analyse each unique FEN exactly once — `total + 1` analyses cover
 * `total * 2` evals (or `total` when `analyzeAfter` is false). The trailing
 * post-final-move analysis is skipped when the game ended at the last
 * move (no eval to extract from a checkmate / stalemate position).
 */
export async function analyzeGame(
  game: Game,
  opts: AnalyzeGameOptions,
): Promise<MoveAnalysis[]> {
  const verbose = game.historyVerbose();
  const total = verbose.length;
  if (total === 0) return [];

  const analyze = opts.analyze ?? defaultAnalyze;
  const wantAfter = opts.analyzeAfter ?? true;
  const multiPV = opts.multiPV ?? 1;

  // Boundary FENs: fens[0] = starting position, fens[i] = position before
  // move i (i ≥ 1), fens[total] = final position. gameOverAt[i] flags
  // terminal positions so we skip eval calls that wouldn't return anything
  // useful (Stockfish on a mated/stalemated position reports `bestmove (none)`
  // and gives us no eval to consume).
  const replay = new Game();
  const fens: string[] = [replay.fen()];
  const gameOverAt: boolean[] = [replay.isGameOver()];
  for (let i = 0; i < total; i += 1) {
    replay.move(verbose[i].san);
    fens.push(replay.fen());
    gameOverAt.push(replay.isGameOver());
  }

  // Aborts from the caller (e.g. the user leaves the review screen) short-
  // circuit before any IPC fires — once a request is on the wire we can't
  // recall it.
  if (opts.signal?.aborted) return [];

  const buildRequest = (
    fen: string,
    includeMulti: boolean,
  ): AnalyzeRequest => ({
    fen,
    depth: opts.depth,
    ...(includeMulti && multiPV > 1 ? { multiPV } : {}),
  });

  let progressDone = 0;
  const reportProgress = (): void => {
    progressDone += 1;
    opts.onProgress?.(progressDone, total);
  };

  // Pre-move analyses: one per ply, all dispatched up front so the engine
  // pool gets to fan them out. Progress fires per-promise as they land.
  const beforePromises: Promise<AnalysisResult>[] = Array.from(
    { length: total },
    (_, i) =>
      analyze(buildRequest(fens[i], true)).then((r) => {
        reportProgress();
        return r;
      }),
  );

  // Post-final analysis: only needed when the user wants `evalAfter` for
  // the last move *and* the final position isn't terminal. Skipped
  // otherwise so we don't waste an engine call on a dead position.
  const finalPromise: Promise<AnalysisResult> | null =
    wantAfter && !gameOverAt[total]
      ? analyze(buildRequest(fens[total], false))
      : null;

  const beforeResults = await Promise.all(beforePromises);
  const finalResult = finalPromise ? await finalPromise : null;

  if (opts.signal?.aborted) return [];

  const results: MoveAnalysis[] = [];
  for (let i = 0; i < total; i += 1) {
    const beforeTop = beforeResults[i].lines[0];
    let evalCpAfter: number | null = null;
    let mateInAfter: number | null = null;
    if (wantAfter && !gameOverAt[i + 1]) {
      // After-eval at fens[i+1] is the next ply's pre-move analysis,
      // except for the last move which uses the standalone finalResult.
      const afterRes = i + 1 < total ? beforeResults[i + 1] : finalResult;
      const afterTop = afterRes?.lines[0];
      // Engine eval is reported from the side-to-move's POV. After our
      // move the opponent is to move, so flip the sign to recover the
      // original mover's POV.
      evalCpAfter = afterTop?.evalCp != null ? -afterTop.evalCp : null;
      mateInAfter = afterTop?.mateIn != null ? -afterTop.mateIn : null;
    }

    results.push({
      ply: i + 1,
      san: verbose[i].san,
      uciPlayed: moveToUci(verbose[i]),
      fenBefore: fens[i],
      evalCp: beforeTop?.evalCp ?? null,
      mateIn: beforeTop?.mateIn ?? null,
      bestMove: beforeResults[i].bestMove,
      evalCpAfter,
      mateInAfter,
      ...(multiPV > 1 ? { linesBefore: beforeResults[i].lines } : {}),
    });
  }

  return results;
}
