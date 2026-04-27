import { Chessboard } from 'react-chessboard';
import type { Game } from '../chess/game';

export type BoardProps = {
  /** Game whose `fen()` drives the rendered position. */
  game: Game;
  /** Which colour is on the bottom of the board. Defaults to white. */
  orientation?: 'white' | 'black';
  /** Pixel width of the board. Optional; the library auto-sizes if omitted. */
  width?: number;
};

/**
 * Read-only board view backed by react-chessboard. Drag-and-drop and legal
 * move enforcement land in Phase 3 / Tasks 2-3; for now this just renders the
 * current position from the supplied `Game`.
 */
export function Board({
  game,
  orientation = 'white',
  width,
}: BoardProps): JSX.Element {
  return (
    <Chessboard
      position={game.fen()}
      boardOrientation={orientation}
      boardWidth={width}
      arePiecesDraggable={false}
    />
  );
}
