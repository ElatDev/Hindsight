import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Square } from 'chess.js';
import { Board } from './ui/Board';
import { MoveList } from './ui/MoveList';
import { NavControls } from './ui/NavControls';
import { Game } from './chess/game';

function App(): JSX.Element {
  // The canonical Game holds the full move history. The board may display an
  // earlier ply (history navigation), so we replay history[0..viewPly] into a
  // separate displayed Game on every render that depends on the cursor.
  const [game] = useState(() => new Game());
  // `version` bumps on every move so derived state (history, displayed game)
  // re-computes. The state is only ever read via the dependency arrays below.
  const [version, setVersion] = useState(0);
  const [viewPly, setViewPly] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');

  const history = useMemo(() => {
    // `version` is a dependency marker: the Game wrapper mutates in place,
    // so React can't tell when history changed without our help.
    void version;
    return game.history();
  }, [game, version]);
  const totalPlies = history.length;
  const atTip = viewPly === totalPlies;

  const displayed = useMemo(() => {
    const g = new Game();
    for (let i = 0; i < viewPly; i += 1) g.move(history[i]);
    return g;
  }, [history, viewPly]);

  const handleMove = useCallback(
    (from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
      if (!atTip) return false;
      const move = game.move({ from, to, promotion });
      if (!move) return false;
      setVersion((v) => v + 1);
      setViewPly((p) => p + 1);
      return true;
    },
    [game, atTip],
  );

  const goTo = useCallback(
    (ply: number): void => {
      const clamped = Math.max(0, Math.min(ply, totalPlies));
      setViewPly(clamped);
    },
    [totalPlies],
  );

  const flip = useCallback((): void => {
    setOrientation((o) => (o === 'white' ? 'black' : 'white'));
  }, []);

  // Keyboard navigation: arrow keys jump through the move list.
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.target instanceof HTMLInputElement) return;
      if (e.key === 'ArrowLeft') goTo(viewPly - 1);
      else if (e.key === 'ArrowRight') goTo(viewPly + 1);
      else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(totalPlies);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, viewPly, totalPlies]);

  return (
    <main className="app-shell">
      <h1>Hindsight</h1>
      <p className="tagline">Free, offline, open-source chess game review.</p>
      <div className="play-area">
        <div className="board-frame">
          <Board
            game={displayed}
            width={520}
            orientation={orientation}
            onMove={atTip ? handleMove : undefined}
          />
        </div>
        <aside className="side-panel">
          <NavControls
            canPrev={viewPly > 0}
            canNext={viewPly < totalPlies}
            onFirst={() => goTo(0)}
            onPrev={() => goTo(viewPly - 1)}
            onNext={() => goTo(viewPly + 1)}
            onLast={() => goTo(totalPlies)}
            onFlip={flip}
          />
          <MoveList history={history} currentPly={viewPly} onSelect={goTo} />
          <p className="status">
            {displayed.isGameOver()
              ? `Game over — ${displayed.gameEnd()}.`
              : atTip
                ? `${displayed.turn() === 'w' ? 'White' : 'Black'} to move.`
                : `Reviewing — drag the arrow to the end to make moves.`}
          </p>
        </aside>
      </div>
    </main>
  );
}

export default App;
