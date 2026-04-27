import type { AnalysisResult, AnalyzeRequest } from '../../shared/ipc';
import { Game } from './game';

/**
 * Per-position analysis record. One entry is produced for every ply that was
 * actually played in the source game, capturing the engine's read on the
 * position the player faced at that moment.
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
  /** Centipawn score from the side-to-move POV; null when this is mate. */
  evalCp: number | null;
  /** Mate distance from the side-to-move POV; null when score is cp. */
  mateIn: number | null;
  /** Engine's preferred move (UCI) from `fenBefore`, or null if no legal moves. */
  bestMove: string | null;
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

  for (let i = 0; i < total; i += 1) {
    if (opts.signal?.aborted) break;
    const fenBefore = replay.fen();
    const move = verbose[i];
    const result = await analyze({ fen: fenBefore, depth: opts.depth });
    const top = result.lines[0];
    const record: MoveAnalysis = {
      ply: i + 1,
      san: move.san,
      uciPlayed: moveToUci(move),
      fenBefore,
      evalCp: top?.evalCp ?? null,
      mateIn: top?.mateIn ?? null,
      bestMove: result.bestMove,
    };
    results.push(record);
    replay.move(move.san);
    opts.onProgress?.(i + 1, total, record);
  }

  return results;
}
