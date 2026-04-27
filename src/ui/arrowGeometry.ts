/**
 * Phase 12 / Task 9 — geometry helpers for the SVG arrow overlay. Pure
 * functions: take square names + board orientation, return SVG path data
 * (and arrowhead anchor) in board-percent coordinates so the overlay can
 * size itself from a single square (1 unit = `100/8`% of the board).
 *
 * Conventions:
 *   - Coordinate space is `[0, 100] × [0, 100]`, top-left origin (matches
 *     SVG defaults). The overlay container is sized to match the board's
 *     bounding box.
 *   - "Knight" arrows take a perpendicular L: the long leg first along the
 *     axis with the larger displacement (so a knight from b1 to c3 goes up
 *     two ranks first, then sideways one file). The short leg ends with the
 *     arrowhead. Mirrors Lichess's convention.
 */

import type { Square } from 'chess.js';

export type Orientation = 'white' | 'black';

export type Point = { x: number; y: number };

/** Centre point of the given square in board-percent coordinates. White-
 *  orientation places a1 at the bottom-left; black-orientation flips both
 *  axes so a1 sits top-right. */
export function squareCenter(square: Square, orientation: Orientation): Point {
  const file = square.charCodeAt(0) - 'a'.charCodeAt(0); // 0..7
  const rank = Number(square[1]) - 1; // 0..7
  const colFromLeft = orientation === 'white' ? file : 7 - file;
  const rowFromTop = orientation === 'white' ? 7 - rank : rank;
  const cell = 100 / 8;
  return {
    x: cell * (colFromLeft + 0.5),
    y: cell * (rowFromTop + 0.5),
  };
}

/** True for the eight knight jumps (any (1,2) / (2,1) move). */
export function isKnightJump(from: Square, to: Square): boolean {
  const df = Math.abs(from.charCodeAt(0) - to.charCodeAt(0));
  const dr = Math.abs(Number(from[1]) - Number(to[1]));
  return (df === 1 && dr === 2) || (df === 2 && dr === 1);
}

export type ArrowPath = {
  /** SVG `d` attribute. For straight arrows: a single line. For knight
   *  jumps: two perpendicular segments that meet at a corner. The path
   *  geometry is positioned so the overlay's `marker-end` arrowhead lands
   *  on the destination square's edge, not its centre. */
  d: string;
  /** Stroke width as a percentage of board width. Lichess uses ~12% of a
   *  cell (= 1.5% of the board). */
  strokeWidth: number;
};

/**
 * Build the SVG `d` for an arrow from `from` to `to`. The line is shortened
 * on the destination side so the arrowhead doesn't overshoot the square's
 * centre — produces the Lichess look where the arrow points *at* the centre
 * rather than terminating beyond it.
 */
export function arrowPath(
  from: Square,
  to: Square,
  orientation: Orientation,
): ArrowPath {
  const a = squareCenter(from, orientation);
  const b = squareCenter(to, orientation);
  const cell = 100 / 8;
  const strokeWidth = cell * 0.18; // ~2.25% of board

  if (isKnightJump(from, to)) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    // Long leg first along the axis of larger displacement so the corner
    // sits at the same colour-rank as the knight's destination — matches
    // the Lichess convention so users coming from there don't relearn it.
    const longAlongY = Math.abs(dy) >= Math.abs(dx);
    const corner: Point = longAlongY ? { x: a.x, y: b.y } : { x: b.x, y: a.y };

    // Pull the endpoint back along the short leg so the arrowhead sits
    // visibly inside the destination square.
    const endVec = { x: b.x - corner.x, y: b.y - corner.y };
    const endLen = Math.hypot(endVec.x, endVec.y) || 1;
    const trim = cell * 0.3;
    const end: Point = {
      x: b.x - (endVec.x / endLen) * trim,
      y: b.y - (endVec.y / endLen) * trim,
    };
    return {
      d: `M ${fmt(a.x)} ${fmt(a.y)} L ${fmt(corner.x)} ${fmt(corner.y)} L ${fmt(end.x)} ${fmt(end.y)}`,
      strokeWidth,
    };
  }

  // Straight arrow: trim the head so it terminates short of the centre.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const trim = cell * 0.3;
  const end: Point = {
    x: b.x - (dx / len) * trim,
    y: b.y - (dy / len) * trim,
  };
  return {
    d: `M ${fmt(a.x)} ${fmt(a.y)} L ${fmt(end.x)} ${fmt(end.y)}`,
    strokeWidth,
  };
}

/** Trim trailing zeros to keep the SVG `d` short and stable across renders. */
function fmt(n: number): string {
  return n.toFixed(2).replace(/\.?0+$/, '');
}
