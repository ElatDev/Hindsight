import {
  createContext,
  forwardRef,
  useContext,
  useMemo,
  useState,
  type ComponentProps,
} from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
import type { Classification } from '../chess/classify';
import type { Game } from '../chess/game';
import { ArrowOverlay } from './ArrowOverlay';
import { BOARD_PALETTES } from './boardThemes';
import type { BoardTheme } from './useSettings';

/** `[from, to, color?]` — passed straight through to react-chessboard's
 *  `customArrows`. Color is any CSS color string; library default is amber. */
export type ArrowSpec = readonly [Square, Square, string?];

/** A grade badge to overlay on the destination square of the most recently
 *  played move during review. Drives the on-piece icon (green check on best,
 *  blue spark on sharp, orange `?!` on inaccuracy, red `??` on blunder, …). */
export type GradeBadge = {
  readonly square: Square;
  readonly classification: Classification;
};

export type BoardProps = {
  /** Game whose `fen()` drives the rendered position. */
  game: Game;
  /**
   * Called when the user attempts a move (drag-drop or click-click). Should
   * apply the move via `game.move({...})` and return whether it was legal —
   * `true` keeps the dropped piece on the target square, `false` snaps it
   * back. When omitted, the board is read-only.
   */
  onMove?: (
    from: Square,
    to: Square,
    promotion?: 'q' | 'r' | 'b' | 'n',
  ) => boolean;
  /** Which colour is on the bottom of the board. Defaults to white. */
  orientation?: 'white' | 'black';
  /** Pixel width of the board. Optional; the library auto-sizes if omitted. */
  width?: number;
  /** Optional persistent arrows drawn on top of the board. Used by the review
   *  view to show the engine's preferred move; merges with any user-drawn
   *  right-click arrows owned by the Board itself. */
  arrows?: readonly ArrowSpec[];
  /** Optional on-piece grade badge for the most recent move's destination
   *  square. When set, a small classification-coloured glyph is rendered on
   *  top of the piece occupying that square. */
  gradeBadge?: GradeBadge | null;
  /** Board colour palette key. Defaults to `'classic'` — the chess.com
   *  cream/brown the renderer ships with out of the box. */
  boardTheme?: BoardTheme;
  /** When true, drag-drop promotions auto-pick queen (the default). When
   *  false, react-chessboard's built-in promotion dialog pops up so the
   *  user can under-promote. */
  autoQueen?: boolean;
};

const SELECTED_STYLE = { backgroundColor: 'rgba(255, 233, 99, 0.55)' };
const LEGAL_TARGET_STYLE = {
  background: 'radial-gradient(circle, rgba(0,0,0,0.35) 22%, transparent 24%)',
  borderRadius: '50%',
};
const LEGAL_CAPTURE_STYLE = {
  background:
    'radial-gradient(circle, transparent 56%, rgba(220,40,40,0.55) 58%)',
};
/** Right-click highlight color — Lichess-green at half opacity. Sits under
 *  any selection ring so the user can still see legal-move targets. */
const RIGHT_CLICK_HIGHLIGHT_STYLE = {
  backgroundColor: 'rgba(35, 165, 75, 0.55)',
};
const RIGHT_CLICK_ARROW_COLOR = 'rgba(35, 165, 75, 0.8)';

const GRADE_GLYPH: Record<Classification, string> = {
  sharp: '!!',
  best: '✓',
  excellent: '!',
  good: '·',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  miss: '?!',
  book: 'B',
};

const GradeBadgeContext = createContext<GradeBadge | null>(null);

/**
 * Board view backed by react-chessboard. When `onMove` is supplied, supports
 * drag-and-drop with legal-move enforcement and click-to-select with target
 * highlighting; otherwise renders read-only. Right-click on a square toggles
 * a Lichess-style green highlight; right-click drag toggles a green arrow.
 * Both persist across moves and are cleared on left-click.
 */
export function Board({
  game,
  onMove,
  orientation = 'white',
  width,
  arrows,
  gradeBadge,
  boardTheme = 'classic',
  autoQueen = true,
}: BoardProps): JSX.Element {
  const palette = BOARD_PALETTES[boardTheme] ?? BOARD_PALETTES.classic;
  const [selected, setSelected] = useState<Square | null>(null);
  const [highlights, setHighlights] = useState<readonly Square[]>([]);
  const interactive = Boolean(onMove);

  const customSquareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    for (const sq of highlights) styles[sq] = RIGHT_CLICK_HIGHLIGHT_STYLE;
    if (selected) {
      styles[selected] = SELECTED_STYLE;
      for (const move of game.legalMovesFrom(selected)) {
        const isCapture = move.flags.includes('c') || move.flags.includes('e');
        styles[move.to] = isCapture ? LEGAL_CAPTURE_STYLE : LEGAL_TARGET_STYLE;
      }
    }
    return Object.keys(styles).length > 0 ? styles : undefined;
  }, [game, selected, highlights]);

  const clearAnnotations = (): void => {
    setHighlights([]);
  };

  const tryMove = (
    from: Square,
    to: Square,
    promotion?: 'q' | 'r' | 'b' | 'n',
  ): boolean => {
    if (!onMove) return false;
    const ok = onMove(from, to, promotion);
    if (ok) setSelected(null);
    return ok;
  };

  const handlePieceDrop = (
    sourceSquare: Square,
    targetSquare: Square,
    piece: string,
  ): boolean => {
    // The library uses pieces like `wP`, `bN`, `wQ`, etc. The fifth char of
    // a promotion drag is the chosen piece (e.g. `wQ` after the picker);
    // for non-promotion drags it's the moving piece's type. Either way the
    // letter we want is `piece[1]` lowercased — `q`/`r`/`b`/`n` for the
    // promotion path, anything else (`k`/`p`) means the move isn't a
    // promotion and chess.js ignores the `promotion` field.
    const promo = piece[1]?.toLowerCase();
    const promotion: 'q' | 'r' | 'b' | 'n' =
      promo === 'r' || promo === 'b' || promo === 'n' ? promo : 'q';
    return tryMove(sourceSquare, targetSquare, promotion);
  };

  // Library callback when the user picks a piece from the promotion popup.
  // Returning `true` tells the library the move was accepted; we apply it
  // through our own `tryMove` so the caller's `onMove` runs with the right
  // promotion type.
  const handlePromotionPieceSelect = (
    piece: string | undefined,
    fromSquare: Square | undefined,
    toSquare: Square | undefined,
  ): boolean => {
    if (!piece || !fromSquare || !toSquare) return false;
    const promo = piece[1]?.toLowerCase();
    const promotion: 'q' | 'r' | 'b' | 'n' =
      promo === 'r' || promo === 'b' || promo === 'n' || promo === 'q'
        ? promo
        : 'q';
    return tryMove(fromSquare, toSquare, promotion);
  };

  const handleSquareClick = (square: Square): void => {
    // Lichess convention: any left-click clears persistent annotations,
    // including read-only review boards where there's no move to make.
    clearAnnotations();
    if (!interactive) return;

    if (selected && selected !== square) {
      const moved = tryMove(selected, square, 'q');
      if (moved) return;
    }

    const hasMoves = game.legalMovesFrom(square).length > 0;
    setSelected(hasMoves ? square : null);
  };

  const handleSquareRightClick = (square: Square): void => {
    setHighlights((prev) =>
      prev.includes(square)
        ? prev.filter((s) => s !== square)
        : [...prev, square],
    );
  };

  // Engine-supplied arrows (from props) are the only ones we render via our
  // SVG overlay — that's what carries the Lichess-style L-shape for knight
  // moves. User-drawn right-click arrows go through react-chessboard's own
  // mechanism: the library tracks the gesture, stores the resulting arrow
  // in private state, and renders it with `customArrowColor`. We can't
  // intercept that flow (`onArrowsChange` only echoes prop-driven arrows on
  // this version, not user drags), so trying to layer L-shapes on top of
  // user-drawn arrows is more complexity than the visual win is worth.
  // Right-click arrows are straight-line green; engine arrows are L-shaped
  // blue. Both are valid Lichess-style.
  const overlayArrows = useMemo<readonly ArrowSpec[]>(
    () =>
      (arrows ?? []).map(
        (a) => [a[0], a[1], a[2] ?? RIGHT_CLICK_ARROW_COLOR] as ArrowSpec,
      ),
    [arrows],
  );

  // Hand react-chessboard a coloured-transparent copy of the engine arrows
  // so it knows about them (e.g. for click-fall-through behaviour) but
  // doesn't actually paint them — our overlay owns that drawing. Pass
  // `undefined` when there's nothing to declare so the library can stay in
  // its own arrow-management mode for user drags.
  const libraryArrows = useMemo(() => {
    if (overlayArrows.length === 0) return undefined;
    return overlayArrows.map(
      (a) => [a[0], a[1], 'transparent'] as [Square, Square, string],
    );
  }, [overlayArrows]);

  return (
    <GradeBadgeContext.Provider value={gradeBadge ?? null}>
      <div className="board-arrow-host">
        <Chessboard
          position={game.fen()}
          boardOrientation={orientation}
          boardWidth={width}
          arePiecesDraggable={interactive}
          onPieceDrop={interactive ? handlePieceDrop : undefined}
          onPromotionPieceSelect={
            interactive ? handlePromotionPieceSelect : undefined
          }
          onSquareClick={handleSquareClick}
          onSquareRightClick={handleSquareRightClick}
          customSquareStyles={customSquareStyles}
          customSquare={
            SquareWithBadge as unknown as ComponentProps<
              typeof Chessboard
            >['customSquare']
          }
          customArrows={libraryArrows}
          customArrowColor={RIGHT_CLICK_ARROW_COLOR}
          customLightSquareStyle={{ backgroundColor: palette.light }}
          customDarkSquareStyle={{ backgroundColor: palette.dark }}
          animationDuration={250}
          autoPromoteToQueen={autoQueen}
        />
        <ArrowOverlay
          arrows={overlayArrows}
          orientation={orientation}
          defaultColor={RIGHT_CLICK_ARROW_COLOR}
        />
      </div>
    </GradeBadgeContext.Provider>
  );
}

/**
 * Custom square renderer wired through `customSquare`. react-chessboard calls
 * this for every square on every render; the wrapper conditionally overlays
 * a grade badge when the active context value matches the square. Defined at
 * module scope (stable component identity) so the library doesn't unmount /
 * remount squares on parent re-renders.
 */
const SquareWithBadge = forwardRef<
  HTMLDivElement,
  {
    children?: React.ReactNode;
    square: Square;
    squareColor: 'white' | 'black';
    style: Record<string, string | number>;
  }
>(({ children, square, style }, ref) => {
  const badge = useContext(GradeBadgeContext);
  const showBadge = badge?.square === square;
  return (
    <div ref={ref} style={{ ...style, position: 'relative' }}>
      {children}
      {showBadge ? (
        <span
          className={`board-grade-badge board-grade-badge--${badge.classification}`}
          aria-label={badge.classification}
        >
          {GRADE_GLYPH[badge.classification]}
        </span>
      ) : null}
    </div>
  );
});
SquareWithBadge.displayName = 'BoardSquare';
