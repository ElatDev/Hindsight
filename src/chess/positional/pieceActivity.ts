import type { Color, Square } from 'chess.js';
import type { Game } from '../game';
import {
  DIAGONAL_RAYS,
  coordToSquare,
  enemyOf,
  listPieces,
  squareToCoord,
  type PieceLocation,
} from '../motifs/util';

export type PieceActivity = {
  /** Knights on outpost squares: in the enemy half of the board, on a square
   *  that no enemy pawn can ever attack (no enemy pawns on adjacent files
   *  ahead of the knight from its perspective). */
  knightOutposts: PieceLocation[];
  /** Rooks on a fully open file (no pawns of either side on the file). */
  rooksOnOpenFiles: PieceLocation[];
  /** Rooks on a semi-open file (no friendly pawns, ≥ 1 enemy pawn). */
  rooksOnSemiOpenFiles: PieceLocation[];
  /** Bishops with at least `BISHOP_LONG_DIAGONAL` empty squares of mobility
   *  along their diagonals. Captures the "good bishop with a long diagonal"
   *  vs. "bad bishop blocked by own pawns" intuition. */
  activeBishops: PieceLocation[];
};

/** Diagonal-mobility threshold above which a bishop counts as "active". */
const BISHOP_LONG_DIAGONAL = 6;

/** Outpost rank ranges per color (in 0-indexed rank space): the enemy half
 *  excluding the back two ranks where outposts add little value. */
const OUTPOST_RANKS: Record<Color, ReadonlyArray<number>> = {
  w: [3, 4, 5], // ranks 4..6
  b: [4, 3, 2], // ranks 5..3
};

/**
 * Static piece-activity scan for both sides. Surfaces the four signals the
 * explanation system uses most: knight outposts, rooks on open / semi-open
 * files, bishops with long diagonals.
 *
 * As with `analyzeKingSafety`, this is structural — engine eval owns the
 * weights. The detector cares about *the pattern being there*, not how much
 * it's worth in centipawns.
 */
export function analyzePieceActivity(game: Game): PieceActivity {
  const pieces = listPieces(game);

  // Group pawns by file once for the rook-file checks.
  const pawnsByFile = new Map<number, PieceLocation[]>();
  for (const p of pieces) {
    if (p.type !== 'p') continue;
    const [f] = squareToCoord(p.square);
    const list = pawnsByFile.get(f) ?? [];
    list.push(p);
    pawnsByFile.set(f, list);
  }

  // Pre-bucket enemy pawns by file for outpost queries.
  const enemyPawnsByFile = (color: Color) => {
    const enemy = enemyOf(color);
    const map = new Map<number, PieceLocation[]>();
    for (const p of pieces) {
      if (p.type !== 'p' || p.color !== enemy) continue;
      const [f] = squareToCoord(p.square);
      const list = map.get(f) ?? [];
      list.push(p);
      map.set(f, list);
    }
    return map;
  };

  const occupied = new Set<Square>(pieces.map((p) => p.square));

  const knightOutposts: PieceLocation[] = [];
  const rooksOnOpenFiles: PieceLocation[] = [];
  const rooksOnSemiOpenFiles: PieceLocation[] = [];
  const activeBishops: PieceLocation[] = [];

  for (const piece of pieces) {
    if (piece.type === 'n') {
      if (isKnightOutpost(piece, enemyPawnsByFile(piece.color))) {
        knightOutposts.push(piece);
      }
    } else if (piece.type === 'r') {
      const [f] = squareToCoord(piece.square);
      const filePawns = pawnsByFile.get(f) ?? [];
      const friendly = filePawns.filter((p) => p.color === piece.color);
      const enemyOnFile = filePawns.filter((p) => p.color !== piece.color);
      if (filePawns.length === 0) {
        rooksOnOpenFiles.push(piece);
      } else if (friendly.length === 0 && enemyOnFile.length > 0) {
        rooksOnSemiOpenFiles.push(piece);
      }
    } else if (piece.type === 'b') {
      if (bishopMobility(piece, occupied) >= BISHOP_LONG_DIAGONAL) {
        activeBishops.push(piece);
      }
    }
  }

  return {
    knightOutposts,
    rooksOnOpenFiles,
    rooksOnSemiOpenFiles,
    activeBishops,
  };
}

function isKnightOutpost(
  knight: PieceLocation,
  enemyPawnsByFile: Map<number, PieceLocation[]>,
): boolean {
  const [f, r] = squareToCoord(knight.square);
  const ranks = OUTPOST_RANKS[knight.color];
  if (!ranks.includes(r)) return false;

  // No enemy pawn on file f-1 or f+1 *ahead* of the knight (from the knight's
  // perspective) can ever attack this square via a future pawn push.
  for (const df of [-1, 1] as const) {
    const file = f + df;
    if (file < 0 || file > 7) continue;
    const enemyPawns = enemyPawnsByFile.get(file) ?? [];
    for (const p of enemyPawns) {
      const [, pr] = squareToCoord(p.square);
      // Enemy pawn is "ahead of" the outpost from the knight's perspective when
      // the pawn could march down to the knight's rank +- 1 and capture.
      const ahead = knight.color === 'w' ? pr > r : pr < r;
      if (ahead) return false;
    }
  }
  return true;
}

function bishopMobility(bishop: PieceLocation, occupied: Set<Square>): number {
  const [bf, br] = squareToCoord(bishop.square);
  let count = 0;
  for (const [df, dr] of DIAGONAL_RAYS) {
    let f = bf + df;
    let r = br + dr;
    for (;;) {
      const sq = coordToSquare(f, r);
      if (!sq) break;
      if (occupied.has(sq)) break;
      count++;
      f += df;
      r += dr;
    }
  }
  return count;
}

/** Convenience: filter to a single side. */
export function analyzePieceActivityFor(
  game: Game,
  color: Color,
): PieceActivity {
  const all = analyzePieceActivity(game);
  return {
    knightOutposts: all.knightOutposts.filter((p) => p.color === color),
    rooksOnOpenFiles: all.rooksOnOpenFiles.filter((p) => p.color === color),
    rooksOnSemiOpenFiles: all.rooksOnSemiOpenFiles.filter(
      (p) => p.color === color,
    ),
    activeBishops: all.activeBishops.filter((p) => p.color === color),
  };
}
