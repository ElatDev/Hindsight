import { describe, expect, it } from 'vitest';
import { Classification, classifyAnalyses, classifyMove } from '../classify';
import type { MoveAnalysis } from '../analysis';

// Defaults model a "best move": eval is the same from the mover's POV before
// and after, so cpLoss = 0. Tests override fields per scenario.
const baseRecord = (over: Partial<MoveAnalysis> = {}): MoveAnalysis => ({
  ply: 1,
  san: 'e4',
  uciPlayed: 'e2e4',
  fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  evalCp: 30,
  mateIn: null,
  bestMove: 'e2e4',
  evalCpAfter: 30,
  mateInAfter: null,
  ...over,
});

describe('classifyMove — engine top pick', () => {
  it('returns Best when uciPlayed matches bestMove', () => {
    const out = classifyMove(baseRecord());
    expect(out.classification).toBe(Classification.Best);
    expect(out.cpLoss).toBe(0);
  });

  it('does NOT return Best when bestMove is null', () => {
    const out = classifyMove(
      baseRecord({ bestMove: null, evalCp: 0, evalCpAfter: 0 }),
    );
    expect(out.classification).not.toBe(Classification.Best);
  });
});

describe('classifyMove — cp-loss buckets', () => {
  it('Excellent: small loss (< 10 cp)', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'e2e4',
        evalCp: 30,
        evalCpAfter: 25,
      }),
    );
    expect(out.cpLoss).toBe(5);
    expect(out.classification).toBe(Classification.Excellent);
  });

  it('Good: 10..49 cp loss', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'e2e4',
        evalCp: 50,
        evalCpAfter: 20,
      }),
    );
    expect(out.cpLoss).toBe(30);
    expect(out.classification).toBe(Classification.Good);
  });

  it('Inaccuracy: 50..99 cp loss', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'e2e4',
        evalCp: 100,
        evalCpAfter: 25,
      }),
    );
    expect(out.cpLoss).toBe(75);
    expect(out.classification).toBe(Classification.Inaccuracy);
  });

  it('Mistake: 100..199 cp loss', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'e2e4',
        evalCp: 100,
        evalCpAfter: -50,
      }),
    );
    expect(out.cpLoss).toBe(150);
    expect(out.classification).toBe(Classification.Mistake);
  });

  it('Blunder: >= 200 cp loss', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'e2e4',
        evalCp: 50,
        evalCpAfter: -300,
      }),
    );
    expect(out.cpLoss).toBe(350);
    expect(out.classification).toBe(Classification.Blunder);
  });

  it('clamps negative cp loss to 0 (post-move depth sometimes flatters)', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'e2e4',
        evalCp: 20,
        evalCpAfter: 80,
      }),
    );
    expect(out.cpLoss).toBe(0);
    expect(out.classification).toBe(Classification.Excellent);
  });
});

describe('classifyMove — mate handling', () => {
  it('Miss: had forced mate, played a non-mating move', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3', // not the mating move
        bestMove: 'd1h5',
        evalCp: null,
        mateIn: 2, // mover had mate-in-2
        evalCpAfter: 50, // now just up material
        mateInAfter: null,
      }),
    );
    expect(out.classification).toBe(Classification.Miss);
  });

  it('Best beats Miss when the played move IS the engine top pick', () => {
    // Edge case: somehow mateIn before but engine bestMove == played AND no
    // longer mating after. We trust the engine — Best wins.
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'd1h5',
        bestMove: 'd1h5',
        mateIn: 2,
        evalCp: null,
        evalCpAfter: null,
        mateInAfter: 1,
      }),
    );
    expect(out.classification).toBe(Classification.Best);
  });

  it('Best when played move continues a forced mate', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'd1h5',
        bestMove: 'd1h5',
        mateIn: 3,
        evalCp: null,
        evalCpAfter: null,
        mateInAfter: 2, // continuing mate
      }),
    );
    expect(out.classification).toBe(Classification.Best);
  });

  it('Excellent when player slightly delays a forced mate', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'd1h5',
        mateIn: 3,
        evalCp: null,
        evalCpAfter: null,
        mateInAfter: 4, // still mating, a bit slower
      }),
    );
    expect(out.classification).toBe(Classification.Excellent);
    expect(out.cpLoss).toBeLessThan(10);
  });

  it('Blunder: walked into a forced mate that did not exist before', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'e2e4',
        evalCp: 0,
        mateIn: null,
        evalCpAfter: null,
        mateInAfter: -3, // opponent now has mate-in-3
      }),
    );
    expect(out.classification).toBe(Classification.Blunder);
  });

  it('not Blunder via mate override when mover was already being mated', () => {
    // They were already lost; the move doesn't introduce the mate.
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'e2e4',
        evalCp: null,
        mateIn: -5,
        evalCpAfter: null,
        mateInAfter: -3, // mate accelerated
      }),
    );
    // No "you walked in" override; falls through to cp-loss math.
    expect(out.classification).not.toBe(Classification.Blunder);
  });

  it('falls back to Good when cp-loss cannot be computed', () => {
    const out = classifyMove(
      baseRecord({
        uciPlayed: 'g1f3',
        bestMove: 'e2e4',
        evalCp: null,
        mateIn: null,
        evalCpAfter: null,
        mateInAfter: null,
      }),
    );
    expect(out.classification).toBe(Classification.Good);
    expect(out.cpLoss).toBeNull();
  });
});

describe('classifyAnalyses', () => {
  it('classifies a list of records preserving order', () => {
    const records: MoveAnalysis[] = [
      baseRecord({ ply: 1, uciPlayed: 'e2e4', bestMove: 'e2e4' }),
      baseRecord({
        ply: 2,
        uciPlayed: 'a7a5',
        bestMove: 'e7e5',
        evalCp: 30,
        evalCpAfter: -150,
      }),
    ];
    const out = classifyAnalyses(records);
    expect(out).toHaveLength(2);
    expect(out[0].classification).toBe(Classification.Best);
    expect(out[1].classification).toBe(Classification.Mistake);
    expect(out[1].cpLoss).toBe(180);
  });
});
