import { describe, expect, it } from 'vitest';
import { findSkewers, findSkewersBy } from '../skewer';
import { Game } from '../../game';

describe('findSkewers', () => {
  it('returns no skewers in the starting position', () => {
    const g = new Game();
    expect(findSkewers(g)).toEqual([]);
  });

  it('detects a queen-king skewer (king-front, queen-back)', () => {
    // White rook on a1, black king on a4, black queen on a8 (file ray). The
    // king must move; the queen falls. Wait — that's a skewer with king in
    // front (most valuable). Black king on a4 (forced to move), black queen
    // on a8 behind.
    const g = Game.fromFen('q7/8/8/8/k7/8/8/R3K3 w - - 0 1');
    const skewers = findSkewers(g);
    expect(skewers).toHaveLength(1);
    expect(skewers[0].skewerer.square).toBe('a1');
    expect(skewers[0].front.square).toBe('a4');
    expect(skewers[0].front.type).toBe('k');
    expect(skewers[0].back.square).toBe('a8');
    expect(skewers[0].back.type).toBe('q');
  });

  it('detects a bishop skewer (queen-front, rook-back)', () => {
    // White bishop on a1 skewers black queen on c3 to black rook on h8 along
    // the a1-h8 diagonal. Black king on h7 keeps the FEN legal.
    const g = Game.fromFen('7r/7k/8/8/8/2q5/8/B3K3 w - - 0 1');
    const skewers = findSkewers(g);
    const bishopSkewer = skewers.find((s) => s.skewerer.type === 'b');
    expect(bishopSkewer).toBeDefined();
    expect(bishopSkewer?.front.square).toBe('c3');
    expect(bishopSkewer?.back.square).toBe('h8');
  });

  it('does not flag a "skewer" where the back piece is more valuable (that is a pin)', () => {
    // Rook on a1, knight on a4, queen on a8. Front knight (3) < back queen (9)
    // — that's a pin, not a skewer. findSkewers should not include this.
    const g = Game.fromFen('q3k3/8/8/8/n7/8/8/R3K3 w - - 0 1');
    expect(findSkewers(g)).toEqual([]);
  });

  it('does not flag a piece "skewered" through equal-value back', () => {
    // Front and back same type (both knights) → not a skewer (front isn't
    // strictly more valuable than back).
    const g = Game.fromFen('n3k3/8/8/8/n7/8/8/R3K3 w - - 0 1');
    expect(findSkewers(g)).toEqual([]);
  });

  it('does not flag when own piece blocks the ray', () => {
    // White bishop on a1, white pawn on b2 → ray blocked.
    const g = Game.fromFen('7k/8/8/8/8/2q5/1P6/B3K3 w - - 0 1');
    expect(findSkewersBy(g, 'w')).toEqual([]);
  });

  it('non-sliding pieces never produce skewers', () => {
    // Knight on c3 with possibly-aligned enemy pieces — knights can't skewer.
    const g = Game.fromFen('q3k3/8/8/n7/8/2N5/8/4K3 w - - 0 1');
    expect(findSkewers(g).filter((s) => s.skewerer.type === 'n')).toEqual([]);
  });

  it('detects skewers from both sides', () => {
    // White rook on a1 skewers black king (a4) → black queen (a8).
    // Black rook on h8 skewers white king (h5) → white queen (h1).
    const g = Game.fromFen('q6r/8/8/7K/k7/8/8/R6Q w - - 0 1');
    expect(findSkewersBy(g, 'w').length).toBeGreaterThanOrEqual(1);
    expect(findSkewersBy(g, 'b').length).toBeGreaterThanOrEqual(1);
  });
});
