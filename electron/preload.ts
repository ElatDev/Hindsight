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
};

contextBridge.exposeInMainWorld('hindsight', api);
