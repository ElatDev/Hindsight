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
import { PgnGameSelectDialog } from './ui/PgnGameSelectDialog';
import { PgnPasteDialog } from './ui/PgnPasteDialog';
import { MaterialAdvantage } from './ui/MaterialAdvantage';
import { ResignConfirmDialog } from './ui/ResignConfirmDialog';
import { Review } from './ui/Review';
import { SavedGamesDialog } from './ui/SavedGamesDialog';
import { SettingsDialog } from './ui/SettingsDialog';
import { EngineMissingDialog } from './ui/EngineMissingDialog';
import { useArrowKeyNav } from './ui/useArrowKeyNav';
import { useLiveEval } from './ui/useLiveEval';
import { useSettings } from './ui/useSettings';
import { useTheme } from './ui/useTheme';
import { Game } from './chess/game';
import { previewPgnGames, type PgnGamePreview } from './chess/pgnSplit';
import { parseStockfishNotFound } from '../shared/ipc';

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
  // `gameInstanceId` bumps only when a new game is started or a PGN is
  // loaded — *not* on every move. Used as the Board's `key` so its internal
  // right-click highlights / arrows get flushed when the user moves to a
  // genuinely new game (Lichess-style annotations are per-game, not sticky).
  const [gameInstanceId, setGameInstanceId] = useState(0);
  const [viewPly, setViewPly] = useState(0);
  const [orientation, setOrientation] = useState<'white' | 'black'>('white');
  const [showNewGame, setShowNewGame] = useState(false);
  const [showPgnPaste, setShowPgnPaste] = useState(false);
  const [engineThinking, setEngineThinking] = useState(false);
  const [engineError, setEngineError] = useState<string | null>(null);
  const [showEndBanner, setShowEndBanner] = useState(true);
  // Resignation is app-state only — chess.js doesn't model it. Set to the
  // colour that resigned; the banner / status line use it as a virtual game
  // end. Cleared whenever a fresh game starts (new game / loaded PGN).
  const [resignedBy, setResignedBy] = useState<Color | null>(null);
  const [showResignConfirm, setShowResignConfirm] = useState(false);
  const [pgnError, setPgnError] = useState<string | null>(null);
  const [pgnGames, setPgnGames] = useState<PgnGamePreview[] | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showSavedGames, setShowSavedGames] = useState(false);
  const { theme, toggle: toggleTheme, setTheme } = useTheme();
  const { settings, update: updateSettings } = useSettings();

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

  // From-/to-square of the most recently displayed move. Reads from the
  // displayed game's verbose history so it tracks navigation correctly when
  // the user steps back through plies.
  const lastMove = useMemo(() => {
    if (!settings.lastMoveHighlight) return null;
    if (viewPly === 0) return null;
    const verbose = displayed.historyVerbose();
    const last = verbose[verbose.length - 1];
    if (!last) return null;
    return { from: last.from as Square, to: last.to as Square };
  }, [displayed, viewPly, settings.lastMoveHighlight]);

  const gameOver = state.game.isGameOver() || resignedBy !== null;

  const playerCanMove =
    atTip &&
    !gameOver &&
    (state.mode === 'free' || state.game.turn() === state.playerColor);

  const liveEvalSnap = useLiveEval({
    enabled: settings.liveEval && !reviewing,
    paused: engineThinking || !atTip || gameOver,
    fen: displayed.fen(),
    depth: ENGINE_DEPTH,
  });

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
    if (gameOver) return;
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
  }, [state, atTip, version, gameOver]);

  useArrowKeyNav(goTo, viewPly, totalPlies);

  const startNewGame = useCallback((settings: NewGameSettings): void => {
    setState({
      game: new Game(),
      mode: settings.mode,
      playerColor: settings.playerColor,
      elo: settings.elo,
    });
    setVersion(0);
    setGameInstanceId((id) => id + 1);
    setViewPly(0);
    setEngineError(null);
    setShowNewGame(false);
    setShowEndBanner(true);
    setPgnError(null);
    setReviewing(false);
    setResignedBy(null);
    setShowResignConfirm(false);
    if (settings.mode === 'vs-engine') {
      setOrientation(settings.playerColor === 'w' ? 'white' : 'black');
    }
  }, []);

  const loadSinglePgn = useCallback((pgn: string): boolean => {
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
      setGameInstanceId((id) => id + 1);
      setViewPly(loaded.history().length);
      setEngineError(null);
      setShowEndBanner(true);
      setPgnError(null);
      setPgnGames(null);
      setReviewing(false);
      setResignedBy(null);
      setShowResignConfirm(false);
      return true;
    } catch (err: unknown) {
      setPgnError(err instanceof Error ? err.message : String(err));
      return false;
    }
  }, []);

  const confirmResign = useCallback((): void => {
    setResignedBy(state.playerColor);
    setShowResignConfirm(false);
    setEngineThinking(false);
    setShowEndBanner(true);
    // Bump requestIdRef so any in-flight engine bestMove won't apply.
    requestIdRef.current += 1;
  }, [state.playerColor]);

  const canResign =
    state.mode === 'vs-engine' && !gameOver && totalPlies > 0 && atTip;

  // Take-back undoes plies. In free-play that's exactly one ply per click;
  // in vs-engine it walks back until the player is on move (so a click
  // undoes both the engine's response and the player's move that prompted
  // it). Aborts any in-flight engine bestMove first, otherwise the engine
  // would re-play right after we rewound past it.
  const canTakeBack =
    atTip &&
    !gameOver &&
    (state.mode === 'free'
      ? totalPlies > 0
      : totalPlies >= (state.playerColor === 'w' ? 1 : 2));

  const takeBack = useCallback((): void => {
    if (!canTakeBack) return;
    requestIdRef.current += 1;
    setEngineThinking(false);
    let undone = 0;
    while (state.game.history().length > 0 && undone < 4) {
      state.game.undo();
      undone += 1;
      if (state.mode === 'free') break;
      if (state.game.turn() === state.playerColor) break;
    }
    setVersion((v) => v + 1);
    setViewPly(state.game.history().length);
  }, [canTakeBack, state.game, state.mode, state.playerColor]);

  /** Load a (possibly multi-game) PGN. With one game the loader runs
   *  immediately; with two or more we open the selector. Returns true if the
   *  caller should treat the load as accepted (selector opened or single-game
   *  load succeeded). */
  const loadPgnText = useCallback(
    (pgn: string): boolean => {
      const previews = previewPgnGames(pgn);
      if (previews.length === 0) {
        setPgnError('No games found in PGN.');
        return false;
      }
      if (previews.length === 1) {
        const only = previews[0];
        if (!only.ok) {
          setPgnError(only.error);
          return false;
        }
        return loadSinglePgn(only.pgn);
      }
      setPgnError(null);
      setPgnGames(previews);
      return true;
    },
    [loadSinglePgn],
  );

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
    setViewPly(0);
    setShowEndBanner(false);
    setReviewing(true);
  }, []);

  const exitReview = useCallback((): void => {
    setReviewing(false);
  }, []);

  const stockfishMissingPath = engineError
    ? parseStockfishNotFound(engineError)
    : null;

  // Auto-clear transient engine errors after a few seconds so a failure with
  // no follow-up engine call to clear it (e.g., the very last move of a game)
  // doesn't pin the toast forever. STOCKFISH_NOT_FOUND stays sticky — it
  // requires explicit acknowledgement via the EngineMissingDialog and would
  // just reappear on the next engine call anyway.
  useEffect(() => {
    if (!engineError) return;
    if (stockfishMissingPath) return;
    const timer = window.setTimeout(() => setEngineError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [engineError, stockfishMissingPath]);

  const statusLine = (() => {
    if (stockfishMissingPath) {
      return 'Stockfish not found — engine features are disabled until you install it.';
    }
    if (engineError) return `Engine error: ${engineError}`;
    if (resignedBy && atTip) {
      const loser = resignedBy === 'w' ? 'White' : 'Black';
      return `Game over — ${loser} resigned.`;
    }
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
        {!reviewing && totalPlies > 0 ? (
          <button
            type="button"
            className="header-secondary-btn"
            onClick={() => setReviewing(true)}
          >
            Review game
          </button>
        ) : null}
        {!reviewing && canTakeBack ? (
          <button
            type="button"
            className="header-secondary-btn"
            onClick={takeBack}
            title={
              state.mode === 'vs-engine'
                ? 'Undo your last move (and the engine response).'
                : 'Undo the last move.'
            }
          >
            Take back
          </button>
        ) : null}
        {!reviewing && canResign ? (
          <button
            type="button"
            className="header-secondary-btn header-secondary-btn--danger"
            onClick={() => setShowResignConfirm(true)}
          >
            Resign
          </button>
        ) : null}
        <button
          type="button"
          className="header-secondary-btn"
          onClick={() => setShowSavedGames(true)}
        >
          Saved games
        </button>
        <button
          type="button"
          className="header-secondary-btn"
          onClick={() => setShowSettings(true)}
        >
          Settings
        </button>
      </header>
      <p className="tagline">Free, offline, open-source chess game review.</p>

      {pgnError ? (
        <p className="status status--error">PGN error: {pgnError}</p>
      ) : null}

      {showEndBanner && (state.game.isGameOver() || resignedBy) ? (
        <GameEndBanner
          reason={resignedBy ? 'resignation' : (state.game.gameEnd() ?? 'draw')}
          winner={
            resignedBy
              ? resignedBy === 'w'
                ? 'black'
                : 'white'
              : state.game.gameEnd() === 'checkmate'
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

      {reviewing ? (
        <Review
          game={state.game}
          orientation={orientation}
          analysisDepth={settings.analysisDepth}
          boardTheme={settings.boardTheme}
          pieceTheme={settings.pieceTheme}
          lastMoveHighlight={settings.lastMoveHighlight !== false}
          onFlip={flip}
          onToggleTheme={toggleTheme}
          onExit={exitReview}
        />
      ) : (
        <div className="play-area">
          <EvalBar
            evalCp={liveEvalSnap.cp}
            mateIn={liveEvalSnap.mate}
            orientation={orientation}
          />
          <div className="board-stack">
            <MaterialAdvantage
              game={displayed}
              side={orientation === 'white' ? 'b' : 'w'}
            />
            <div className="board-frame">
              <Board
                key={gameInstanceId}
                game={displayed}
                width={520}
                orientation={orientation}
                boardTheme={settings.boardTheme}
                pieceTheme={settings.pieceTheme}
                autoQueen={settings.autoQueen !== false}
                lastMove={lastMove}
                showLegalMoves={settings.showLegalMoves !== false}
                onMove={playerCanMove ? handleMove : undefined}
              />
            </div>
            <MaterialAdvantage
              game={displayed}
              side={orientation === 'white' ? 'w' : 'b'}
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
      )}

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

      {pgnGames ? (
        <PgnGameSelectDialog
          games={pgnGames}
          onSelect={(pgn) => loadSinglePgn(pgn)}
          onCancel={() => setPgnGames(null)}
        />
      ) : null}

      {showSettings ? (
        <SettingsDialog
          initial={settings}
          theme={theme}
          onConfirm={(next, nextTheme) => {
            updateSettings(next);
            setTheme(nextTheme);
            setShowSettings(false);
          }}
          onCancel={() => setShowSettings(false)}
        />
      ) : null}

      {showSavedGames ? (
        <SavedGamesDialog
          current={
            totalPlies > 0
              ? {
                  pgn: state.game.pgn(),
                  plyCount: totalPlies,
                  defaultName:
                    state.mode === 'vs-engine'
                      ? `Game vs engine (${state.elo} Elo)`
                      : '',
                }
              : null
          }
          onLoad={(pgn) => {
            const ok = loadPgnText(pgn);
            if (ok) setShowSavedGames(false);
            return ok;
          }}
          onCancel={() => setShowSavedGames(false)}
        />
      ) : null}

      {showResignConfirm ? (
        <ResignConfirmDialog
          side={state.playerColor === 'w' ? 'white' : 'black'}
          onConfirm={confirmResign}
          onCancel={() => setShowResignConfirm(false)}
        />
      ) : null}

      {stockfishMissingPath ? (
        <EngineMissingDialog
          binaryPath={stockfishMissingPath}
          onDismiss={() => setEngineError(null)}
        />
      ) : null}
    </main>
  );
}

export default App;
