import { describe, expect, it } from 'vitest';
import { analyzeMaterial } from '../material';
import { Game } from '../../game';

describe('analyzeMaterial', () => {
  it('reports an even balance for the starting position', () => {
    const m = analyzeMaterial(new Game());
    expect(m.diff).toBe(0);
    expect(m.whiteValue).toBe(m.blackValue);
    expect(m.white).toEqual({ p: 8, n: 2, b: 2, r: 2, q: 1 });
    expect(m.black).toEqual({ p: 8, n: 2, b: 2, r: 2, q: 1 });
    // Both sides have the bishop pair → no asymmetry to flag.
    expect(m.bishopPair).toBeNull();
    expect(m.countDelta).toEqual({ p: 0, n: 0, b: 0, r: 0, q: 0 });
  });

  it('detects white up a knight', () => {
    // White: K + N. Black: K. White is +3.
    const g = Game.fromFen('4k3/8/8/8/8/8/8/3NK3 w - - 0 1');
    const m = analyzeMaterial(g);
    expect(m.diff).toBe(3);
    expect(m.countDelta.n).toBe(1);
  });

  it('detects black up the exchange', () => {
    // White: K + N. Black: K + R. Black is +2 (5 - 3).
    const g = Game.fromFen('4k3/3r4/8/8/8/8/8/3NK3 w - - 0 1');
    const m = analyzeMaterial(g);
    expect(m.diff).toBe(-2);
    expect(m.countDelta.r).toBe(-1);
    expect(m.countDelta.n).toBe(1);
  });

  it('flags the bishop pair when only one side has both bishops', () => {
    // White: K + B + B. Black: K + B + N.
    const g = Game.fromFen('4k3/8/4nb2/8/8/4BB2/8/4K3 w - - 0 1');
    const m = analyzeMaterial(g);
    expect(m.bishopPair).toBe('w');
    expect(m.white.b).toBe(2);
    expect(m.black.b).toBe(1);
  });

  it('does not flag a bishop pair when both sides have two bishops', () => {
    const g = Game.fromFen('4k3/8/3bb3/8/8/3BB3/8/4K3 w - - 0 1');
    const m = analyzeMaterial(g);
    expect(m.bishopPair).toBeNull();
  });

  it('flags black with the bishop pair', () => {
    const g = Game.fromFen('4k3/8/3bb3/8/8/4BN2/8/4K3 w - - 0 1');
    const m = analyzeMaterial(g);
    expect(m.bishopPair).toBe('b');
  });

  it('excludes kings from totals', () => {
    // King-only on both sides — value should be zero.
    const g = Game.fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    const m = analyzeMaterial(g);
    expect(m.whiteValue).toBe(0);
    expect(m.blackValue).toBe(0);
    expect(m.diff).toBe(0);
  });

  it('handles a complex middlegame imbalance (Q for R+B+P)', () => {
    // White: K + Q. Black: K + R + B + P. Black sacrificed the queen for
    // R+B+P → black has 5+3+1 = 9, white has 9. Diff is 0 by raw value.
    const g = Game.fromFen('3rbk2/3p4/8/8/8/8/3Q4/4K3 w - - 0 1');
    const m = analyzeMaterial(g);
    expect(m.diff).toBe(0);
    expect(m.countDelta.q).toBe(1);
    expect(m.countDelta.r).toBe(-1);
    expect(m.countDelta.b).toBe(-1);
    expect(m.countDelta.p).toBe(-1);
  });
});
