import { describe, expect, it } from 'vitest';
import { findForks, findForksBy } from '../fork';
import { Game } from '../../game';

describe('findForks', () => {
  it('returns no forks in the starting position', () => {
    const g = new Game();
    expect(findForks(g)).toEqual([]);
  });

  it('detects a knight royal fork (queen + king)', () => {
    // White knight on c7 forks black king on a8 and black queen on e8.
    const g = Game.fromFen('k3q3/2N5/8/8/8/8/8/4K3 w - - 0 1');
    const forks = findForks(g);
    expect(forks).toHaveLength(1);
    expect(forks[0].forker.square).toBe('c7');
    expect(forks[0].targets.map((t) => t.square).sort()).toEqual(['a8', 'e8']);
  });

  it('detects a knight fork on king + rook (Nxc7-style)', () => {
    // Knight on c7 forks king on a8 and rook on e8.
    const g = Game.fromFen('k3r3/2N5/8/8/8/8/8/4K3 w - - 0 1');
    const forks = findForks(g);
    expect(forks).toHaveLength(1);
    expect(forks[0].forker.type).toBe('n');
  });

  it('does not flag a knight attacking only one major piece', () => {
    // Knight on c7 attacks rook on e8 only — no fork. Black king on h8 to
    // satisfy chess.js FEN validation, far from the knight.
    const g = Game.fromFen('4r2k/2N5/8/8/8/8/8/4K3 w - - 0 1');
    expect(findForks(g)).toEqual([]);
  });

  it('does not count attacks on lower-value pieces toward a fork', () => {
    // Knight on c7 attacks rook on a8 (≥ knight value 3) and pawn on e6
    // (< 3). Only one qualifying target → not a fork.
    const g = Game.fromFen('r6k/2N5/4p3/8/8/8/8/4K3 w - - 0 1');
    expect(findForks(g)).toEqual([]);
  });

  it('detects a pawn fork (two minor pieces)', () => {
    // White pawn on e5 forks black knight on d6 and black bishop on f6.
    const g = Game.fromFen('4k3/8/3n1b2/4P3/8/8/8/4K3 w - - 0 1');
    const forks = findForks(g);
    expect(forks).toHaveLength(1);
    expect(forks[0].forker.type).toBe('p');
    expect(forks[0].targets.map((t) => t.square).sort()).toEqual(['d6', 'f6']);
  });

  it('reports forks from both sides', () => {
    // White knight on c7 forks black king + queen; black knight on f3 forks
    // white king (e1) + rook (h2). Set black-to-move so it isn't black king's
    // turn while in (the irrelevant) check from the white knight's targets.
    const g = Game.fromFen('k3q3/2N5/8/8/8/5n2/7R/4K3 b - - 0 1');
    const forks = findForks(g);
    expect(forks.length).toBeGreaterThanOrEqual(2);
    expect(findForksBy(g, 'w').length).toBeGreaterThanOrEqual(1);
    expect(findForksBy(g, 'b').length).toBeGreaterThanOrEqual(1);
  });
});
