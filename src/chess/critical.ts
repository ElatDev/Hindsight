import { winPercentFromEval } from './accuracy';
import type { MoveAnalysis } from './analysis';

export type CriticalMoment = {
  /** 1-based ply this moment occurred at. */
  ply: number;
  san: string;
  fenBefore: string;
  /** Win-percent change in the moving player's POV. Negative = the move
   *  hurt the mover (typical "decisive blunder" case); positive = the move
   *  swung the eval in the mover's favour. */
  wpDelta: number;
  /** The underlying analysis record so the UI can pull anything else it
   *  needs (cp/mate evals, bestMove, etc.) without re-querying. */
  record: MoveAnalysis;
};

export type CriticalMomentsOptions = {
  /** How many moments to surface. Default 5 — matches the spec. */
  topN?: number;
  /** Minimum |Δwp| for a moment to qualify. Default 0 (everything ranks). */
  minDelta?: number;
};

/**
 * Rank the plies in a game by the absolute change in winning percentage
 * across the move (i.e. how decisive the move was, regardless of direction).
 * Returns the top N in descending order. Stable on ties — earlier plies win.
 */
export function criticalMoments(
  records: MoveAnalysis[],
  opts: CriticalMomentsOptions = {},
): CriticalMoment[] {
  const topN = opts.topN ?? 5;
  const minDelta = opts.minDelta ?? 0;

  const moments: CriticalMoment[] = records.map((rec) => {
    const wpBefore = winPercentFromEval(rec.evalCp, rec.mateIn);
    const wpAfter = winPercentFromEval(rec.evalCpAfter, rec.mateInAfter);
    return {
      ply: rec.ply,
      san: rec.san,
      fenBefore: rec.fenBefore,
      wpDelta: wpAfter - wpBefore,
      record: rec,
    };
  });

  return moments
    .filter((m) => Math.abs(m.wpDelta) >= minDelta)
    .sort((a, b) => {
      const diff = Math.abs(b.wpDelta) - Math.abs(a.wpDelta);
      return diff !== 0 ? diff : a.ply - b.ply;
    })
    .slice(0, topN);
}
