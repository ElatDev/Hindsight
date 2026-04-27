import { contextBridge, ipcRenderer } from 'electron';
import {
  IpcChannel,
  type AnalysisResult,
  type AnalyzeRequest,
  type BestMoveRequest,
  type HindsightApi,
  type PgnOpenResult,
  type PgnSaveRequest,
  type PgnSaveResult,
  type SaveGameRequest,
  type SavedGame,
  type SavedGameSummary,
  type SettingsLoadResult,
  type SettingsRecord,
} from '../shared/ipc';

const api: HindsightApi = {
  version: '0.0.0',
  engine: {
    analyze: (req: AnalyzeRequest): Promise<AnalysisResult> =>
      ipcRenderer.invoke(IpcChannel.EngineAnalyze, req),
    bestMove: (req: BestMoveRequest): Promise<string | null> =>
      ipcRenderer.invoke(IpcChannel.EngineBestMove, req),
  },
  pgn: {
    openFile: (): Promise<PgnOpenResult> =>
      ipcRenderer.invoke(IpcChannel.PgnOpenFile),
    saveFile: (req: PgnSaveRequest): Promise<PgnSaveResult> =>
      ipcRenderer.invoke(IpcChannel.PgnSaveFile, req),
  },
  settings: {
    load: (): Promise<SettingsLoadResult> =>
      ipcRenderer.invoke(IpcChannel.SettingsLoad),
    save: (patch: SettingsRecord): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.SettingsSave, patch),
  },
  games: {
    list: (): Promise<SavedGameSummary[]> =>
      ipcRenderer.invoke(IpcChannel.GamesList),
    get: (id: number): Promise<SavedGame | null> =>
      ipcRenderer.invoke(IpcChannel.GamesGet, id),
    save: (req: SaveGameRequest): Promise<SavedGameSummary> =>
      ipcRenderer.invoke(IpcChannel.GamesSave, req),
    delete: (id: number): Promise<void> =>
      ipcRenderer.invoke(IpcChannel.GamesDelete, id),
  },
};

contextBridge.exposeInMainWorld('hindsight', api);
