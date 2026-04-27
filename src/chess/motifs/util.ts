import type { Color, PieceSymbol, Square } from 'chess.js';
import type { Game } from '../game';

/**
 * Standard piece values in pawns. Kings are sentinel-valued so any tactic
 * involving the king as a "back piece" (e.g. absolute pin) sorts above all
 * non-king tactics. The king's value is irrelevant to capture math because
 * it can't be captured.
 */
export const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

export type PieceLocation = {
  square: Square;
  type: PieceSymbol;
  color: Color;
};

export const enemyOf = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/** Flatten the board to a list of occupied squares. */
export function listPieces(game: Game): PieceLocation[] {
  const board = game.raw().board();
  const out: PieceLocation[] = [];
  for (const row of board) {
    for (const cell of row) {
      if (cell) {
        out.push({
          square: cell.square,
          type: cell.type,
          color: cell.color,
        });
      }
    }
  }
  return out;
}

/** Convert "e4" → [4, 3] (file 0..7, rank 0..7). */
export const squareToCoord = (sq: Square): [number, number] => [
  sq.charCodeAt(0) - 'a'.charCodeAt(0),
  Number.parseInt(sq[1], 10) - 1,
];

/** Convert a [file, rank] back to a `Square`. Out-of-range coords return null. */
export const coordToSquare = (file: number, rank: number): Square | null => {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${String.fromCharCode('a'.charCodeAt(0) + file)}${rank + 1}` as Square;
};

/** Ray directions. Bishops walk diagonals, rooks walk orthogonals, queens both. */
export const DIAGONAL_RAYS: ReadonlyArray<readonly [number, number]> = [
  [-1, -1],
  [-1, 1],
  [1, -1],
  [1, 1],
];
export const ORTHOGONAL_RAYS: ReadonlyArray<readonly [number, number]> = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];
export const ALL_RAYS: ReadonlyArray<readonly [number, number]> = [
  ...DIAGONAL_RAYS,
  ...ORTHOGONAL_RAYS,
];

/** Rays a long-range piece (B/R/Q) can travel. Throws for non-sliders. */
export const slidingRaysFor = (
  type: PieceSymbol,
): ReadonlyArray<readonly [number, number]> => {
  if (type === 'b') return DIAGONAL_RAYS;
  if (type === 'r') return ORTHOGONAL_RAYS;
  if (type === 'q') return ALL_RAYS;
  throw new Error(`slidingRaysFor: ${type} is not a sliding piece`);
};
