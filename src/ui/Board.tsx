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
}: BoardProps): JSX.Element {
  const [selected, setSelected] = useState<Square | null>(null);
  const [highlights, setHighlights] = useState<readonly Square[]>([]);
  const [userArrows, setUserArrows] = useState<readonly ArrowSpec[]>([]);
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
    setUserArrows([]);
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
  ): boolean => tryMove(sourceSquare, targetSquare, 'q');

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

  // react-chessboard fires `onArrowsChange` whenever its internal arrow set
  // changes — including when we update `customArrows` (which calls the
  // library's `clearArrows`, immediately firing back with `[]`). Treat
  // empty-array calls as the post-prop-update echo and ignore them.
  // Non-empty calls are user-drawn arrows; toggle each into our state.
  const handleArrowsChange = (libArrows: ArrowSpec[]): void => {
    if (libArrows.length === 0) return;
    setUserArrows((prev) => {
      const next = [...prev];
      for (const arrow of libArrows) {
        const idx = next.findIndex(
          (a) => a[0] === arrow[0] && a[1] === arrow[1],
        );
        if (idx >= 0) next.splice(idx, 1);
        else next.push(arrow);
      }
      return next;
    });
  };

  // react-chessboard mutates the `customArrows` array (filters in place), so
  // hand it a fresh mutable copy each render. Engine arrows from props come
  // first so the user's overlay sits on top.
  const customArrows = useMemo(() => {
    const all = [...(arrows ?? []), ...userArrows];
    if (all.length === 0) return undefined;
    return all.map((a) => [...a]) as [Square, Square, string?][];
  }, [arrows, userArrows]);

  return (
    <GradeBadgeContext.Provider value={gradeBadge ?? null}>
      <Chessboard
        position={game.fen()}
        boardOrientation={orientation}
        boardWidth={width}
        arePiecesDraggable={interactive}
        onPieceDrop={interactive ? handlePieceDrop : undefined}
        onSquareClick={handleSquareClick}
        onSquareRightClick={handleSquareRightClick}
        onArrowsChange={handleArrowsChange}
        customSquareStyles={customSquareStyles}
        customSquare={
          SquareWithBadge as unknown as ComponentProps<
            typeof Chessboard
          >['customSquare']
        }
        customArrows={customArrows}
        customArrowColor={RIGHT_CLICK_ARROW_COLOR}
        autoPromoteToQueen
      />
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
