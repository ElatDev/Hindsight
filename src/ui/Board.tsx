import {
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ComponentProps,
} from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
import type { Classification } from '../chess/classify';
import type { Game } from '../chess/game';
import { ArrowOverlay } from './ArrowOverlay';
import { BOARD_PALETTES } from './boardThemes';
import { customPiecesFor } from './pieceSets';
import type { BoardTheme, PieceTheme } from './useSettings';

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
  /** Piece-set key. Defaults to `'cburnett'`. The mapping from key to SVGs
   *  lives in `pieceSets.tsx`. */
  pieceTheme?: PieceTheme;
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
  pieceTheme = 'cburnett',
  autoQueen = true,
}: BoardProps): JSX.Element {
  const customPieces = useMemo(() => customPiecesFor(pieceTheme), [pieceTheme]);
  const palette = BOARD_PALETTES[boardTheme] ?? BOARD_PALETTES.classic;
  const [selected, setSelected] = useState<Square | null>(null);
  const [highlights, setHighlights] = useState<readonly Square[]>([]);
  // User-drawn right-click arrows. Owned by us (not react-chessboard) so we
  // can render them through our SVG overlay — that's what makes knight-jump
  // arrows L-shaped, sideways arrows horizontal, diagonal arrows diagonal,
  // etc. The library's own arrow path renders only straight lines.
  const [userArrows, setUserArrows] = useState<readonly ArrowSpec[]>([]);
  const interactive = Boolean(onMove);
  // Wrapper-div ref so the right-click drag detector can read the deepest
  // square element under the pointer (each square carries a `data-square`
  // attribute the library stamps on every cell).
  const hostRef = useRef<HTMLDivElement | null>(null);
  // Source square of an in-flight right-click drag, set on right-mousedown
  // and consumed on right-mouseup. Refs (not state) because we don't want
  // to re-render between the two events.
  const dragSourceRef = useRef<Square | null>(null);

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

  const clearAnnotations = useCallback((): void => {
    setHighlights([]);
    setUserArrows([]);
  }, []);

  /** Pick the deepest `data-square` element under the event target. The
   *  Chessboard stamps that attribute on every square, so closest()` walks
   *  up from the actual click target (which is usually the piece image or
   *  the inner square `<div>`) until it finds the square wrapper. Returns
   *  the algebraic square name or null when the event hits non-board
   *  chrome (e.g. the promotion dialog overlay). */
  const squareFromEvent = (e: MouseEvent | React.MouseEvent): Square | null => {
    const target = e.target as HTMLElement | null;
    if (!target) return null;
    const sq = target
      .closest<HTMLElement>('[data-square]')
      ?.getAttribute('data-square');
    return sq && sq.length === 2 ? (sq as Square) : null;
  };

  // Right-click drag detection. Mousedown records the source square, mouseup
  // (anywhere — the listener is attached to the document so leaving the
  // board boundary mid-drag still resolves cleanly) decides whether the
  // gesture was a single-square click (toggle highlight) or a drag (toggle
  // arrow). The default context menu is suppressed so right-clicks don't
  // fire the OS popup mid-game.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const onContextMenu = (e: MouseEvent): void => {
      e.preventDefault();
    };

    const onMouseDown = (e: MouseEvent): void => {
      if (e.button !== 2) return;
      const sq = squareFromEvent(e);
      dragSourceRef.current = sq;
    };

    const onMouseUp = (e: MouseEvent): void => {
      if (e.button !== 2) return;
      const source = dragSourceRef.current;
      dragSourceRef.current = null;
      if (!source) return;
      const target = squareFromEvent(e);
      if (!target) return;
      if (source === target) {
        setHighlights((prev) =>
          prev.includes(source)
            ? prev.filter((s) => s !== source)
            : [...prev, source],
        );
      } else {
        setUserArrows((prev) => {
          const idx = prev.findIndex((a) => a[0] === source && a[1] === target);
          if (idx >= 0) return prev.filter((_, i) => i !== idx);
          return [
            ...prev,
            [source, target, RIGHT_CLICK_ARROW_COLOR] as ArrowSpec,
          ];
        });
      }
    };

    host.addEventListener('contextmenu', onContextMenu);
    host.addEventListener('mousedown', onMouseDown);
    // mouseup on the document so a drag that ends outside the board still
    // resolves (otherwise we'd leave the source square armed forever).
    document.addEventListener('mouseup', onMouseUp);

    return () => {
      host.removeEventListener('contextmenu', onContextMenu);
      host.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('mouseup', onMouseUp);
    };
  }, []);

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

  // Both engine-supplied arrows (from props) and user-drawn right-click
  // arrows render through our own SVG overlay. The overlay's geometry
  // module shapes knight jumps as L's, sideways/diagonal/straight arrows
  // as a single line, and reverses for black orientation. The library's
  // own arrow renderer only draws straight lines, so we route everything
  // through the overlay for visual consistency.
  const overlayArrows = useMemo<readonly ArrowSpec[]>(
    () =>
      [...(arrows ?? []), ...userArrows].map(
        (a) => [a[0], a[1], a[2] ?? RIGHT_CLICK_ARROW_COLOR] as ArrowSpec,
      ),
    [arrows, userArrows],
  );

  return (
    <GradeBadgeContext.Provider value={gradeBadge ?? null}>
      <div className="board-arrow-host" ref={hostRef}>
        <Chessboard
          position={game.fen()}
          boardOrientation={orientation}
          boardWidth={width}
          arePiecesDraggable={interactive}
          areArrowsAllowed={false}
          onPieceDrop={interactive ? handlePieceDrop : undefined}
          onPromotionPieceSelect={
            interactive ? handlePromotionPieceSelect : undefined
          }
          onSquareClick={handleSquareClick}
          customSquareStyles={customSquareStyles}
          customSquare={
            SquareWithBadge as unknown as ComponentProps<
              typeof Chessboard
            >['customSquare']
          }
          customPieces={
            customPieces as ComponentProps<typeof Chessboard>['customPieces']
          }
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
