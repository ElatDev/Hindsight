import type { Game } from '../game';
import { PIECE_VALUE, enemyOf, listPieces, type PieceLocation } from './util';

export type Fork = {
  /** The piece doing the forking. */
  forker: PieceLocation;
  /** The two-or-more enemy targets, each of equal-or-greater value than the
   *  forker. Order is the iteration order of `listPieces` (top-down,
   *  left-to-right) — UI code should not rely on it. */
  targets: PieceLocation[];
};

/**
 * Find all forks in the current position. A fork is a piece that simultaneously
 * attacks **two or more** enemy pieces of equal or greater value. The
 * "equal-or-greater" rule is the standard tactical definition — a knight
 * attacking two pawns isn't a fork, it's just a double attack on minor targets;
 * a knight attacking a queen + rook is.
 *
 * Two simplifications worth flagging:
 * - The forker's legality (e.g. it might be pinned) is not checked. Pin-on-fork
 *   edge cases are rare and the UI consuming this list can cross-reference
 *   `findPins` if needed.
 * - Defenders aren't considered. A "fork" of two undefended pieces and a "fork"
 *   of two defended pieces are both reported — the consumer decides whether
 *   the fork is a winning tactic via the engine's eval, not our heuristics.
 */
export function findForks(game: Game): Fork[] {
  const chess = game.raw();
  const pieces = listPieces(game);

  const forks: Fork[] = [];
  for (const forker of pieces) {
    const myValue = PIECE_VALUE[forker.type];
    const targets: PieceLocation[] = [];
    for (const target of pieces) {
      if (target.color === forker.color) continue;
      if (PIECE_VALUE[target.type] < myValue) continue;
      const attackerSquares = chess.attackers(target.square, forker.color);
      if (attackerSquares.includes(forker.square)) {
        targets.push(target);
      }
    }
    if (targets.length >= 2) {
      forks.push({ forker, targets });
    }
  }
  return forks;
}

/** Filter `findForks` to forks executed by a single side. */
export function findForksBy(game: Game, color: Parameters<typeof enemyOf>[0]) {
  return findForks(game).filter((f) => f.forker.color === color);
}
