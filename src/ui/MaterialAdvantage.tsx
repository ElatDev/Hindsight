import { useMemo } from 'react';
import type { Color, PieceSymbol } from 'chess.js';
import type { Game } from '../chess/game';

export type MaterialAdvantageProps = {
  /** Position to summarise. Anything `chess.js` can give us a board for. */
  game: Game;
  /** Which side this advantage strip belongs to. The strip lists *enemy*
   *  pieces this side has captured, plus the net point delta. */
  side: Color;
};

/** Standard pawn-equivalent values. Same scale used by `analyzeMaterial` —
 *  kept inline here so the strip works without pulling the full positional
 *  module into the play-view bundle. */
const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

/** Starting count of each piece type per side (kings excluded). */
const STARTING_COUNT: Record<Exclude<PieceSymbol, 'k'>, number> = {
  p: 8,
  n: 2,
  b: 2,
  r: 2,
  q: 1,
};

/** Order in which captured pieces show in the strip — heaviest piece first
 *  matches Lichess / chess.com convention. */
const PIECE_ORDER: ReadonlyArray<Exclude<PieceSymbol, 'k'>> = [
  'q',
  'r',
  'b',
  'n',
  'p',
];

/** Unicode glyphs are sufficient for the tiny in-strip icons; no SVGs need
 *  to be bundled. We use the *black* outline pieces against a dim background
 *  so they read on both palettes regardless of which side they belong to. */
const GLYPH: Record<Exclude<PieceSymbol, 'k'>, string> = {
  q: '♛',
  r: '♜',
  b: '♝',
  n: '♞',
  p: '♟',
};

type Counts = Record<Exclude<PieceSymbol, 'k'>, number>;

/**
 * Tally of captures + net advantage, derived from the current position's
 * piece census against starting material. Includes a promotion correction:
 * if a side has more queens than they started with, the surplus are
 * promotions and shouldn't count as "captured queens against the other
 * side". The same logic applies (less commonly) to under-promotions to N
 * / B / R: a surplus on one side cancels a "missing" pawn on the other.
 */
function computeCensus(game: Game): {
  white: Counts;
  black: Counts;
  /** White - Black in pawn-equivalent points. */
  diff: number;
} {
  const white: Counts = { p: 0, n: 0, b: 0, r: 0, q: 0 };
  const black: Counts = { p: 0, n: 0, b: 0, r: 0, q: 0 };

  // Walk every square via chess.js's board grid.
  const board = game.raw().board();
  for (const row of board) {
    for (const sq of row) {
      if (!sq) continue;
      if (sq.type === 'k') continue;
      const bucket = sq.color === 'w' ? white : black;
      bucket[sq.type as Exclude<PieceSymbol, 'k'>]++;
    }
  }

  // Net pawn-equivalent diff. Positive = white ahead, negative = black ahead.
  let diff = 0;
  for (const t of PIECE_ORDER) {
    diff += (white[t] - black[t]) * PIECE_VALUE[t];
  }

  return { white, black, diff };
}

/**
 * Return the list of captured *enemy* piece-types (with multiplicity) for
 * the given side, accounting for promotions. The output is ordered
 * heaviest-first so the strip reads queen → rook → bishop → knight → pawn
 * left to right.
 *
 * Promotion correction: a side with more queens than they started counts
 * the surplus as promoted pawns, not as "queens captured from the
 * opponent". So if Black has 2 queens and White has 1, the second Black
 * queen is a promotion — White is *not* missing a queen at its expense,
 * but White *is* missing the pawn that Black promoted. We model this by
 * trimming the captured-piece list down to the pre-promotion count.
 */
function capturedFromEnemy(
  side: Color,
  white: Counts,
  black: Counts,
): Array<Exclude<PieceSymbol, 'k'>> {
  const enemy = side === 'w' ? black : white;
  const own = side === 'w' ? white : black;

  const out: Array<Exclude<PieceSymbol, 'k'>> = [];
  for (const t of PIECE_ORDER) {
    // How many of this type the enemy has lost vs. their starting count.
    const enemyLost = Math.max(0, STARTING_COUNT[t] - enemy[t]);
    // If we have more than we started with, the surplus are promotions —
    // they don't represent enemy losses. Subtract them so promoted pieces
    // don't double-count.
    const ourSurplus = Math.max(0, own[t] - STARTING_COUNT[t]);
    const captured = Math.max(0, enemyLost - ourSurplus);
    for (let i = 0; i < captured; i += 1) out.push(t);
  }
  return out;
}

/**
 * Material-advantage strip for one side. Shows the captured-enemy-pieces
 * icons inline; trails them with a `+N` numeric delta when this side is up
 * material. When the user is even or behind, the side strip stays
 * intentionally quiet (the *other* strip carries the `+N`); rendering
 * "−1" on the down-side would visually double the same fact.
 */
export function MaterialAdvantage({
  game,
  side,
}: MaterialAdvantageProps): JSX.Element | null {
  const { white, black, diff } = useMemo(() => computeCensus(game), [game]);

  const captured = capturedFromEnemy(side, white, black);
  const sideDiff = side === 'w' ? diff : -diff;

  if (captured.length === 0 && sideDiff <= 0) return null;

  return (
    <div
      className="material-advantage"
      aria-label={`${side === 'w' ? 'White' : 'Black'} captured material`}
    >
      <span className="material-advantage__pieces">
        {captured.map((t, i) => (
          <span
            key={`${t}-${i}`}
            className={`material-advantage__piece material-advantage__piece--${t}`}
            aria-hidden="true"
          >
            {GLYPH[t]}
          </span>
        ))}
      </span>
      {sideDiff > 0 ? (
        <span className="material-advantage__delta">+{sideDiff}</span>
      ) : null}
    </div>
  );
}
