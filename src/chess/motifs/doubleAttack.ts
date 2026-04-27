import type { Color } from 'chess.js';
import type { Game } from '../game';
import { listPieces, type PieceLocation } from './util';

export type DoubleAttack = {
  /** The piece making 2+ simultaneous attacks. */
  attacker: PieceLocation;
  /** Two-or-more enemy pieces being attacked. Any combination of values. */
  targets: PieceLocation[];
};

/**
 * Find every "double attack" in the position: a piece attacking two or more
 * enemy pieces of any value. This is the value-agnostic cousin of `findForks`
 * — a fork requires the targets to be of equal-or-greater value than the
 * attacker, while a double attack just requires two simultaneous threats.
 *
 * Use this for tactical motifs where the threat is creating two problems for
 * the opponent (e.g. attack a rook + threaten mate); use `findForks` for the
 * narrower "winning material via value differential" pattern.
 */
export function findDoubleAttacks(game: Game): DoubleAttack[] {
  const chess = game.raw();
  const pieces = listPieces(game);

  const out: DoubleAttack[] = [];
  for (const attacker of pieces) {
    const targets: PieceLocation[] = [];
    for (const target of pieces) {
      if (target.color === attacker.color) continue;
      const attackerSquares = chess.attackers(target.square, attacker.color);
      if (attackerSquares.includes(attacker.square)) {
        targets.push(target);
      }
    }
    if (targets.length >= 2) {
      out.push({ attacker, targets });
    }
  }
  return out;
}

/** Filter to double-attacks executed by a single side. */
export function findDoubleAttacksBy(game: Game, color: Color): DoubleAttack[] {
  return findDoubleAttacks(game).filter((d) => d.attacker.color === color);
}
