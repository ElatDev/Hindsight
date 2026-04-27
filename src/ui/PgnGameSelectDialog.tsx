import type { PgnGamePreview } from '../chess/pgnSplit';

export type PgnGameSelectDialogProps = {
  games: PgnGamePreview[];
  onSelect: (pgn: string) => void;
  onCancel: () => void;
};

const headerOrFallback = (
  preview: PgnGamePreview,
  key: string,
  fallback: string,
): string => {
  if (!preview.ok) return fallback;
  return preview.headers[key] ?? fallback;
};

/**
 * Modal that surfaces every game found in a multi-game PGN. The user picks
 * which one to load. Parse failures are listed too (greyed out, unselectable)
 * so a malformed game in a valid file doesn't silently swallow the rest.
 */
export function PgnGameSelectDialog({
  games,
  onSelect,
  onCancel,
}: PgnGameSelectDialogProps): JSX.Element {
  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="pgn-select-title"
    >
      <div className="dialog dialog--wide">
        <h2 id="pgn-select-title">Select a game ({games.length} found)</h2>

        <ul className="pgn-select-list">
          {games.map((preview) => {
            const event = headerOrFallback(preview, 'Event', '?');
            const white = headerOrFallback(preview, 'White', '?');
            const black = headerOrFallback(preview, 'Black', '?');
            const result = headerOrFallback(preview, 'Result', '*');
            return (
              <li key={preview.index} className="pgn-select-list__row">
                <button
                  type="button"
                  className="pgn-select-list__btn"
                  disabled={!preview.ok}
                  onClick={() => preview.ok && onSelect(preview.pgn)}
                  title={preview.ok ? '' : preview.error}
                >
                  <span className="pgn-select-list__num">
                    {preview.index + 1}.
                  </span>
                  <span className="pgn-select-list__players">
                    {white} <span className="pgn-select-list__vs">vs</span>{' '}
                    {black}
                  </span>
                  <span className="pgn-select-list__event">{event}</span>
                  <span className="pgn-select-list__result">{result}</span>
                  <span className="pgn-select-list__moves">
                    {preview.ok ? `${preview.moveCount} ply` : 'parse error'}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div className="dialog__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
