import { app, BrowserWindow, dialog, ipcMain } from 'electron';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  IpcChannel,
  type AnalysisResult,
  type AnalyzeRequest,
  type BestMoveRequest,
  type PgnOpenResult,
  type PgnSaveRequest,
  type PgnSaveResult,
  type SaveGameRequest,
  type SavedGame,
  type SavedGameSummary,
  type SettingsLoadResult,
  type SettingsRecord,
} from '../shared/ipc';
import { analyzePosition } from './engine/analyze';
import { StockfishEngine } from './engine/stockfish';
import { openDatabase, type Db } from './storage/db';
import { loadSettings, saveSettings } from './storage/settings';
import { deleteGame, getGame, listGames, saveGame } from './storage/games';

process.env.APP_ROOT = path.join(__dirname, '..');

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

let mainWindow: BrowserWindow | null = null;

// One Stockfish process for the lifetime of the app. Started lazily on the
// first IPC call so a `quit()` can be awaited cleanly during shutdown.
let engineInstance: StockfishEngine | null = null;
let enginePending: Promise<StockfishEngine> | null = null;

/**
 * Resolve the directory holding `stockfish/bin/<platform-arch>/`. In dev the
 * binaries live next to the project root (where `scripts/fetch-stockfish.mjs`
 * dropped them). In a packaged build they're copied via electron-builder's
 * `extraResources` into `process.resourcesPath` — which is *outside* the
 * ASAR archive so the OS can actually exec the binary.
 */
function engineRoot(): string {
  return app.isPackaged ? process.resourcesPath : app.getAppPath();
}

async function getEngine(): Promise<StockfishEngine> {
  if (engineInstance) return engineInstance;
  if (enginePending) return enginePending;
  enginePending = (async (): Promise<StockfishEngine> => {
    const e = new StockfishEngine({ appRoot: engineRoot() });
    await e.start();
    engineInstance = e;
    enginePending = null;
    return e;
  })();
  return enginePending;
}

async function shutdownEngine(): Promise<void> {
  const e = engineInstance;
  engineInstance = null;
  enginePending = null;
  if (e) await e.quit();
}

// Application database. Opened once at app-ready and reused for the lifetime
// of the process. We keep it lazy-init so tests / non-app harnesses can call
// into the IPC handlers without dragging Electron up.
let dbInstance: Db | null = null;
function getDb(): Db {
  if (dbInstance) return dbInstance;
  const dbPath = path.join(app.getPath('userData'), 'hindsight.db');
  dbInstance = openDatabase(dbPath);
  return dbInstance;
}

// Stockfish is a single UCI process — concurrent `go` calls would race on
// the shared `bestmove` output stream. Serialize every engine task through
// this chain so live-eval (Phase 12 / Task 7) can run alongside the play
// loop's bestMove without their stdout listeners interleaving.
let engineQueue: Promise<unknown> = Promise.resolve();
function runEngineTask<T>(task: () => Promise<T>): Promise<T> {
  const next = engineQueue.then(task, task);
  engineQueue = next.catch(() => undefined);
  return next;
}

function registerIpcHandlers(): void {
  ipcMain.handle(
    IpcChannel.EngineAnalyze,
    async (_evt, req: AnalyzeRequest): Promise<AnalysisResult> => {
      const engine = await getEngine();
      return runEngineTask(() =>
        analyzePosition(engine, req.fen, {
          depth: req.depth,
          multiPV: req.multiPV,
          timeoutMs: req.timeoutMs,
        }),
      );
    },
  );

  ipcMain.handle(IpcChannel.PgnOpenFile, async (): Promise<PgnOpenResult> => {
    const result = await dialog.showOpenDialog({
      title: 'Open PGN',
      filters: [
        { name: 'PGN files', extensions: ['pgn'] },
        { name: 'All files', extensions: ['*'] },
      ],
      properties: ['openFile'],
    });
    if (result.canceled || result.filePaths.length === 0) return null;
    const filePath = result.filePaths[0];
    const pgn = await readFile(filePath, 'utf8');
    return { path: filePath, pgn };
  });

  ipcMain.handle(
    IpcChannel.PgnSaveFile,
    async (_evt, req: PgnSaveRequest): Promise<PgnSaveResult> => {
      const result = await dialog.showSaveDialog({
        title: 'Save annotated PGN',
        defaultPath: req.defaultFileName ?? 'hindsight-review.pgn',
        filters: [
          { name: 'PGN files', extensions: ['pgn'] },
          { name: 'All files', extensions: ['*'] },
        ],
      });
      if (result.canceled || !result.filePath) return null;
      await writeFile(result.filePath, req.pgn, 'utf8');
      return { path: result.filePath };
    },
  );

  ipcMain.handle(
    IpcChannel.SettingsLoad,
    async (): Promise<SettingsLoadResult> => loadSettings(getDb()),
  );

  ipcMain.handle(
    IpcChannel.SettingsSave,
    async (_evt, patch: SettingsRecord): Promise<void> => {
      saveSettings(getDb(), patch);
    },
  );

  ipcMain.handle(
    IpcChannel.GamesList,
    async (): Promise<SavedGameSummary[]> => listGames(getDb()),
  );

  ipcMain.handle(
    IpcChannel.GamesGet,
    async (_evt, id: number): Promise<SavedGame | null> => getGame(getDb(), id),
  );

  ipcMain.handle(
    IpcChannel.GamesSave,
    async (_evt, req: SaveGameRequest): Promise<SavedGameSummary> =>
      saveGame(getDb(), req),
  );

  ipcMain.handle(
    IpcChannel.GamesDelete,
    async (_evt, id: number): Promise<void> => {
      deleteGame(getDb(), id);
    },
  );

  ipcMain.handle(
    IpcChannel.EngineBestMove,
    async (_evt, req: BestMoveRequest): Promise<string | null> => {
      const engine = await getEngine();
      return runEngineTask(async () => {
        if (req.elo !== undefined) {
          engine.send('setoption name UCI_LimitStrength value true');
          engine.send(`setoption name UCI_Elo value ${Math.round(req.elo)}`);
        } else {
          engine.send('setoption name UCI_LimitStrength value false');
        }
        const result = await analyzePosition(engine, req.fen, {
          depth: req.depth,
          timeoutMs: req.timeoutMs,
        });
        return result.bestMove;
      });
    },
  );
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Hindsight',
    backgroundColor: '#1a1a1a',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(path.join(RENDERER_DIST, 'index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  registerIpcHandlers();
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.on('before-quit', (event) => {
  if (engineInstance || enginePending) {
    event.preventDefault();
    void shutdownEngine().finally(() => {
      if (dbInstance) {
        try {
          dbInstance.close();
        } catch {
          // best-effort; the OS will reclaim the handle on exit anyway
        }
        dbInstance = null;
      }
      app.exit(0);
    });
  } else if (dbInstance) {
    try {
      dbInstance.close();
    } catch {
      // best-effort
    }
    dbInstance = null;
  }
});
