import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
import {
  IpcChannel,
  type AnalysisResult,
  type AnalyzeRequest,
  type BestMoveRequest,
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

function registerIpcHandlers(): void {
  ipcMain.handle(
    IpcChannel.EngineAnalyze,
    async (_evt, req: AnalyzeRequest): Promise<AnalysisResult> => {
      const engine = await getEngine();
      return analyzePosition(engine, req.fen, {
        depth: req.depth,
        multiPV: req.multiPV,
        timeoutMs: req.timeoutMs,
      });
    },
  );

  ipcMain.handle(
    IpcChannel.EngineBestMove,
    async (_evt, req: BestMoveRequest): Promise<string | null> => {
      const engine = await getEngine();
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
