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
  SettingsLoad: 'settings:load',
  SettingsSave: 'settings:save',
  GamesList: 'games:list',
  GamesGet: 'games:get',
  GamesSave: 'games:save',
  GamesDelete: 'games:delete',
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

/** Settings persisted to SQLite. The wire format is opaque (a record of
 *  JSON-able values) so the renderer's sanitizer is the single source of
 *  truth for the shape; main-side code never needs to know which keys exist.
 *  See `src/ui/useSettings.ts` for the canonical shape. */
export type SettingsRecord = Readonly<Record<string, unknown>>;

export type SettingsLoadResult = {
  settings: SettingsRecord;
  /** True when at least one row was already present in the DB. False on a
   *  fresh install — the renderer uses this to seed the DB from any
   *  pre-existing localStorage settings (one-time migration). */
  bootstrapped: boolean;
};

/** Saved-game list-view row. Excludes the PGN body so the list can render
 *  hundreds of entries without paying parse cost. */
export type SavedGameSummary = {
  id: number;
  name: string;
  white: string | null;
  black: string | null;
  result: string | null;
  event: string | null;
  playedAt: string | null;
  createdAt: string;
  plyCount: number;
};

/** Detail view — summary plus the raw PGN. */
export type SavedGame = SavedGameSummary & {
  pgn: string;
};

export type SaveGameRequest = {
  pgn: string;
  /** Optional display name; if omitted, derived from PGN headers main-side. */
  name?: string;
  plyCount: number;
};

/** API surface exposed on `window.hindsight` by the preload script. */
export type EngineApi = {
  analyze(req: AnalyzeRequest): Promise<AnalysisResult>;
  bestMove(req: BestMoveRequest): Promise<string | null>;
};

export type PgnApi = {
  openFile(): Promise<PgnOpenResult>;
  saveFile(req: PgnSaveRequest): Promise<PgnSaveResult>;
};

export type SettingsApi = {
  load(): Promise<SettingsLoadResult>;
  save(patch: SettingsRecord): Promise<void>;
};

export type GamesApi = {
  list(): Promise<SavedGameSummary[]>;
  get(id: number): Promise<SavedGame | null>;
  save(req: SaveGameRequest): Promise<SavedGameSummary>;
  delete(id: number): Promise<void>;
};

export type HindsightApi = {
  version: string;
  engine: EngineApi;
  pgn: PgnApi;
  settings: SettingsApi;
  games: GamesApi;
};

declare global {
  interface Window {
    hindsight: HindsightApi;
  }
}
