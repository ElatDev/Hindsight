import type { Color, Square } from 'chess.js';
import type { Game } from '../game';
import {
  coordToSquare,
  listPieces,
  squareToCoord,
  type PieceLocation,
} from './util';

export type BackRankWeakness = {
  king: PieceLocation;
  /** Forward escape squares (one rank in front of the king's rank) that are
   *  occupied by the king's own pieces — i.e. the missing "luft". */
  blockedSquares: Square[];
};

const BACK_RANK: Record<Color, number> = { w: 0, b: 7 };
const FORWARD_FROM_BACK: Record<Color, number> = { w: 1, b: 6 };

/**
 * Find back-rank weaknesses in the position. A king is back-rank-weak when:
 *   1. It sits on its own back rank (rank 1 for white, rank 8 for black).
 *   2. Every forward escape square (the up-to-three squares directly ahead
 *      on the king's rank-±1) is occupied by one of the king's own pieces.
 *
 * That's the textbook "no luft" pattern that lets a single back-rank check
 * become mate. Whether the opponent actually has a piece in position to
 * deliver it is left to the engine eval — this is a *static* weakness check.
 *
 * Returns one entry per side that has the weakness (so you can flag both
 * sides if both have the issue).
 */
export function findBackRankWeaknesses(game: Game): BackRankWeakness[] {
  const pieces = listPieces(game);
  const occupied = new Map<string, PieceLocation>();
  for (const p of pieces) occupied.set(p.square, p);

  const out: BackRankWeakness[] = [];
  for (const piece of pieces) {
    if (piece.type !== 'k') continue;
    const [kf, kr] = squareToCoord(piece.square);
    if (kr !== BACK_RANK[piece.color]) continue;

    const forwardRank = FORWARD_FROM_BACK[piece.color];
    const candidates: Square[] = [];
    for (const df of [-1, 0, 1] as const) {
      const sq = coordToSquare(kf + df, forwardRank);
      if (sq) candidates.push(sq);
    }
    if (candidates.length === 0) continue; // shouldn't happen for valid kings

    const blocked: Square[] = [];
    for (const sq of candidates) {
      const occ = occupied.get(sq);
      if (occ && occ.color === piece.color) {
        blocked.push(sq);
      }
    }
    if (blocked.length === candidates.length) {
      out.push({ king: piece, blockedSquares: blocked });
    }
  }
  return out;
}

/** Convenience: did `color`'s king have the weakness? */
export function isBackRankWeak(game: Game, color: Color): boolean {
  return findBackRankWeaknesses(game).some((w) => w.king.color === color);
}
