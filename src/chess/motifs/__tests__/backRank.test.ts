import { describe, expect, it } from 'vitest';
import { findBackRankWeaknesses, isBackRankWeak } from '../backRank';
import { Game } from '../../game';

describe('findBackRankWeaknesses', () => {
  it('returns no weaknesses in the starting position', () => {
    // Pawns are on rank 2/7 — every forward escape square is occupied by an
    // own pawn, so technically both kings are back-rank-weak in our static
    // sense. Sanity check: the detector flags both at the start.
    const g = new Game();
    const out = findBackRankWeaknesses(g);
    expect(out).toHaveLength(2);
  });

  it('detects the classical castled-king weakness (white)', () => {
    // White king g1 with f2/g2/h2 pawns blocking; black king elsewhere with
    // a luft pawn so only white is flagged.
    const g = Game.fromFen('6k1/5pp1/8/8/8/8/5PPP/6K1 w - - 0 1');
    const out = findBackRankWeaknesses(g);
    expect(out).toHaveLength(1);
    expect(out[0].king.color).toBe('w');
    expect(out[0].king.square).toBe('g1');
    expect(out[0].blockedSquares.sort()).toEqual(['f2', 'g2', 'h2']);
  });

  it('does NOT flag a king with luft (giving the king an escape square)', () => {
    // Black king g8 with f7/h7 pawns and g6 free → has luft, not weak.
    // White king has its own back-rank issues — set it up so white isn't
    // weak either (move the king off its back rank).
    const g = Game.fromFen('5rk1/5p1p/6p1/8/8/8/8/4K3 w - - 0 1');
    const out = findBackRankWeaknesses(g);
    expect(out).toEqual([]);
  });

  it('handles a corner king with only two forward squares', () => {
    // White king h1, pawns on g2/h2 — only g2/h2 are in front of h1 (no i2).
    const g = Game.fromFen('8/8/8/8/8/8/6PP/4k2K w - - 0 1');
    const out = findBackRankWeaknesses(g);
    const whiteWeak = out.find((w) => w.king.color === 'w');
    expect(whiteWeak).toBeDefined();
    expect(whiteWeak?.blockedSquares.sort()).toEqual(['g2', 'h2']);
  });

  it('does not flag a king that is not on its back rank', () => {
    // White king on e3 — not on rank 1.
    const g = Game.fromFen('4k3/8/8/8/8/4K3/PPPP1PPP/8 w - - 0 1');
    const whiteWeak = findBackRankWeaknesses(g).find(
      (w) => w.king.color === 'w',
    );
    expect(whiteWeak).toBeUndefined();
  });

  it('does not flag when an enemy piece (not own) sits in front of the king', () => {
    // White king g1, but g2 is a black pawn (not own). f2 own pawn, h2 own
    // pawn — but g2 not blocked by own. So not weak.
    const g = Game.fromFen('6k1/8/8/8/8/8/5PpP/6K1 w - - 0 1');
    expect(isBackRankWeak(g, 'w')).toBe(false);
  });
});
