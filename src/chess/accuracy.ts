import type { ClassifiedMove } from './classify';
import type { MoveAnalysis } from './analysis';

/**
 * Convert a centipawn / mate evaluation to a winning percentage [0, 100],
 * always from the same POV the input is in. Lichess's logistic mapping
 * (sigmoid, k=0.00368208) is the de-facto standard.
 *
 * Mate scores collapse to 100/0 — a forced mate is "winning" or "losing"
 * with no further nuance for the win-percent purpose.
 */
export function winPercentFromEval(
  evalCp: number | null,
  mateIn: number | null,
): number {
  if (mateIn != null) {
    return mateIn > 0 ? 100 : 0;
  }
  if (evalCp == null) return 50;
  return 50 + 50 * (2 / (1 + Math.exp(-0.00368208 * evalCp)) - 1);
}

/**
 * Per-move accuracy in [0, 100] derived from the win-percent drop
 * (`wpBefore - wpAfter`). Lichess's calibrated curve:
 *   accuracy = 103.1668 * exp(-0.04354 * Δwp) - 3.1669, clamped to [0, 100].
 *
 * If the player improved the eval (rare; happens at low depth or after a
 * post-move re-search runs deeper), Δwp clamps to 0 → accuracy ≈ 100.
 */
export function moveAccuracy(wpBefore: number, wpAfter: number): number {
  const drop = Math.max(0, wpBefore - wpAfter);
  const acc = 103.1668 * Math.exp(-0.04354 * drop) - 3.1669;
  return Math.max(0, Math.min(100, acc));
}

const harmonicMean = (values: number[]): number => {
  if (values.length === 0) return 0;
  // Floor each value at 0.5 so a single 0%-accuracy move can't zero the whole
  // game out (matches Lichess's behaviour — they cap divisor sensitivity).
  const sumInv = values.reduce((s, v) => s + 1 / Math.max(v, 0.5), 0);
  return values.length / sumInv;
};

const fenSideToMove = (fen: string): 'w' | 'b' => {
  const parts = fen.split(' ');
  return parts[1] === 'b' ? 'b' : 'w';
};

export type SideAccuracy = {
  /** Per-move accuracies in playing order. Useful for charts. */
  perMove: number[];
  /** Aggregate score in [0, 100]. Harmonic mean of `perMove`. */
  overall: number;
};

export type GameAccuracy = {
  white: SideAccuracy;
  black: SideAccuracy;
};

/**
 * Compute per-side game accuracy from a list of move records that carry both
 * pre- and post-move evals. Side is derived from each move's `fenBefore`
 * (whoever was to move at that position) so games starting from non-standard
 * positions still attribute correctly.
 */
export function gameAccuracy(
  records: MoveAnalysis[] | ClassifiedMove[],
): GameAccuracy {
  const whitePerMove: number[] = [];
  const blackPerMove: number[] = [];
  for (const rec of records) {
    const wpBefore = winPercentFromEval(rec.evalCp, rec.mateIn);
    const wpAfter = winPercentFromEval(rec.evalCpAfter, rec.mateInAfter);
    const acc = moveAccuracy(wpBefore, wpAfter);
    if (fenSideToMove(rec.fenBefore) === 'w') whitePerMove.push(acc);
    else blackPerMove.push(acc);
  }
  return {
    white: { perMove: whitePerMove, overall: harmonicMean(whitePerMove) },
    black: { perMove: blackPerMove, overall: harmonicMean(blackPerMove) },
  };
}
