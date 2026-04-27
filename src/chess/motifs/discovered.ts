import type { Color, Square } from 'chess.js';
import { Game } from '../game';
import { enemyOf, listPieces, type PieceLocation } from './util';

export type DiscoveredAttack = {
  /** The piece that was unblocked by the move. Always belongs to the
   *  side that just moved. */
  attacker: PieceLocation;
  /** Enemy piece that's now under attack from `attacker` and wasn't before
   *  the move. */
  target: PieceLocation;
  /** True when the discovered attack is on the enemy king (i.e. discovered
   *  check). False for any other discovered attack. */
  isCheck: boolean;
};

type AttackEdge = `${string}->${string}`; // `${attacker}->${target}`

/**
 * Compute every (attacker, target) pair where `attacker` is a piece of
 * `byColor` directly attacking an enemy-occupied square `target`. Empty
 * squares are not targets — discovered attacks are only meaningful when
 * something would be captured.
 */
function attackEdges(game: Game, byColor: Color): Set<AttackEdge> {
  const chess = game.raw();
  const edges = new Set<AttackEdge>();
  const enemy = enemyOf(byColor);
  for (const target of listPieces(game)) {
    if (target.color !== enemy) continue;
    const attackers = chess.attackers(target.square, byColor);
    for (const aSq of attackers) {
      edges.add(`${aSq}->${target.square}` as AttackEdge);
    }
  }
  return edges;
}

const decode = (edge: AttackEdge): { attackerSq: Square; targetSq: Square } => {
  const [attackerSq, targetSq] = edge.split('->') as [Square, Square];
  return { attackerSq, targetSq };
};

/**
 * Identify discovered attacks (and discovered checks) caused by `moveSan`
 * being played from `before`. A discovered attack is a *new* attack edge
 * (attacker, target) in the post-move position where the attacker is **not**
 * the piece that just moved — i.e. a teammate whose line was unblocked.
 *
 * Discovered checks are flagged via `isCheck: true` (target was the enemy
 * king). Direct checks delivered by the moving piece itself are NOT
 * discovered checks; they're filtered out.
 *
 * Returns an empty array when the move is illegal at `before` or when no
 * teammate's attack set grew.
 */
export function findDiscoveredAttacks(
  before: Game,
  moveSan: string,
): DiscoveredAttack[] {
  const moverColor = before.turn();
  // Replay the position so we don't mutate the caller's game.
  const replay = Game.fromFen(before.fen());
  const move = replay.move(moveSan);
  if (!move) return [];

  const beforeEdges = attackEdges(before, moverColor);
  const afterEdges = attackEdges(replay, moverColor);
  const movedToSquare = move.to;

  const piecesAfter = listPieces(replay);
  const pieceAt = (sq: Square): PieceLocation | undefined =>
    piecesAfter.find((p) => p.square === sq);

  const enemyKingSq = piecesAfter.find(
    (p) => p.type === 'k' && p.color !== moverColor,
  )?.square;

  const out: DiscoveredAttack[] = [];
  for (const edge of afterEdges) {
    if (beforeEdges.has(edge)) continue;
    const { attackerSq, targetSq } = decode(edge);
    if (attackerSq === movedToSquare) continue; // direct attack by the mover
    const attacker = pieceAt(attackerSq);
    const target = pieceAt(targetSq);
    if (!attacker || !target) continue;
    out.push({
      attacker,
      target,
      isCheck: targetSq === enemyKingSq,
    });
  }
  return out;
}

/** Convenience predicate: was the move a discovered check? */
export function isDiscoveredCheck(before: Game, moveSan: string): boolean {
  return findDiscoveredAttacks(before, moveSan).some((a) => a.isCheck);
}
