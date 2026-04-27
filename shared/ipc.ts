/**
 * Shared IPC contract between the Electron main process and the React
 * renderer. The preload script (running with Node access) bridges
 * `window.hindsight.*` to `ipcRenderer.invoke(<channel>, payload)`.
 *
 * Channel naming convention: `<domain>:<action>`.
 */

export type AnalysisLine = {
  /** Principal variation as UCI move strings (e.g., 'e2e4', 'g8f6'). */
  pv: string[];
  /** Centipawn score from the side-to-move POV; null when this line is mate. */
  evalCp: number | null;
  /** Mate distance (positive = side-to-move mates); null when cp is set. */
  mateIn: number | null;
  /** Depth this line was searched to. */
  depth: number;
  /** 1-based MultiPV index (always 1 when MultiPV is unset). */
  multipv: number;
};

export type AnalysisResult = {
  /** UCI move string, or null if the position has no legal moves. */
  bestMove: string | null;
  /** PV lines sorted by `multipv` ascending. */
  lines: AnalysisLine[];
};

export type AnalyzeRequest = {
  /** FEN of the position to analyse. */
  fen: string;
  /** Search depth (plies). */
  depth: number;
  /** Number of principal variations. Defaults to 1. */
  multiPV?: number;
  /** Hard timeout for the whole call in ms. Defaults to engine-side default. */
  timeoutMs?: number;
};

export type BestMoveRequest = {
  fen: string;
  depth: number;
  timeoutMs?: number;
};

export const IpcChannel = {
  EngineAnalyze: 'engine:analyze',
  EngineBestMove: 'engine:bestMove',
} as const;

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

/** API surface exposed on `window.hindsight` by the preload script. */
export type EngineApi = {
  analyze(req: AnalyzeRequest): Promise<AnalysisResult>;
  bestMove(req: BestMoveRequest): Promise<string | null>;
};

export type HindsightApi = {
  version: string;
  engine: EngineApi;
};

declare global {
  interface Window {
    hindsight: HindsightApi;
  }
}
