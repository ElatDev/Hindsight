import { useMemo, useState } from 'react';
import { previewPgnGames } from '../chess/pgnSplit';

export type PgnPasteDialogProps = {
  onLoad: (pgn: string) => void;
  onCancel: () => void;
};

type Preview =
  | {
      ok: true;
      gameCount: number;
      moves: number;
      headers: Record<string, string>;
    }
  | { ok: false; error: string }
  | { ok: 'empty' };

function previewPgn(text: string): Preview {
  const trimmed = text.trim();
  if (!trimmed) return { ok: 'empty' };
  const games = previewPgnGames(trimmed);
  if (games.length === 0) return { ok: 'empty' };
  const first = games[0];
  if (!first.ok) return { ok: false, error: first.error };
  return {
    ok: true,
    gameCount: games.length,
    moves: first.moveCount,
    headers: first.headers,
  };
}

/**
 * Modal with a PGN textarea. Re-parses on every change and shows the move
 * count + Seven-Tag-Roster summary so the user knows the paste is valid
 * before applying it.
 */
export function PgnPasteDialog({
  onLoad,
  onCancel,
}: PgnPasteDialogProps): JSX.Element {
  const [text, setText] = useState('');
  const preview = useMemo(() => previewPgn(text), [text]);
  const canLoad = preview.ok === true;

  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="paste-pgn-title"
    >
      <div className="dialog dialog--wide">
        <h2 id="paste-pgn-title">Paste PGN</h2>

        <textarea
          className="dialog__textarea"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder='[Event "..."]&#10;[Site "..."]&#10;...&#10;&#10;1. e4 e5 2. Nf3 Nc6 ...'
          rows={12}
          spellCheck={false}
        />

        <div className="dialog__preview" aria-live="polite">
          {preview.ok === 'empty' ? (
            <span className="dialog__preview-muted">
              Paste or type PGN above.
            </span>
          ) : preview.ok === true ? (
            <span className="dialog__preview-ok">
              {preview.gameCount > 1
                ? `${preview.gameCount} games found — pick one after Load. First: `
                : ''}
              {preview.moves} half-move{preview.moves === 1 ? '' : 's'}
              {preview.headers.White || preview.headers.Black
                ? ` — ${preview.headers.White ?? '?'} vs ${
                    preview.headers.Black ?? '?'
                  }`
                : ''}
              {preview.headers.Result ? ` (${preview.headers.Result})` : ''}.
            </span>
          ) : (
            <span className="dialog__preview-error">
              Could not parse PGN: {preview.error}
            </span>
          )}
        </div>

        <div className="dialog__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className="dialog__primary"
            disabled={!canLoad}
            onClick={() => onLoad(text.trim())}
          >
            Load
          </button>
        </div>
      </div>
    </div>
  );
}
