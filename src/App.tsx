import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Color, Square } from 'chess.js';
import { Board } from './ui/Board';
import { EvalBar } from './ui/EvalBar';
import { GameEndBanner } from './ui/GameEndBanner';
import { MoveList } from './ui/MoveList';
import { NavControls } from './ui/NavControls';
import {
  NewGameDialog,
  type GameMode,
  type NewGameSettings,
} from './ui/NewGameDialog';
import { PgnPasteDialog } from './ui/PgnPasteDialog';
import { useTheme } from './ui/useTheme';
import { Game } from './chess/game';

type AppState = {
  game: Game;
  mode: GameMode;
  /** Only meaningful when mode === 'vs-engine'. */
  playerColor: Color;
  /** Only meaningful when mode === 'vs-engine'. */
  elo: number;
};

const ENGINE_DEPTH = 12;

function App(): JSX.Element {
  const [state, setState] = useState<AppState>(() => ({
    game: new Game(),
    mode: 'free',
    playerColor: 'w',
    elo: 1500,
  }));
  // `version` bumps on every move so derived state recomputes.
  const [version, setVersion] = useState(0);
  const [viewPly, setViewPly] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [showNewGame, setShowNewGame] = useState(false);
  const [showPgnPaste, setShowPgnPaste] = useState(false);
  const [engineThinking, setEngineThinking] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [showEndBanner, setShowEndBanner] = useState(true);
  const [pgnError, setPgnError] = useState<string | null>(null);
  const { toggle: toggleTheme } = useTheme();

  const history = useMemo(() => {
    void version;
    return state.game.history();
  }, [state.game, version]);
  const totalPlies = history.length;
  const atTip = viewPly === totalPlies;

  const displayed = useMemo(() => {
    const g = new Game();
    for (let i = 0; i < viewPly; i += 1) g.move(history[i]);
    return g;
  }, [history, viewPly]);

  const playerCanMove =
    atTip &&
    !state.game.isGameOver() &&
    (state.mode === 'free' || state.game.turn() === state.playerColor);

  const handleMove = useCallback(
    (from: Square, to: Square, promotion?: 'q' | 'r' | 'b' | 'n'): boolean => {
      if (!playerCanMove) return false;
      const move = state.game.move({ from, to, promotion });
      if (!move) return false;
      setVersion((v) => v + 1);
      setViewPly((p) => p + 1);
      return true;
    },
    [state.game, playerCanMove],
  );

  const goTo = useCallback(
    (ply: number): void => {
      setViewPly(Math.max(0, Math.min(ply, totalPlies)));
    },
    [totalPlies],
  );

  const flip = useCallback((): void => {
    setOrientation((o) => (o === 'white' ? 'black' : 'white'));
  }, []);

  // Drive engine moves when it's the engine's turn.
  // Guarded by `requestId` so a rapid restart or game-mode change can't apply
  // a stale bestMove from a previous request.
  const requestIdRef = useRef(0);
  useEffect(() => {
    if (state.mode !== 'vs-engine') return;
    if (!atTip) return;
    if (state.game.isGameOver()) return;
    if (state.game.turn() === state.playerColor) return;

    const myReq = ++requestIdRef.current;
    setEngineThinking(true);
    setEngineError(null);

    const fen = state.game.fen();
    const elo = state.elo;
    void window.hindsight.engine
      .bestMove({ fen, depth: ENGINE_DEPTH, elo })
      .then((uci) => {
        if (myReq !== requestIdRef.current) return; // stale
        if (!uci) {
          setEngineError('Engine returned no move.');
          return;
        }
        const from = uci.slice(0, 2) as Square;
        const to = uci.slice(2, 4) as Square;
        const promotion =
          uci.length >= 5 ? (uci[4] as 'q' | 'r' | 'b' | 'n') : undefined;
        const move = state.game.move({ from, to, promotion });
        if (!move) {
          setEngineError(`Engine returned illegal move: ${uci}`);
          return;
        }
        setVersion((v) => v + 1);
        setViewPly((p) => p + 1);
      })
      .catch((err: unknown) => {
        if (myReq !== requestIdRef.current) return;
        setEngineError(err instanceof Error ? err.message : String(err));
      })
      .finally(() => {
        if (myReq === requestIdRef.current) setEngineThinking(false);
      });
  }, [state, atTip, version]);

  // Keyboard navigation.
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

  const startNewGame = useCallback((settings: NewGameSettings): void => {
    setState({
      game: new Game(),
      mode: settings.mode,
      playerColor: settings.playerColor,
      elo: settings.elo,
    });
    setVersion(0);
    setViewPly(0);
    setEngineError(null);
    setShowNewGame(false);
    setShowEndBanner(true);
    setPgnError(null);
    if (settings.mode === 'vs-engine') {
      setOrientation(settings.playerColor === 'w' ? 'white' : 'black');
    }
  }, []);

  const loadPgnText = useCallback((pgn: string): boolean => {
    try {
      const loaded = new Game();
      loaded.load(pgn);
      setState({
        game: loaded,
        mode: 'free',
        playerColor: 'w',
        elo: 1500,
      });
      setVersion((v) => v + 1);
      setViewPly(loaded.history().length);
      setEngineError(null);
      setShowEndBanner(true);
      setPgnError(null);
      return true;
    } catch (err: unknown) {
      setPgnError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  const handleOpenPgnFile = useCallback(async (): Promise<void> => {
    try {
      const result = await window.hindsight.pgn.openFile();
      if (!result) return; // user cancelled
      loadPgnText(result.pgn);
    } catch (err: unknown) {
      setPgnError(err instanceof Error ? err.message : String(err));
    }
  }, [loadPgnText]);

  const handleReview = useCallback((): void => {
    // Phase 6 will wire this to the analysis pipeline. For now jumping to the
    // start of the game and dismissing the banner gets the user into the
    // navigation UX they'll use during review.
    setViewPly(0);
    setShowEndBanner(false);
  }, []);

  const statusLine = (() => {
    if (engineError) return `Engine error: ${engineError}`;
    if (displayed.isGameOver()) return `Game over — ${displayed.gameEnd()}.`;
    if (!atTip) return 'Reviewing — jump to the end to play.';
    if (engineThinking) return 'Engine thinking...';
    const sideName = displayed.turn() === 'w' ? 'White' : 'Black';
    if (state.mode === 'vs-engine') {
      const isPlayer = state.game.turn() === state.playerColor;
      return `${sideName} to move${isPlayer ? ' (you).' : ' (engine).'}`;
    }
    return `${sideName} to move.`;
  })();

  return (
    <main className="app-shell">
      <header className="app-header">
        <h1>Hindsight</h1>
        <button
          type="button"
          className="new-game-btn"
          onClick={() => setShowNewGame(true)}
        >
          New game
        </button>
        <button
          type="button"
          className="header-secondary-btn"
          onClick={() => void handleOpenPgnFile()}
        >
          Open PGN
        </button>
        <button
          type="button"
          className="header-secondary-btn"
          onClick={() => setShowPgnPaste(true)}
        >
          Paste PGN
        </button>
      </header>
      <p className="tagline">Free, offline, open-source chess game review.</p>

      {pgnError ? (
        <p className="status status--error">PGN error: {pgnError}</p>
      ) : null}

      {showEndBanner && state.game.isGameOver() ? (
        <GameEndBanner
          reason={state.game.gameEnd() ?? 'draw'}
          winner={
            state.game.gameEnd() === 'checkmate'
              ? state.game.turn() === 'w'
                ? 'black'
                : 'white'
              : null
          }
          onReview={handleReview}
          onNewGame={() => setShowNewGame(true)}
          onDismiss={() => setShowEndBanner(false)}
        />
      ) : null}

      <div className="play-area">
        <EvalBar evalCp={0} mateIn={null} orientation={orientation} />
        <div className="board-frame">
          <Board
            game={displayed}
            width={520}
            orientation={orientation}
            onMove={playerCanMove ? handleMove : undefined}
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
            onToggleTheme={toggleTheme}
          />
          <MoveList history={history} currentPly={viewPly} onSelect={goTo} />
          <p className="status">{statusLine}</p>
        </aside>
      </div>

      {showNewGame ? (
        <NewGameDialog
          initial={{
            mode: state.mode,
            playerColor: state.playerColor,
            elo: state.elo,
          }}
          onConfirm={startNewGame}
          onCancel={() => setShowNewGame(false)}
        />
      ) : null}

      {showPgnPaste ? (
        <PgnPasteDialog
          onLoad={(pgn) => {
            if (loadPgnText(pgn)) setShowPgnPaste(false);
          }}
          onCancel={() => setShowPgnPaste(false)}
        />
      ) : null}
    </main>
  );
}

export default App;
