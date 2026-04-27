import { useCallback, useEffect, useState } from 'react';

/**
 * Persistent app-wide settings. Phase 12 / Task 1 ships the storage layer +
 * the dialog UI; the consumers wire up over the rest of Phase 12 (live eval,
 * engine path override, board/piece themes). The settings keys are versioned
 * so a Phase 12 / Task 2 SQLite migration can take over the same shape.
 *
 * Storage backend: localStorage today; will move to SQLite in Phase 12 /
 * Task 2 (this hook is the seam).
 */

export type BoardTheme = 'classic' | 'blue' | 'green' | 'gray';
export type PieceTheme = 'cburnett' | 'merida' | 'alpha';

export type Settings = {
  /** Stockfish search depth used by `runGameReview`. Range 8..22. */
  readonly analysisDepth: number;
  /** Show a live engine eval bar during play (Phase 12 / Task 7). */
  readonly liveEval: boolean;
  /** Board palette (Phase 12 / Task 8). */
  readonly boardTheme: BoardTheme;
  /** Piece set (Phase 12 / Task 8). */
  readonly pieceTheme: PieceTheme;
};

export const DEFAULT_SETTINGS: Settings = {
  analysisDepth: 12,
  liveEval: false,
  boardTheme: 'classic',
  pieceTheme: 'cburnett',
};

export const ANALYSIS_DEPTH_MIN = 8;
export const ANALYSIS_DEPTH_MAX = 22;

const STORAGE_KEY = 'hindsight.settings.v1';

const BOARD_THEMES: ReadonlySet<BoardTheme> = new Set([
  'classic',
  'blue',
  'green',
  'gray',
]);
const PIECE_THEMES: ReadonlySet<PieceTheme> = new Set([
  'cburnett',
  'merida',
  'alpha',
]);

/** Read + sanitize the stored value. Anything malformed falls back to the
 *  default for that field — keeps a hand-edited or older-version blob from
 *  bricking the app. */
function readStoredSettings(): Settings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return DEFAULT_SETTINGS;
  }
  if (!raw) return DEFAULT_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return sanitize(parsed);
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function sanitize(input: Partial<Settings>): Settings {
  const depth = Number(input.analysisDepth ?? DEFAULT_SETTINGS.analysisDepth);
  const clampedDepth = Number.isFinite(depth)
    ? Math.min(
        ANALYSIS_DEPTH_MAX,
        Math.max(ANALYSIS_DEPTH_MIN, Math.round(depth)),
      )
    : DEFAULT_SETTINGS.analysisDepth;
  const boardTheme = BOARD_THEMES.has(input.boardTheme as BoardTheme)
    ? (input.boardTheme as BoardTheme)
    : DEFAULT_SETTINGS.boardTheme;
  const pieceTheme = PIECE_THEMES.has(input.pieceTheme as PieceTheme)
    ? (input.pieceTheme as PieceTheme)
    : DEFAULT_SETTINGS.pieceTheme;
  return {
    analysisDepth: clampedDepth,
    liveEval: Boolean(input.liveEval),
    boardTheme,
    pieceTheme,
  };
}

export type UseSettings = {
  settings: Settings;
  /** Replace one or more fields. Persists immediately. */
  update: (patch: Partial<Settings>) => void;
  /** Restore every field to its default. */
  reset: () => void;
};

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(readStoredSettings);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Storage may be unavailable (private mode, quota); fall through.
    }
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>): void => {
    setSettings((prev) => sanitize({ ...prev, ...patch }));
  }, []);

  const reset = useCallback((): void => {
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset };
}
