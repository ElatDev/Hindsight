import type { Color, Square } from 'chess.js';
import type { Game } from '../game';
import {
  coordToSquare,
  enemyOf,
  listPieces,
  squareToCoord,
  type PieceLocation,
} from '../motifs/util';

export type KingSafety = {
  king: PieceLocation;
  /** Files in the king's neighbourhood (king's file ± 1) with no friendly
   *  pawns — these are funnels through which heavy pieces can reach the king. */
  openNearbyFiles: number[];
  /** Squares in the pawn shield directly in front of the king that *should*
   *  hold a friendly pawn but don't. The shield is the up-to-three squares
   *  on the rank immediately ahead of the king at file ± 1 and the king's
   *  own file. */
  missingShieldSquares: Square[];
  /** Enemy attackers landing on the king's ring (the 8 squares around the
   *  king plus the king's own square). Counted with multiplicity per
   *  attacker piece, not per square. */
  attackerCount: number;
  /** Aggregate exposure metric: `openNearbyFiles + missingShieldSquares +
   *  attackerCount`. Higher = less safe. Tuned for ordering moves by danger,
   *  not as an absolute centipawn estimate — engine eval owns that. */
  exposure: number;
};

/** "One rank ahead" of the king, in the side's forward direction. */
const FORWARD: Record<Color, number> = { w: 1, b: -1 };

/**
 * Score king safety for `color` in the current position. The output is a
 * coarse static signal — three composable checks (open files near the king,
 * missing pawn shield, raw attacker count on the king ring) plus a summed
 * `exposure` field for quick ordering.
 *
 * This deliberately does *not* try to model king-attack potential the way an
 * engine does (no king-zone weights, no attacker-piece values). Those belong
 * in Stockfish's eval. What this gives us is the structural picture the
 * explanation system needs ("the long diagonal to the king is open",
 * "the f-pawn has moved").
 *
 * Returns `null` if the side has no king on the board (shouldn't happen in
 * a legal position; defensive against odd FEN inputs).
 */
export function analyzeKingSafety(game: Game, color: Color): KingSafety | null {
  const chess = game.raw();
  const pieces = listPieces(game);
  const king = pieces.find((p) => p.type === 'k' && p.color === color);
  if (!king) return null;

  const [kf, kr] = squareToCoord(king.square);
  const dir = FORWARD[color];

  const ourPawns = pieces.filter((p) => p.type === 'p' && p.color === color);
  const pawnFiles = new Set<number>();
  for (const p of ourPawns) pawnFiles.add(squareToCoord(p.square)[0]);

  const openNearbyFiles: number[] = [];
  for (const df of [-1, 0, 1] as const) {
    const f = kf + df;
    if (f < 0 || f > 7) continue;
    if (!pawnFiles.has(f)) openNearbyFiles.push(f);
  }

  const shieldRank = kr + dir;
  const missingShieldSquares: Square[] = [];
  if (shieldRank >= 0 && shieldRank <= 7) {
    const ourPawnSquares = new Set(ourPawns.map((p) => p.square));
    for (const df of [-1, 0, 1] as const) {
      const sq = coordToSquare(kf + df, shieldRank);
      if (!sq) continue;
      if (!ourPawnSquares.has(sq)) missingShieldSquares.push(sq);
    }
  }

  const enemy = enemyOf(color);
  let attackerCount = 0;
  const seenAttackers = new Set<Square>();
  for (let df = -1; df <= 1; df++) {
    for (let dr = -1; dr <= 1; dr++) {
      const sq = coordToSquare(kf + df, kr + dr);
      if (!sq) continue;
      const attackers = chess.attackers(sq, enemy);
      for (const a of attackers) {
        if (!seenAttackers.has(a)) {
          seenAttackers.add(a);
          attackerCount++;
        }
      }
    }
  }

  const exposure =
    openNearbyFiles.length + missingShieldSquares.length + attackerCount;

  return {
    king,
    openNearbyFiles,
    missingShieldSquares,
    attackerCount,
    exposure,
  };
}
