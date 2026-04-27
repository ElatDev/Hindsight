import { useState } from 'react';
import { Board } from './ui/Board';
import { Game } from './chess/game';

function App(): JSX.Element {
  // A single game instance for now. State lives outside the Game wrapper so
  // React re-renders when a move is applied. Phase 3 / Task 2 will replace
  // this placeholder with proper drag-and-drop + legal-move enforcement.
  const [game] = useState(() => new Game());

  return (
    <main className="app-shell">
      <h1>Hindsight</h1>
      <p className="tagline">Free, offline, open-source chess game review.</p>
      <div className="board-frame">
        <Board game={game} width={520} />
      </div>
      <p className="status">
        Phase 3 / Task 1 &mdash; board rendering live. Drag-drop arrives in Task
        2.
      </p>
    </main>
  );
}

export default App;
