import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Persistent app-wide settings.
 *
 * **Storage backend (Phase 12 / Task 2):** SQLite (via the main process) is
 * canonical. localStorage stays as a synchronous first-paint cache so the
 * board / theme don't flicker on app launch — we read it during the
 * `useState` initializer, then async-reconcile against the DB on mount.
 *
 * **First-launch migration:** when the IPC load reports `bootstrapped: false`
 * (no rows yet) and localStorage carries a previously-saved blob, we push
 * that blob up to the DB so the user's old preferences survive the upgrade.
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

function readLocalCache(): Settings | null {
  if (typeof window === 'undefined') return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    return sanitize(JSON.parse(raw) as Partial<Settings>);
  } catch {
    return null;
  }
}

function writeLocalCache(settings: Settings): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // Storage may be unavailable (private mode, quota); fall through.
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

function settingsEqual(a: Settings, b: Settings): boolean {
  return (
    a.analysisDepth === b.analysisDepth &&
    a.liveEval === b.liveEval &&
    a.boardTheme === b.boardTheme &&
    a.pieceTheme === b.pieceTheme
  );
}

export type UseSettings = {
  settings: Settings;
  /** Replace one or more fields. Persists to localStorage immediately and
   *  fires an async write to SQLite. */
  update: (patch: Partial<Settings>) => void;
  /** Restore every field to its default. */
  reset: () => void;
};

export function useSettings(): UseSettings {
  const [settings, setSettings] = useState<Settings>(
    () => readLocalCache() ?? DEFAULT_SETTINGS,
  );

  // Refs so the mount-effect closure can compare against current state and
  // know whether the localStorage cache existed at boot — without the parent
  // re-running on every settings change.
  const initialCacheRef = useRef<Settings | null>(null);
  if (initialCacheRef.current === null) {
    initialCacheRef.current = readLocalCache();
  }
  // Gates the write-through mirror so we don't echo the localStorage-seeded
  // state back to SQLite *before* the load has reconciled. Flips to true
  // either when the load resolves (DB or migration completed) or when the
  // user explicitly mutates settings (which itself implies "we've moved past
  // bootstrap state and should be persisting"). Without this gate every cold
  // start fired a redundant `settings:save(DEFAULT_SETTINGS)` IPC.
  const persistReadyRef = useRef(false);

  // Reconcile against the SQLite-backed settings on mount. Three cases:
  //  - DB has rows ⇒ trust the DB; overwrite local state if it differs.
  //  - DB empty + we had a cached blob ⇒ first-time migration; push it up.
  //  - DB empty + no cache ⇒ defaults are fine; nothing to do.
  useEffect(() => {
    let cancelled = false;
    const ipc = window.hindsight?.settings;
    if (!ipc) {
      persistReadyRef.current = true;
      return;
    }
    void (async () => {
      try {
        const { settings: remote, bootstrapped } = await ipc.load();
        if (cancelled) return;
        if (bootstrapped) {
          const sanitized = sanitize(remote as Partial<Settings>);
          setSettings((prev) =>
            settingsEqual(prev, sanitized) ? prev : sanitized,
          );
          writeLocalCache(sanitized);
        } else if (initialCacheRef.current) {
          await ipc.save(initialCacheRef.current);
        }
      } catch {
        // IPC unreachable or DB error — keep the localStorage-backed state.
      } finally {
        if (!cancelled) persistReadyRef.current = true;
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Mirror every settings change to localStorage (sync) and SQLite (async).
  // Skipped until the load effect has reconciled to avoid echoing the
  // localStorage-seeded initial state back to disk on cold start.
  useEffect(() => {
    if (!persistReadyRef.current) return;
    writeLocalCache(settings);
    const ipc = window.hindsight?.settings;
    if (!ipc) return;
    void ipc.save(settings).catch(() => {
      // Swallow — localStorage already has the truth for this session.
    });
  }, [settings]);

  const update = useCallback((patch: Partial<Settings>): void => {
    persistReadyRef.current = true;
    setSettings((prev) => sanitize({ ...prev, ...patch }));
  }, []);

  const reset = useCallback((): void => {
    persistReadyRef.current = true;
    setSettings(DEFAULT_SETTINGS);
  }, []);

  return { settings, update, reset };
}
