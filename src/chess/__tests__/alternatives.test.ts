import { describe, expect, it, vi } from 'vitest';
import { analyzeAlternatives } from '../alternatives';
import { Classification, type ClassifiedMove } from '../classify';
import type { AnalysisResult, AnalyzeRequest } from '../../../shared/ipc';

const baseClassified = (
  over: Partial<ClassifiedMove> = {},
): ClassifiedMove => ({
  ply: 1,
  san: 'e4',
  uciPlayed: 'e2e4',
  fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  evalCp: 30,
  mateIn: null,
  bestMove: 'e2e4',
  evalCpAfter: 30,
  mateInAfter: null,
  classification: Classification.Best,
  cpLoss: 0,
  ...over,
});

const stubMultiPv = (count: number): AnalysisResult => ({
  bestMove: 'a1a2',
  lines: Array.from({ length: count }, (_, i) => ({
    depth: 18,
    multipv: i + 1,
    pv: [`a${i + 1}a${i + 2}`],
    evalCp: 50 - i * 20,
    mateIn: null,
  })),
});

describe('analyzeAlternatives', () => {
  it('only re-analyses flagged moves', async () => {
    const records: ClassifiedMove[] = [
      baseClassified({ ply: 1, classification: Classification.Best }),
      baseClassified({ ply: 2, classification: Classification.Inaccuracy }),
      baseClassified({ ply: 3, classification: Classification.Excellent }),
      baseClassified({ ply: 4, classification: Classification.Blunder }),
      baseClassified({ ply: 5, classification: Classification.Miss }),
      baseClassified({ ply: 6, classification: Classification.Mistake }),
      baseClassified({ ply: 7, classification: Classification.Good }),
    ];

    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubMultiPv(3));
    const out = await analyzeAlternatives(records, { analyze });

    // Inaccuracy / Mistake / Blunder / Miss should be analysed (4 records).
    expect(analyze).toHaveBeenCalledTimes(4);
    expect(out[0].alternatives).toBeUndefined();
    expect(out[1].alternatives).toHaveLength(3);
    expect(out[2].alternatives).toBeUndefined();
    expect(out[3].alternatives).toHaveLength(3);
    expect(out[4].alternatives).toHaveLength(3);
    expect(out[5].alternatives).toHaveLength(3);
    expect(out[6].alternatives).toBeUndefined();
  });

  it('passes the requested depth and multiPV to the analyzer', async () => {
    const records: ClassifiedMove[] = [
      baseClassified({ classification: Classification.Blunder }),
    ];
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubMultiPv(5));
    await analyzeAlternatives(records, {
      depth: 22,
      multiPV: 5,
      analyze,
    });
    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 22, multiPV: 5 }),
    );
  });

  it('queries the pre-move FEN, not after', async () => {
    const fen = '8/8/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1';
    const records: ClassifiedMove[] = [
      baseClassified({
        fenBefore: fen,
        classification: Classification.Mistake,
      }),
    ];
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubMultiPv(3));
    await analyzeAlternatives(records, { analyze });
    expect(analyze).toHaveBeenCalledWith(expect.objectContaining({ fen }));
  });

  it('does not mutate the input array', async () => {
    const records: ClassifiedMove[] = [
      baseClassified({ classification: Classification.Mistake }),
    ];
    const before = JSON.parse(JSON.stringify(records));
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubMultiPv(3));
    await analyzeAlternatives(records, { analyze });
    expect(records).toEqual(before);
  });

  it('honours the abort signal between flagged moves', async () => {
    const records: ClassifiedMove[] = [
      baseClassified({ ply: 1, classification: Classification.Mistake }),
      baseClassified({ ply: 2, classification: Classification.Blunder }),
    ];
    const controller = new AbortController();
    controller.abort();
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubMultiPv(3));
    const out = await analyzeAlternatives(records, {
      analyze,
      signal: controller.signal,
    });
    expect(analyze).not.toHaveBeenCalled();
    expect(out[0].alternatives).toBeUndefined();
    expect(out[1].alternatives).toBeUndefined();
  });

  it('emits onProgress with cumulative counts', async () => {
    const records: ClassifiedMove[] = [
      baseClassified({ ply: 1, classification: Classification.Best }),
      baseClassified({ ply: 2, classification: Classification.Mistake }),
      baseClassified({ ply: 3, classification: Classification.Blunder }),
    ];
    const onProgress = vi.fn();
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubMultiPv(3));
    await analyzeAlternatives(records, { analyze, onProgress });
    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(
      1,
      1,
      2,
      expect.objectContaining({ ply: 2 }),
    );
    expect(onProgress).toHaveBeenNthCalledWith(
      2,
      2,
      2,
      expect.objectContaining({ ply: 3 }),
    );
  });
});
