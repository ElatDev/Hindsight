import { useCallback, useState } from 'react';
import type { Square } from 'chess.js';
import { Board } from './ui/Board';
import { Game } from './chess/game';

function App(): JSX.Element {
  // The Game wrapper holds chess.js state (mutable). React doesn't track that
  // mutation, so we pair it with a `version` counter that bumps on each move
  // to trigger re-render. Phase 6+ may swap to a reducer when the analysis
  // pipeline needs richer state transitions.
  const [game] = useState(() => new Game());
  const [, setVersion] = useState(0);

  const handleMove = useCallback(
    (from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
      const move = game.move({ from, to, promotion });
      if (!move) return false;
      setVersion((v) => v + 1);
      return true;
    },
    [game],
  );

  return (
    <main className="app-shell">
      <h1>Hindsight</h1>
      <p className="tagline">Free, offline, open-source chess game review.</p>
      <div className="board-frame">
        <Board game={game} width={520} onMove={handleMove} />
      </div>
      <p className="status">
        {game.isGameOver()
          ? `Game over — ${game.gameEnd()}.`
          : `${game.turn() === 'w' ? 'White' : 'Black'} to move. Move ${
              Math.floor(game.history().length / 2) + 1
            }.`}
      </p>
    </main>
  );
}

export default App;
