import type { Color } from 'chess.js';
import type { Game } from '../game';
import { enemyOf, listPieces, type PieceLocation } from './util';

export type OverloadedPiece = {
  /** The piece carrying too many duties. */
  defender: PieceLocation;
  /** The own pieces it currently defends that are also under attack. */
  defending: PieceLocation[];
};

/**
 * Find pieces that are simultaneously the sole defender of two or more
 * attacked own pieces. The defender is "overloaded" because it can only
 * recapture once if the opponent strikes both targets.
 *
 * v1 definition: a piece D defending two-or-more own pieces P1, P2 where
 * each Pi is currently attacked by the enemy. We don't compute SEE — the
 * attacked Pi could be defended by other own pieces too — so this is a
 * coarse signal. UI consumers should cross-reference engine eval; this
 * detector exists primarily to help the explanation system surface
 * "removing the defender" tactical themes.
 */
export function findOverloadedPieces(game: Game): OverloadedPiece[] {
  const chess = game.raw();
  const pieces = listPieces(game);

  const out: OverloadedPiece[] = [];
  for (const defender of pieces) {
    if (defender.type === 'k') continue; // kings can't be "captured" to remove them
    const defending: PieceLocation[] = [];
    for (const target of pieces) {
      if (target.color !== defender.color) continue;
      if (target === defender) continue;
      if (target.type === 'k') continue; // kings aren't captured
      const enemy = enemyOf(defender.color);
      const isUnderAttack = chess.isAttacked(target.square, enemy);
      if (!isUnderAttack) continue;
      const defenders = chess.attackers(target.square, defender.color);
      if (defenders.includes(defender.square)) {
        defending.push(target);
      }
    }
    if (defending.length >= 2) {
      out.push({ defender, defending });
    }
  }
  return out;
}

/** Filter to overloaded pieces of one side. */
export function findOverloadedPiecesFor(
  game: Game,
  color: Color,
): OverloadedPiece[] {
  return findOverloadedPieces(game).filter((o) => o.defender.color === color);
}
