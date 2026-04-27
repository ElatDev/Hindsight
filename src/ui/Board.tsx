import { useMemo, useState } from 'react';
import { Chessboard } from 'react-chessboard';
import type { Square } from 'chess.js';
import type { Game } from '../chess/game';

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

/**
 * Board view backed by react-chessboard. When `onMove` is supplied, supports
 * drag-and-drop with legal-move enforcement and click-to-select with target
 * highlighting; otherwise renders read-only.
 */
export function Board({
  game,
  onMove,
  orientation = 'white',
  width,
}: BoardProps): JSX.Element {
  const [selected, setSelected] = useState<Square | null>(null);
  const interactive = Boolean(onMove);

  const customSquareStyles = useMemo(() => {
    if (!selected) return undefined;
    const styles: Record<string, React.CSSProperties> = {
      [selected]: SELECTED_STYLE,
    };
    for (const move of game.legalMovesFrom(selected)) {
      const isCapture = move.flags.includes('c') || move.flags.includes('e');
      styles[move.to] = isCapture ? LEGAL_CAPTURE_STYLE : LEGAL_TARGET_STYLE;
    }
    return styles;
  }, [game, selected]);

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
    if (!interactive) return;

    if (selected && selected !== square) {
      const moved = tryMove(selected, square, 'q');
      if (moved) return;
    }

    // Either no current selection or the click wasn't a valid target —
    // try selecting the clicked square if it has a piece for the side to move.
    const hasMoves = game.legalMovesFrom(square).length > 0;
    setSelected(hasMoves ? square : null);
  };

  return (
    <Chessboard
      position={game.fen()}
      boardOrientation={orientation}
      boardWidth={width}
      arePiecesDraggable={interactive}
      onPieceDrop={interactive ? handlePieceDrop : undefined}
      onSquareClick={interactive ? handleSquareClick : undefined}
      customSquareStyles={customSquareStyles}
      autoPromoteToQueen
    />
  );
}
