import type { AnalyzeFn } from './analysis';
import { isFlaggedClassification, type ClassifiedMove } from './classify';

const defaultAnalyze: AnalyzeFn = (req) => window.hindsight.engine.analyze(req);

export type AnalyzeAlternativesOptions = {
  /** Search depth for the second-pass multi-PV search. Default 18 — slightly
   *  deeper than the first pass so the alternatives are well-justified. */
  depth?: number;
  /** Number of alternatives to surface. Default 3. */
  multiPV?: number;
  /** Injectable engine call for tests. */
  analyze?: AnalyzeFn;
  /** Bail out cleanly between flagged moves. */
  signal?: AbortSignal;
  /** Per-flagged-move progress hook. `done` counts only flagged moves
   *  processed so far; `total` is the total number of flagged moves the run
   *  will visit. */
  onProgress?: (done: number, total: number, last: ClassifiedMove) => void;
};

/**
 * Walk the classified record set and run a second engine pass against any
 * flagged move's pre-move FEN with `multiPV` PV lines. The returned array is
 * a shallow copy of the input — flagged records carry an `alternatives` array
 * (sorted ascending by `multipv`); unflagged records are passed through
 * untouched. Sequential by design (single-process Stockfish).
 */
export async function analyzeAlternatives(
  records: ClassifiedMove[],
  opts: AnalyzeAlternativesOptions = {},
): Promise<ClassifiedMove[]> {
  const depth = opts.depth ?? 18;
  const multiPV = opts.multiPV ?? 3;
  const analyze = opts.analyze ?? defaultAnalyze;

  const flaggedIndices = records
    .map((r, i) => (isFlaggedClassification(r.classification) ? i : -1))
    .filter((i) => i >= 0);
  const total = flaggedIndices.length;

  const out: ClassifiedMove[] = records.slice();
  let done = 0;
  for (const idx of flaggedIndices) {
    if (opts.signal?.aborted) break;
    const rec = out[idx];
    const result = await analyze({
      fen: rec.fenBefore,
      depth,
      multiPV,
    });
    const enriched: ClassifiedMove = {
      ...rec,
      alternatives: result.lines,
    };
    out[idx] = enriched;
    done += 1;
    opts.onProgress?.(done, total, enriched);
  }
  return out;
}
