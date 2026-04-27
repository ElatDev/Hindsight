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
  /** When set, the main process configures Stockfish with
   *  `UCI_LimitStrength=true` + `UCI_Elo=<elo>` before searching. Valid range
   *  is 1320..3190 (Stockfish-defined). When omitted, full strength. */
  elo?: number;
};

export const IpcChannel = {
  EngineAnalyze: 'engine:analyze',
  EngineBestMove: 'engine:bestMove',
  PgnOpenFile: 'pgn:openFile',
  PgnSaveFile: 'pgn:saveFile',
} as const;

/** Sentinel substring stamped onto engine errors when the Stockfish binary
 *  isn't on disk. IPC errors round-trip as plain strings, so the renderer
 *  matches on this prefix to swap a generic "engine error" toast for the
 *  fix-it dialog. Kept in `shared/` so both sides agree on the wire format. */
export const STOCKFISH_NOT_FOUND_MARKER = '[STOCKFISH_NOT_FOUND]';

/** Extract the path portion of a STOCKFISH_NOT_FOUND error message, or null
 *  if the message doesn't carry one. The format produced by the main process
 *  is `[STOCKFISH_NOT_FOUND] Stockfish binary not found at <path>`. */
export function parseStockfishNotFound(message: string): string | null {
  if (!message.includes(STOCKFISH_NOT_FOUND_MARKER)) return null;
  const idx = message.indexOf('not found at ');
  if (idx === -1) return null;
  return message.slice(idx + 'not found at '.length).trim();
}

export type IpcChannelName = (typeof IpcChannel)[keyof typeof IpcChannel];

/** Result of opening a PGN file via the native dialog. `null` when the user
 *  cancels; the renderer treats that as a no-op. */
export type PgnOpenResult = {
  /** Absolute path of the chosen file. */
  path: string;
  /** Raw PGN text. */
  pgn: string;
} | null;

/** Renderer-supplied payload for the native save dialog. */
export type PgnSaveRequest = {
  /** PGN text to write to the chosen path. */
  pgn: string;
  /** Suggested file name (no path). The dialog still lets the user override. */
  defaultFileName?: string;
};

/** Result of saving a PGN file via the native dialog. `null` when the user
 *  cancels; the renderer treats that as a no-op. */
export type PgnSaveResult = {
  /** Absolute path the user chose. */
  path: string;
} | null;

/** API surface exposed on `window.hindsight` by the preload script. */
export type EngineApi = {
  analyze(req: AnalyzeRequest): Promise<AnalysisResult>;
  bestMove(req: BestMoveRequest): Promise<string | null>;
};

export type PgnApi = {
  openFile(): Promise<PgnOpenResult>;
  saveFile(req: PgnSaveRequest): Promise<PgnSaveResult>;
};

export type HindsightApi = {
  version: string;
  engine: EngineApi;
  pgn: PgnApi;
};

declare global {
  interface Window {
    hindsight: HindsightApi;
  }
}
