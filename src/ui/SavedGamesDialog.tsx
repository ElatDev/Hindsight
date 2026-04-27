import { useCallback, useEffect, useState } from 'react';
import type { SavedGameSummary } from '../../shared/ipc';

export type SavedGamesDialogProps = {
  /** When non-null, the dialog shows a "Save current game" button at the top
   *  with this summary line for confirmation. */
  current: { pgn: string; plyCount: number; defaultName: string } | null;
  onLoad: (pgn: string) => void;
  onCancel: () => void;
};

/**
 * Saved-games browser. Lists every game in SQLite, lets the user load one
 * back into the main view, delete one, or save the currently-open game.
 *
 * The list is fetched via IPC on mount and refreshed after every mutation
 * (save / delete) so the order stays correct without optimistic-update
 * bookkeeping.
 */
export function SavedGamesDialog({
  current,
  onLoad,
  onCancel,
}: SavedGamesDialogProps): JSX.Element {
  const [games, setGames] = useState<SavedGameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saveName, setSaveName] = useState('');

  const refresh = useCallback(async (): Promise<void> => {
    try {
      const next = await window.hindsight.games.list();
      setGames(next);
      setError(null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    setSaveName(current?.defaultName ?? '');
  }, [current?.defaultName]);

  const handleSave = useCallback(async (): Promise<void> => {
    if (!current) return;
    setBusy(true);
    try {
      await window.hindsight.games.save({
        pgn: current.pgn,
        name: saveName.trim() || undefined,
        plyCount: current.plyCount,
      });
      await refresh();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [current, saveName, refresh]);

  const handleDelete = useCallback(
    async (id: number): Promise<void> => {
      setBusy(true);
      try {
        await window.hindsight.games.delete(id);
        await refresh();
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [refresh],
  );

  const handleLoad = useCallback(
    async (id: number): Promise<void> => {
      setBusy(true);
      try {
        const game = await window.hindsight.games.get(id);
        if (!game) {
          setError('Game not found.');
          return;
        }
        onLoad(game.pgn);
      } catch (err: unknown) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setBusy(false);
      }
    },
    [onLoad],
  );

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="saved-games-title"
    >
      <div className="dialog dialog--wide">
        <h2 id="saved-games-title">Saved games</h2>

        {current ? (
          <div className="saved-games__save-row">
            <label htmlFor="saved-game-name">Save the current game as:</label>
            <input
              id="saved-game-name"
              type="text"
              className="saved-games__name-input"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={current.defaultName}
              maxLength={200}
              disabled={busy}
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={busy || current.plyCount === 0}
            >
              Save
            </button>
          </div>
        ) : null}

        {error ? <p className="status status--error">Error: {error}</p> : null}

        {games === null ? (
          <p className="status">Loading…</p>
        ) : games.length === 0 ? (
          <p className="status status--muted">
            No saved games yet. Play or import a game, then come back here to
            save it.
          </p>
        ) : (
          <ul className="pgn-select-list">
            {games.map((g) => {
              const white = g.white?.trim() || '?';
              const black = g.black?.trim() || '?';
              const event = g.event?.trim() || g.playedAt || '';
              const result = g.result?.trim() || '*';
              return (
                <li key={g.id} className="pgn-select-list__row">
                  <div className="saved-games__row">
                    <button
                      type="button"
                      className="pgn-select-list__btn"
                      disabled={busy}
                      onClick={() => void handleLoad(g.id)}
                      title={`Saved ${g.createdAt}`}
                    >
                      <span className="pgn-select-list__num">
                        {g.name || `${white} vs ${black}`.slice(0, 40)}
                      </span>
                      <span className="pgn-select-list__players">
                        {white} <span className="pgn-select-list__vs">vs</span>{' '}
                        {black}
                      </span>
                      <span className="pgn-select-list__event">{event}</span>
                      <span className="pgn-select-list__result">{result}</span>
                      <span className="pgn-select-list__moves">
                        {g.plyCount} ply
                      </span>
                    </button>
                    <button
                      type="button"
                      className="saved-games__delete"
                      aria-label={`Delete saved game: ${g.name}`}
                      disabled={busy}
                      onClick={() => void handleDelete(g.id)}
                    >
                      ×
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <div className="dialog__actions">
          <button type="button" onClick={onCancel}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
