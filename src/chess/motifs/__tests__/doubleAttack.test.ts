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
    // White queen on d1 hits BQ on d8 (file d) and BP on a4 (a4-d1 diagonal).
    // Black queen on d8 mirrors: hits WQ on d1 (file d) and WP on a5 (a5-d8
    // diagonal). The rooks are scenery — each only attacks one enemy.
    const g = Game.fromFen('r2qk2r/8/8/P7/p7/8/8/R2QK2R w - - 0 1');

    const white = findDoubleAttacksBy(g, 'w');
    const wq = white.find((d) => d.attacker.square === 'd1');
    expect(wq).toBeDefined();
    expect(wq?.targets.map((t) => t.square).sort()).toEqual(['a4', 'd8']);

    const black = findDoubleAttacksBy(g, 'b');
    const bq = black.find((d) => d.attacker.square === 'd8');
    expect(bq).toBeDefined();
    expect(bq?.targets.map((t) => t.square).sort()).toEqual(['a5', 'd1']);
  });
});
