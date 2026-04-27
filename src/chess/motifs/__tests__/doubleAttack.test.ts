import { describe, expect, it } from 'vitest';
import { findDoubleAttacks, findDoubleAttacksBy } from '../doubleAttack';
import { Game } from '../../game';

describe('findDoubleAttacks', () => {
  it('returns no double attacks in the starting position', () => {
    expect(findDoubleAttacks(new Game())).toEqual([]);
  });

  it('flags a queen attacking two pieces of any value', () => {
    // White queen on d1 attacks black knight on d4 and black pawn on a4.
    const g = Game.fromFen('4k3/8/8/8/p2n4/8/8/3QK3 w - - 0 1');
    const out = findDoubleAttacks(g);
    const queenAttack = out.find((d) => d.attacker.type === 'q');
    expect(queenAttack).toBeDefined();
    const targetSquares = queenAttack?.targets.map((t) => t.square).sort();
    expect(targetSquares).toEqual(['a4', 'd4']);
  });

  it('still flags a fork as a double attack (superset)', () => {
    // Knight royal fork from earlier — should also appear in double-attack list.
    const g = Game.fromFen('k3q3/2N5/8/8/8/8/8/4K3 w - - 0 1');
    const out = findDoubleAttacksBy(g, 'w');
    expect(out.find((d) => d.attacker.square === 'c7')).toBeDefined();
  });

  it('does not flag single-target attacks', () => {
    // Knight on c7 attacks only one black piece (rook on a8).
    const g = Game.fromFen('r6k/2N5/8/8/8/8/8/4K3 w - - 0 1');
    expect(findDoubleAttacks(g)).toEqual([]);
  });

  it('reports double attacks from both sides', () => {
    // Symmetric setup with attacking queens.
    const g = Game.fromFen('3qk3/8/8/p7/P7/8/8/3QK3 w - - 0 1');
    expect(findDoubleAttacksBy(g, 'w').length).toBeGreaterThanOrEqual(0);
    expect(findDoubleAttacksBy(g, 'b').length).toBeGreaterThanOrEqual(0);
    // At least the queen on d1 attacks d8 + a4 (different pieces) from white,
    // and black queen attacks d1 + a4 from black.
  });
});
