import type { Color } from 'chess.js';
import type { Game } from '../game';
import {
  coordToSquare,
  listPieces,
  squareToCoord,
  type PieceLocation,
} from '../motifs/util';

export type PawnStructure = {
  /** Pawns sharing a file with a friendly pawn. */
  doubled: PieceLocation[];
  /** Pawns with no friendly pawns on adjacent files. */
  isolated: PieceLocation[];
  /** Pawns where the next push square is attacked by an enemy pawn and no
   *  friendly pawn on an adjacent file is at or behind the pawn's rank to
   *  back it up. */
  backward: PieceLocation[];
  /** Pawns with no enemy pawns on the same or adjacent files between them
   *  and promotion. */
  passed: PieceLocation[];
};

/** "Forward" direction in rank space (white = +1, black = -1). */
const FORWARD: Record<Color, number> = { w: 1, b: -1 };

/**
 * Classify pawns of `color` into the four standard structural buckets:
 * doubled, isolated, backward, passed. Each pawn can land in zero, one, or
 * several buckets — a pawn could be both isolated and passed, for instance.
 *
 * Definitions:
 * - **Doubled**: ≥ 2 friendly pawns on the same file. All such pawns
 *   are listed (not just the rear one).
 * - **Isolated**: no friendly pawns on either adjacent file (any rank).
 * - **Backward**: cannot safely advance — the push square is attacked by
 *   an enemy pawn — and no friendly pawn on an adjacent file sits at or
 *   behind this pawn's rank to support a future advance.
 * - **Passed**: clear path to promotion — no enemy pawns on this pawn's
 *   file or either adjacent file, on any square ahead.
 */
export function analyzePawnStructure(game: Game, color: Color): PawnStructure {
  const allPieces = listPieces(game);
  const ourPawns = allPieces.filter((p) => p.type === 'p' && p.color === color);
  const enemyPawns = allPieces.filter(
    (p) => p.type === 'p' && p.color !== color,
  );

  // Group friendly pawns by file (0..7) for fast queries.
  const ourFiles = new Map<number, PieceLocation[]>();
  for (const p of ourPawns) {
    const [f] = squareToCoord(p.square);
    const list = ourFiles.get(f) ?? [];
    list.push(p);
    ourFiles.set(f, list);
  }

  const doubled: PieceLocation[] = [];
  const isolated: PieceLocation[] = [];
  const backward: PieceLocation[] = [];
  const passed: PieceLocation[] = [];

  for (const pawn of ourPawns) {
    const [f, r] = squareToCoord(pawn.square);
    const dir = FORWARD[color];

    // Doubled: another friendly pawn on the same file.
    if ((ourFiles.get(f)?.length ?? 0) >= 2) {
      doubled.push(pawn);
    }

    // Isolated: no friendly pawns on adjacent files.
    const leftPawns = ourFiles.get(f - 1) ?? [];
    const rightPawns = ourFiles.get(f + 1) ?? [];
    if (leftPawns.length === 0 && rightPawns.length === 0) {
      isolated.push(pawn);
    }

    // Passed: no enemy pawns on this file or either adjacent file ahead.
    const passedClear = enemyPawns.every((e) => {
      const [ef, er] = squareToCoord(e.square);
      if (Math.abs(ef - f) > 1) return true;
      // "Ahead" in our pawn's direction.
      return color === 'w' ? er <= r : er >= r;
    });
    if (passedClear) passed.push(pawn);

    // Backward: push square attacked by enemy pawn AND no support on
    // adjacent files at or behind our pawn's rank.
    const pushRank = r + dir;
    const pushSquare = coordToSquare(f, pushRank);
    if (pushSquare) {
      const enemyAttackingPushSquare = enemyPawns.some((e) => {
        const [ef, er] = squareToCoord(e.square);
        // Enemy pawn attacks (ef-1, er-dir) and (ef+1, er-dir) (since enemy
        // moves opposite direction). Equivalently: enemy on (f-1, pushRank+dir)
        // or (f+1, pushRank+dir) attacks pushSquare.
        return (ef === f - 1 || ef === f + 1) && er === pushRank + dir;
      });
      if (enemyAttackingPushSquare) {
        const supportFromAdjacent = [...leftPawns, ...rightPawns].some((p) => {
          const [, pr] = squareToCoord(p.square);
          return color === 'w' ? pr <= r : pr >= r;
        });
        if (!supportFromAdjacent) backward.push(pawn);
      }
    }
  }

  return { doubled, isolated, backward, passed };
}
