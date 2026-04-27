import { describe, expect, it } from 'vitest';
import { criticalMoments } from '../critical';
import type { MoveAnalysis } from '../analysis';

const rec = (over: Partial<MoveAnalysis>): MoveAnalysis => ({
  ply: 1,
  san: 'e4',
  uciPlayed: 'e2e4',
  fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  evalCp: 0,
  mateIn: null,
  bestMove: null,
  evalCpAfter: 0,
  mateInAfter: null,
  ...over,
});

describe('criticalMoments', () => {
  it('returns up to topN moments sorted by absolute Δwp descending', () => {
    const records: MoveAnalysis[] = [
      rec({ ply: 1, san: 'a3', evalCp: 30, evalCpAfter: 25 }), // small
      rec({ ply: 2, san: '??', evalCp: 30, evalCpAfter: -800 }), // huge negative
      rec({ ply: 3, san: 'Nf3', evalCp: -800, evalCpAfter: -780 }), // sigmoid-flat
      rec({ ply: 4, san: '!!', evalCp: -780, evalCpAfter: 200 }), // huge positive
      rec({ ply: 5, san: 'Bb5', evalCp: 0, evalCpAfter: -50 }), // medium
    ];
    const out = criticalMoments(records, { topN: 3 });
    expect(out).toHaveLength(3);
    // Plies 2 and 4 swing the eval by ~830 cp; ply 5 by 50 cp. Plies 1 and 3
    // both translate to <0.5% wp shifts so they don't make the cut. Order
    // between 2 and 4 depends on sigmoid asymmetry around the boundary.
    expect(out.map((m) => m.ply).sort()).toEqual([2, 4, 5]);
    expect(Math.abs(out[2].wpDelta)).toBeLessThan(Math.abs(out[1].wpDelta));
  });

  it('defaults topN to 5', () => {
    const records: MoveAnalysis[] = Array.from({ length: 8 }, (_, i) =>
      rec({ ply: i + 1, evalCp: 0, evalCpAfter: -((i + 1) * 100) }),
    );
    const out = criticalMoments(records);
    expect(out).toHaveLength(5);
  });

  it('breaks ties by earlier ply', () => {
    const records: MoveAnalysis[] = [
      rec({ ply: 5, evalCp: 0, evalCpAfter: -200 }),
      rec({ ply: 2, evalCp: 0, evalCpAfter: -200 }), // same delta, earlier
      rec({ ply: 9, evalCp: 0, evalCpAfter: -200 }),
    ];
    const out = criticalMoments(records, { topN: 3 });
    expect(out.map((m) => m.ply)).toEqual([2, 5, 9]);
  });

  it('includes positive swings (good moves) alongside blunders', () => {
    const records: MoveAnalysis[] = [
      rec({ ply: 1, evalCp: -500, evalCpAfter: 100 }), // recovery
      rec({ ply: 2, evalCp: 0, evalCpAfter: -200 }),
    ];
    const out = criticalMoments(records, { topN: 5 });
    expect(out[0].ply).toBe(1);
    expect(out[0].wpDelta).toBeGreaterThan(0);
    expect(out[1].wpDelta).toBeLessThan(0);
  });

  it('handles mate scores correctly via win-percent', () => {
    const records: MoveAnalysis[] = [
      // Player had mate-in-3, lost it to a -200 cp eval — catastrophic.
      rec({ ply: 1, evalCp: null, mateIn: 3, evalCpAfter: -200 }),
    ];
    const out = criticalMoments(records);
    expect(out[0].ply).toBe(1);
    // 100 → ~24 percent → big negative delta
    expect(out[0].wpDelta).toBeLessThan(-50);
  });

  it('respects minDelta filter', () => {
    const records: MoveAnalysis[] = [
      rec({ ply: 1, evalCp: 0, evalCpAfter: -2 }),
      rec({ ply: 2, evalCp: 0, evalCpAfter: -1000 }),
    ];
    const out = criticalMoments(records, { minDelta: 20 });
    expect(out.map((m) => m.ply)).toEqual([2]);
  });

  it('returns an empty array for an empty input', () => {
    expect(criticalMoments([])).toEqual([]);
  });
});
