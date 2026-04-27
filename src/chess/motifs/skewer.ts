import type { Color } from 'chess.js';
import type { Game } from '../game';
import {
  PIECE_VALUE,
  coordToSquare,
  listPieces,
  slidingRaysFor,
  squareToCoord,
  type PieceLocation,
} from './util';

export type Skewer = {
  /** Long-range piece (B/R/Q) executing the skewer. */
  skewerer: PieceLocation;
  /** Front enemy piece — the more valuable one that's forced to move. */
  front: PieceLocation;
  /** Back enemy piece — exposed once the front moves. */
  back: PieceLocation;
};

/**
 * Find every skewer in the current position. A skewer is the inverse of a
 * pin: a long-range piece (B/R/Q) aligned through an enemy piece *of greater
 * value* to a less-valuable enemy piece behind it. The front piece is forced
 * to move (or be captured), exposing the back piece.
 *
 * Edge case worth flagging: when the front piece is the king and there's
 * something behind, that's the canonical "absolute skewer" (king has to move
 * out of check, the back piece falls). Kings have value 100 in our table so
 * "front more valuable than back" naturally covers it.
 */
export function findSkewers(game: Game): Skewer[] {
  const pieces = listPieces(game);
  const occupied = new Map<string, PieceLocation>();
  for (const p of pieces) occupied.set(p.square, p);

  const skewers: Skewer[] = [];
  for (const skewerer of pieces) {
    if (
      skewerer.type !== 'b' &&
      skewerer.type !== 'r' &&
      skewerer.type !== 'q'
    ) {
      continue;
    }
    const rays = slidingRaysFor(skewerer.type);
    const [pf, pr] = squareToCoord(skewerer.square);

    for (const [df, dr] of rays) {
      let f = pf + df;
      let r = pr + dr;
      let front: PieceLocation | null = null;
      for (;;) {
        const sq = coordToSquare(f, r);
        if (!sq) break;
        const occ = occupied.get(sq);
        if (occ) {
          if (!front) {
            // First piece on the ray must be enemy.
            if (occ.color === skewerer.color) break;
            front = occ;
          } else {
            // Second piece. Must be enemy AND less valuable than the front.
            if (occ.color === skewerer.color) break;
            if (PIECE_VALUE[occ.type] < PIECE_VALUE[front.type]) {
              skewers.push({ skewerer, front, back: occ });
            }
            break;
          }
        }
        f += df;
        r += dr;
      }
    }
  }
  return skewers;
}

/** Filter to skewers executed by a single side. */
export function findSkewersBy(game: Game, color: Color): Skewer[] {
  return findSkewers(game).filter((s) => s.skewerer.color === color);
}
