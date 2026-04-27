import type { MoveAnalysis } from './analysis';

/**
 * Per-move quality buckets. Naming follows the chess.com / lichess vocabulary
 * users already know. `Brilliant` and `Book` are reserved for later phases:
 * `Brilliant` needs motif detection (Phase 7+) to identify sacrifices, and
 * `Book` needs the opening database (Phase 9). Until then the classifier will
 * never emit them.
 */
export const Classification = {
  Brilliant: 'brilliant',
  Best: 'best',
  Excellent: 'excellent',
  Good: 'good',
  Inaccuracy: 'inaccuracy',
  Mistake: 'mistake',
  Blunder: 'blunder',
  Miss: 'miss',
  Book: 'book',
} as const;

export type Classification =
  (typeof Classification)[keyof typeof Classification];

/**
 * Centipawn-loss bucket boundaries (inclusive lower bound). Values aligned
 * with what most online platforms surface so user expectations carry over.
 */
export const CP_LOSS_THRESHOLDS = {
  excellent: 10,
  good: 50,
  inaccuracy: 100,
  mistake: 200,
  // anything >= 200 is a blunder
} as const;

export type ClassifiedMove = MoveAnalysis & {
  classification: Classification;
  /** Centipawn loss from the moving player's POV. null when the move was
   *  played in or led into a mate-scored region (use the mate fields to
   *  reason about those instead). */
  cpLoss: number | null;
};

/**
 * Effective centipawn evaluation from the mover's POV. Mate scores get folded
 * into a large absolute value so a "mate-in-N" position compares as much
 * better than any practical cp eval — used only for cp-loss arithmetic when
 * one side of the comparison is a cp score and the other is mate.
 */
const MATE_AS_CP = 100_000;

const evalAsCp = (cp: number | null, mate: number | null): number | null => {
  if (cp != null) return cp;
  if (mate == null) return null;
  // mate > 0 → the mover delivers mate; further from mate (large |mate|) is
  // worse than mate-in-1, but still vastly better than any cp score. We
  // subtract |mate| so mate-in-1 > mate-in-5 within the mate region.
  if (mate > 0) return MATE_AS_CP - mate;
  return -MATE_AS_CP - mate; // mate < 0 → being mated; closer mate = worse
};

/**
 * Map a fully-populated `MoveAnalysis` to a `ClassifiedMove`.
 *
 * Decision order:
 *  1. The played move matches the engine's top recommendation → `Best`.
 *  2. Mate-aware overrides:
 *     - mover had a forced mate but no longer does → `Miss`
 *     - mover walked into a forced mate against them → `Blunder`
 *  3. Otherwise bucket by centipawn loss against the engine's eval.
 *
 * If we can't compute a centipawn loss (missing eval-after, no `bestMove`),
 * we fall back to `Good` rather than guessing — Phase 12 will surface "no
 * data" UX more cleanly.
 */
export function classifyMove(record: MoveAnalysis): ClassifiedMove {
  const cpLoss = computeCpLoss(record);

  // Engine top-pick wins outright.
  if (record.bestMove && record.uciPlayed === record.bestMove) {
    return {
      ...record,
      classification: Classification.Best,
      cpLoss: cpLoss ?? 0,
    };
  }

  // Mate-aware overrides.
  if (record.mateIn != null && record.mateIn > 0) {
    // Mover had a forced mate before. Did they still have it after?
    const stillMating = record.mateInAfter != null && record.mateInAfter > 0;
    if (!stillMating) {
      return {
        ...record,
        classification: Classification.Miss,
        cpLoss,
      };
    }
  }
  if (record.mateInAfter != null && record.mateInAfter < 0) {
    // Mover walked into being mated.
    const wasAlreadyMated = record.mateIn != null && record.mateIn < 0;
    if (!wasAlreadyMated) {
      return {
        ...record,
        classification: Classification.Blunder,
        cpLoss,
      };
    }
  }

  if (cpLoss == null) {
    return {
      ...record,
      classification: Classification.Good,
      cpLoss: null,
    };
  }

  return {
    ...record,
    classification: bucketByCpLoss(cpLoss),
    cpLoss,
  };
}

function computeCpLoss(record: MoveAnalysis): number | null {
  const before = evalAsCp(record.evalCp, record.mateIn);
  const after = evalAsCp(record.evalCpAfter, record.mateInAfter);
  if (before == null || after == null) return null;
  // Both numbers are from the mover's POV. Loss is how much the mover gave up.
  // Negative loss (i.e. the mover *improved* the eval — possible at low depth
  // when the post-move analysis runs deeper into the line) clamps to 0.
  return Math.max(0, before - after);
}

function bucketByCpLoss(cpLoss: number): Classification {
  if (cpLoss < CP_LOSS_THRESHOLDS.excellent) return Classification.Excellent;
  if (cpLoss < CP_LOSS_THRESHOLDS.good) return Classification.Good;
  if (cpLoss < CP_LOSS_THRESHOLDS.inaccuracy) return Classification.Inaccuracy;
  if (cpLoss < CP_LOSS_THRESHOLDS.mistake) return Classification.Mistake;
  return Classification.Blunder;
}

/** Convenience: classify a whole game's worth of `MoveAnalysis` records. */
export function classifyAnalyses(records: MoveAnalysis[]): ClassifiedMove[] {
  return records.map(classifyMove);
}
