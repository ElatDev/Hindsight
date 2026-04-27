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

export type PinKind = 'absolute' | 'relative';

export type Pin = {
  /** Long-range piece (B/R/Q) doing the pinning. */
  pinner: PieceLocation;
  /** The pinned enemy piece in front. */
  pinned: PieceLocation;
  /** The piece being shielded behind the pinned piece. King for absolute
   *  pins, anything more valuable than the pinned piece for relative. */
  behind: PieceLocation;
  kind: PinKind;
};

/**
 * Find every pin in the current position. A pin is a long-range piece (B/R/Q)
 * aligned through an enemy piece to a more valuable enemy piece behind it.
 * Absolute pin = back piece is the king (the pinned piece can't legally move
 * off the line). Relative pin = back piece is more valuable, but the pinned
 * piece can still move legally (just at material cost).
 *
 * The detector ignores pins-by-non-sliders (impossible) and pins where the
 * "back" piece is of equal or lesser value (those are fork/skewer territory).
 */
export function findPins(game: Game): Pin[] {
  const pieces = listPieces(game);
  const occupied = new Map<string, PieceLocation>();
  for (const p of pieces) occupied.set(p.square, p);

  const pins: Pin[] = [];
  for (const pinner of pieces) {
    if (pinner.type !== 'b' && pinner.type !== 'r' && pinner.type !== 'q') {
      continue;
    }
    const rays = slidingRaysFor(pinner.type);
    const [pf, pr] = squareToCoord(pinner.square);

    for (const [df, dr] of rays) {
      // Walk the ray. First piece encountered must be enemy → pin candidate.
      // Continue past it; if we then hit an enemy of greater value, it's a pin.
      let f = pf + df;
      let r = pr + dr;
      let candidate: PieceLocation | null = null;
      for (;;) {
        const sq = coordToSquare(f, r);
        if (!sq) break;
        const occ = occupied.get(sq);
        if (occ) {
          if (!candidate) {
            // First piece on the ray.
            if (occ.color === pinner.color) break; // own piece blocks; no pin
            candidate = occ;
          } else {
            // Second piece on the ray.
            if (occ.color === pinner.color) break; // own piece behind enemy; no pin
            const candidateValue = PIECE_VALUE[candidate.type];
            const behindValue = PIECE_VALUE[occ.type];
            if (occ.type === 'k') {
              pins.push({
                pinner,
                pinned: candidate,
                behind: occ,
                kind: 'absolute',
              });
            } else if (behindValue > candidateValue) {
              pins.push({
                pinner,
                pinned: candidate,
                behind: occ,
                kind: 'relative',
              });
            }
            break;
          }
        }
        f += df;
        r += dr;
      }
    }
  }
  return pins;
}

/** Filter `findPins` to pins inflicted by a single side. */
export function findPinsBy(game: Game, color: Color): Pin[] {
  return findPins(game).filter((p) => p.pinner.color === color);
}
