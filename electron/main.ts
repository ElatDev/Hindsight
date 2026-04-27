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
} from '../shared/ipc';
import { analyzePosition } from './engine/analyze';
import { StockfishEngine } from './engine/stockfish';

process.env.APP_ROOT = path.join(__dirname, '..');

const VITE_DEV_SERVER_URL = process.env.VITE_DEV_SERVER_URL;
const RENDERER_DIST = path.join(process.env.APP_ROOT, 'dist');

let mainWindow: BrowserWindow | null = null;

// One Stockfish process for the lifetime of the app. Started lazily on the
// first IPC call so a `quit()` can be awaited cleanly during shutdown.
let engineInstance: StockfishEngine | null = null;
let enginePending: Promise<StockfishEngine> | null = null;

async function getEngine(): Promise<StockfishEngine> {
  if (engineInstance) return engineInstance;
  if (enginePending) return enginePending;
  enginePending = (async (): Promise<StockfishEngine> => {
    const e = new StockfishEngine({ appRoot: app.getAppPath() });
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
      app.exit(0);
    });
  }
});
