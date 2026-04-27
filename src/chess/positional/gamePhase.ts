import type { Game } from '../game';
import { listPieces } from '../motifs/util';

export const GamePhase = {
  Opening: 'opening',
  Middlegame: 'middlegame',
  Endgame: 'endgame',
} as const;
export type GamePhase = (typeof GamePhase)[keyof typeof GamePhase];

/**
 * Standard "phase score" derived from non-pawn-non-king material on the
 * board. Each side starts with 2N + 2B + 2R + Q = 2·1 + 2·1 + 2·2 + 4 = 10
 * units (using the stockfish-style weights below). Two sides → max 20.
 */
const PIECE_PHASE_WEIGHT: Record<'n' | 'b' | 'r' | 'q', number> = {
  n: 1,
  b: 1,
  r: 2,
  q: 4,
};

/** Sum of weights when both armies have full non-pawn material. */
export const MAX_PHASE_SCORE = 2 * (2 * 1 + 2 * 1 + 2 * 2 + 4);

/**
 * Threshold below which the position counts as endgame: ≤ a queen-and-minor
 * worth of material on the board total. Tuned to the textbook intuition
 * "queens off + a couple of minor pieces gone is endgame territory".
 */
const ENDGAME_PHASE_CUTOFF = 6;

/**
 * Threshold below which the position counts as middlegame (above is still
 * opening). Approximates "everyone has castled and most pieces are still on
 * the board, but development is mostly complete".
 */
const MIDDLEGAME_PHASE_CUTOFF = MAX_PHASE_SCORE - 2;

/** Move count below which we treat the game as opening regardless of
 *  remaining material — heavy early trades shouldn't immediately flip the
 *  classification. */
const OPENING_MIN_PLIES = 16;

/**
 * Classify the game phase using two heuristics together:
 *   1. Remaining non-pawn material (the "phase score" used by Stockfish-style
 *      tapered eval). High = lots of pieces still on the board.
 *   2. Plies played. Brand-new positions stay in "opening" even if they've
 *      seen a tactical exchange.
 *
 * Returns one of `'opening' | 'middlegame' | 'endgame'`. The boundaries are
 * heuristic — a 12-move position that's already in a king-and-pawn endgame
 * (rare, but possible) will still be classed as opening by the ply rule. The
 * explanation system can be more nuanced if needed; this function exists to
 * pick a single template bucket.
 */
export function detectGamePhase(game: Game): GamePhase {
  const score = phaseScore(game);
  const plies = game.history().length;

  if (score <= ENDGAME_PHASE_CUTOFF) return GamePhase.Endgame;
  if (plies < OPENING_MIN_PLIES && score >= MIDDLEGAME_PHASE_CUTOFF) {
    return GamePhase.Opening;
  }
  return GamePhase.Middlegame;
}

/**
 * Sum of phase weights of all non-pawn, non-king pieces on the board (both
 * sides). Range: `0` (just kings + pawns) to `MAX_PHASE_SCORE` (full armies).
 * Exposed for callers that want the raw number (e.g. UI eval-bar tinting).
 */
export function phaseScore(game: Game): number {
  let total = 0;
  for (const p of listPieces(game)) {
    if (p.type === 'p' || p.type === 'k') continue;
    total += PIECE_PHASE_WEIGHT[p.type];
  }
  return total;
}
