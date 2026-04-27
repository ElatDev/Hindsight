import { describe, expect, it } from 'vitest';
import { gameAccuracy, moveAccuracy, winPercentFromEval } from '../accuracy';
import type { MoveAnalysis } from '../analysis';

describe('winPercentFromEval', () => {
  it('returns 50% for a balanced cp eval', () => {
    expect(winPercentFromEval(0, null)).toBeCloseTo(50, 5);
  });

  it('returns 100 for a forced mate by the mover', () => {
    expect(winPercentFromEval(null, 3)).toBe(100);
    expect(winPercentFromEval(null, 1)).toBe(100);
  });

  it('returns 0 when the mover is being mated', () => {
    expect(winPercentFromEval(null, -2)).toBe(0);
  });

  it('returns 50 for missing data', () => {
    expect(winPercentFromEval(null, null)).toBe(50);
  });

  it('is monotonically increasing in cp', () => {
    const a = winPercentFromEval(-200, null);
    const b = winPercentFromEval(0, null);
    const c = winPercentFromEval(200, null);
    expect(a).toBeLessThan(b);
    expect(b).toBeLessThan(c);
  });

  it('approaches but does not exceed 100 for huge cp eval', () => {
    const v = winPercentFromEval(5000, null);
    expect(v).toBeGreaterThan(99);
    expect(v).toBeLessThanOrEqual(100);
  });
});

describe('moveAccuracy', () => {
  it('is ~100 when the win-percent is preserved', () => {
    expect(moveAccuracy(60, 60)).toBeCloseTo(100, 0);
  });

  it('treats player-improved-the-eval as ~100 accuracy', () => {
    // Δwp clamps to 0 → accuracy ≈ 103.1668 - 3.1669 ≈ 99.9999.
    expect(moveAccuracy(40, 70)).toBeGreaterThan(99.9);
  });

  it('drops sharply for big win-percent losses', () => {
    const small = moveAccuracy(60, 55); // 5% drop
    const medium = moveAccuracy(60, 40); // 20% drop
    const big = moveAccuracy(60, 10); // 50% drop
    expect(small).toBeGreaterThan(medium);
    expect(medium).toBeGreaterThan(big);
    expect(big).toBeLessThan(15);
  });

  it('is non-negative', () => {
    expect(moveAccuracy(100, 0)).toBeGreaterThanOrEqual(0);
  });
});

const rec = (over: Partial<MoveAnalysis>): MoveAnalysis => ({
  ply: 1,
  san: 'e4',
  uciPlayed: 'e2e4',
  fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  evalCp: 0,
  mateIn: null,
  bestMove: 'e2e4',
  evalCpAfter: 0,
  mateInAfter: null,
  ...over,
});

describe('gameAccuracy', () => {
  it('attributes moves to white/black based on fenBefore side-to-move', () => {
    const records: MoveAnalysis[] = [
      rec({
        ply: 1,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        evalCp: 0,
        evalCpAfter: 30,
      }),
      rec({
        ply: 2,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        evalCp: -30,
        evalCpAfter: -30,
      }),
    ];
    const out = gameAccuracy(records);
    expect(out.white.perMove).toHaveLength(1);
    expect(out.black.perMove).toHaveLength(1);
  });

  it('a perfect game scores ~100 for both sides', () => {
    const records: MoveAnalysis[] = [
      rec({
        ply: 1,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        evalCp: 30,
        evalCpAfter: 30,
      }),
      rec({
        ply: 2,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        evalCp: -30,
        evalCpAfter: -30,
      }),
      rec({
        ply: 3,
        fenBefore:
          'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq e6 0 2',
        evalCp: 30,
        evalCpAfter: 30,
      }),
    ];
    const out = gameAccuracy(records);
    expect(out.white.overall).toBeGreaterThan(95);
    expect(out.black.overall).toBeGreaterThan(95);
  });

  it('a one-side blunder collapses only that side', () => {
    const records: MoveAnalysis[] = [
      // White plays well.
      rec({
        ply: 1,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        evalCp: 30,
        evalCpAfter: 30,
      }),
      // Black blunders 800cp.
      rec({
        ply: 2,
        fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        evalCp: -30,
        evalCpAfter: -800,
      }),
    ];
    const out = gameAccuracy(records);
    expect(out.white.overall).toBeGreaterThan(95);
    expect(out.black.overall).toBeLessThan(60);
  });

  it('returns 0 overall for a side with no moves recorded', () => {
    const out = gameAccuracy([]);
    expect(out.white.overall).toBe(0);
    expect(out.black.overall).toBe(0);
    expect(out.white.perMove).toEqual([]);
    expect(out.black.perMove).toEqual([]);
  });
});
