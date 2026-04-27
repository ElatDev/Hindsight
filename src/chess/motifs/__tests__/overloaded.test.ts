import { describe, expect, it } from 'vitest';
import { findOverloadedPieces, findOverloadedPiecesFor } from '../overloaded';
import { Game } from '../../game';

describe('findOverloadedPieces', () => {
  it('returns nothing in the starting position', () => {
    expect(findOverloadedPieces(new Game())).toEqual([]);
  });

  it('flags a queen defending two attacked pieces', () => {
    // White queen on d2 defends bishop on d4 (attacked by black queen on d8)
    // and knight on b4 (attacked by black bishop on a3). Both are under
    // attack; white queen is the only defender of each.
    const g = Game.fromFen('3qk3/8/8/8/1N1B4/b7/3Q4/4K3 w - - 0 1');
    const out = findOverloadedPieces(g);
    const whiteQueen = out.find(
      (o) => o.defender.type === 'q' && o.defender.color === 'w',
    );
    expect(whiteQueen).toBeDefined();
    expect(whiteQueen?.defending.length).toBeGreaterThanOrEqual(2);
  });

  it('does not flag a defender of a single attacked piece', () => {
    // Just the bishop being defended.
    const g = Game.fromFen('3qk3/8/8/8/3B4/8/3Q4/4K3 w - - 0 1');
    expect(findOverloadedPieces(g)).toEqual([]);
  });

  it('does not flag pieces defending unattacked teammates', () => {
    // Queen defends two own pieces but neither is attacked.
    const g = Game.fromFen('4k3/8/8/8/1N1B4/8/3Q4/4K3 w - - 0 1');
    expect(findOverloadedPieces(g)).toEqual([]);
  });

  it('side-filtered helper returns only the requested color', () => {
    const g = Game.fromFen('3qk3/8/8/8/1N1B4/b7/3Q4/4K3 w - - 0 1');
    const onlyWhite = findOverloadedPiecesFor(g, 'w');
    expect(onlyWhite.every((o) => o.defender.color === 'w')).toBe(true);
  });

  it('does not include the king as a defender candidate', () => {
    // King "defends" two pieces around it (geometrically) but kings can't be
    // captured to remove the defender — exclude.
    const g = Game.fromFen('3qk3/3p4/3K4/3p4/8/8/8/8 b - - 0 1');
    const out = findOverloadedPieces(g);
    expect(out.find((o) => o.defender.type === 'k')).toBeUndefined();
  });
});
