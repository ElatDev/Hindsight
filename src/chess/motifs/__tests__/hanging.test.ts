import { describe, expect, it } from 'vitest';
import { findHangingPieces, findHangingPiecesFor } from '../hanging';
import { Game } from '../../game';

describe('findHangingPieces', () => {
  it('returns no hanging pieces in the starting position', () => {
    const g = new Game();
    expect(findHangingPieces(g)).toEqual([]);
  });

  it('flags a lone undefended piece attacked by an enemy queen', () => {
    // Black knight on e5, attacked by white queen on e1 (file). Black king
    // on h8, white king on h1 — neither contributes defence.
    const g = Game.fromFen('7k/8/8/4n3/8/8/8/4Q2K w - - 0 1');
    const out = findHangingPieces(g);
    expect(out).toHaveLength(1);
    expect(out[0]).toEqual({ square: 'e5', type: 'n', color: 'b' });
  });

  it('does not flag a defended piece even when attacked', () => {
    // Black knight on e5 defended by black pawn on d6, attacked by white queen.
    const g = Game.fromFen('7k/8/3p4/4n3/8/8/8/4Q2K w - - 0 1');
    expect(findHangingPieces(g)).toEqual([]);
  });

  it('does not flag pieces that are not attacked', () => {
    // Knight on b1 (white starting square), nothing attacks it.
    const g = Game.fromFen('4k3/8/8/8/8/8/8/1N2K3 w - - 0 1');
    expect(findHangingPieces(g)).toEqual([]);
  });

  it('excludes kings even when in check', () => {
    // Black king on e8, white queen on e1 — black king is in check; not
    // reported as hanging.
    const g = Game.fromFen('4k3/8/8/8/8/8/8/4Q2K b - - 0 1');
    const out = findHangingPieces(g);
    expect(out.find((p) => p.type === 'k')).toBeUndefined();
  });

  it('flags multiple hanging pieces in one position', () => {
    // White rook on a1 and white knight on h1, both undefended, attacked by
    // black queens on a8 and h8.
    const g = Game.fromFen('q5kq/8/8/8/8/8/8/R3K2N w - - 0 1');
    const out = findHangingPieces(g);
    const hangingWhite = out
      .filter((p) => p.color === 'w')
      .map((p) => p.square);
    expect(hangingWhite.sort()).toEqual(['a1', 'h1']);
  });

  it('detects hanging pawns too', () => {
    // White pawn on d4 attacked by black knight on e6, undefended.
    const g = Game.fromFen('4k3/8/4n3/8/3P4/8/8/4K3 w - - 0 1');
    const out = findHangingPieces(g);
    expect(out.find((p) => p.square === 'd4' && p.type === 'p')).toEqual({
      square: 'd4',
      type: 'p',
      color: 'w',
    });
  });
});

describe('findHangingPiecesFor', () => {
  it('returns only the requested colour', () => {
    // Both sides have hanging pieces.
    const g = Game.fromFen('q5kq/8/8/8/8/8/8/R3K2N w - - 0 1');
    const white = findHangingPiecesFor(g, 'w');
    const black = findHangingPiecesFor(g, 'b');
    expect(white.every((p) => p.color === 'w')).toBe(true);
    expect(black.every((p) => p.color === 'b')).toBe(true);
  });
});
