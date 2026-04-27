import type { Color, PieceSymbol } from 'chess.js';
import type { Game } from '../game';
import { PIECE_VALUE, listPieces } from '../motifs/util';

/** Per-side piece tally (kings excluded — every legal position has exactly one). */
export type PieceCount = {
  p: number;
  n: number;
  b: number;
  r: number;
  q: number;
};

export type MaterialImbalance = {
  /** Raw piece counts per side. */
  white: PieceCount;
  black: PieceCount;
  /** Total pawn-equivalent value per side (kings excluded). */
  whiteValue: number;
  blackValue: number;
  /** `whiteValue - blackValue`. Positive = white ahead. */
  diff: number;
  /** True when one side has both bishops and the other doesn't.
   *  The side holding the pair is named. */
  bishopPair: Color | null;
  /** Per-piece count delta: `white[type] - black[type]`. Useful for
   *  describing imbalances like "extra knight" or "exchange up". */
  countDelta: PieceCount;
};

const PIECE_TYPES: ReadonlyArray<keyof PieceCount> = ['p', 'n', 'b', 'r', 'q'];

/**
 * Material balance summary. Counts each side's pieces, sums their pawn-
 * equivalent values, and surfaces the bishop pair as a separate flag (it's
 * the imbalance most commonly worth mentioning that a raw value-sum hides).
 *
 * The valuation is intentionally simplistic — pawn=1, N=B=3, R=5, Q=9 from
 * `PIECE_VALUE` — because anything more nuanced (positional weights, pair
 * bonuses, endgame-specific values) is the engine's job. This module is for
 * generating the summary line "you're up a knight for a pawn", not for
 * driving move choice.
 */
export function analyzeMaterial(game: Game): MaterialImbalance {
  const pieces = listPieces(game);
  const white: PieceCount = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const black: PieceCount = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  for (const piece of pieces) {
    if (piece.type === 'k') continue;
    const bucket = piece.color === 'w' ? white : black;
    bucket[piece.type as keyof PieceCount]++;
  }

  const whiteValue = totalValue(white);
  const blackValue = totalValue(black);

  let bishopPair: Color | null = null;
  if (white.b >= 2 && black.b < 2) bishopPair = 'w';
  else if (black.b >= 2 && white.b < 2) bishopPair = 'b';

  const countDelta: PieceCount = {
    p: white.p - black.p,
    n: white.n - black.n,
    b: white.b - black.b,
    r: white.r - black.r,
    q: white.q - black.q,
  };

  return {
    white,
    black,
    whiteValue,
    blackValue,
    diff: whiteValue - blackValue,
    bishopPair,
    countDelta,
  };
}

function totalValue(count: PieceCount): number {
  let total = 0;
  for (const t of PIECE_TYPES) {
    total += count[t] * PIECE_VALUE[t as PieceSymbol];
  }
  return total;
}
