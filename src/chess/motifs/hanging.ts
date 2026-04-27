import type { Color, PieceSymbol, Square } from 'chess.js';
import type { Game } from '../game';

export type HangingPiece = {
  square: Square;
  type: PieceSymbol;
  color: Color;
};

const opposite = (c: Color): Color => (c === 'w' ? 'b' : 'w');

/**
 * Find pieces that are attacked but not defended in the current position.
 *
 * "Hanging" here uses the simplest, most defensible definition: any non-king
 * piece on a square attacked by the opposing side and not also defended by
 * its own side. That cleanly catches the common UI need ("highlight the
 * pieces a beginner could just take") without venturing into Static Exchange
 * Evaluation, which v1 doesn't need. Phase 8+ can layer SEE on top to surface
 * "defended but the attacker is cheaper" cases.
 *
 * Kings are excluded — a king under attack is "in check", a separate concept.
 */
export function findHangingPieces(game: Game): HangingPiece[] {
  const chess = game.raw();
  const board = chess.board();
  const hanging: HangingPiece[] = [];

  for (const row of board) {
    for (const cell of row) {
      if (!cell) continue;
      if (cell.type === 'k') continue;
      const enemyAttacks = chess.isAttacked(cell.square, opposite(cell.color));
      if (!enemyAttacks) continue;
      const defended = chess.isAttacked(cell.square, cell.color);
      if (!defended) {
        hanging.push({
          square: cell.square,
          type: cell.type,
          color: cell.color,
        });
      }
    }
  }
  return hanging;
}

/** Filter `findHangingPieces` to a single side. Convenience for "which of my
 *  pieces are hanging?" UI questions. */
export function findHangingPiecesFor(game: Game, color: Color): HangingPiece[] {
  return findHangingPieces(game).filter((p) => p.color === color);
}
