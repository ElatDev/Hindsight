export type EngineMissingDialogProps = {
  /** Absolute path the main process expected the binary at. Shown in the
   *  dialog so the user can sanity-check what went wrong (typo? missing
   *  postinstall step?). */
  binaryPath: string;
  /** Dismiss the dialog; the underlying engineError state is cleared by
   *  the caller. The next engine call will re-trigger the same dialog if
   *  the binary is still missing. */
  onDismiss: () => void;
};

const FETCH_COMMAND = 'npm run fetch-stockfish';

/**
 * Modal shown when the renderer's first engine call surfaces a
 * `STOCKFISH_NOT_FOUND` error. Tells the user *what* happened, *where* the
 * binary was expected, and exactly *which command* fixes it. Dismissing
 * leaves play in a degraded but usable state — board navigation still works
 * without the engine.
 */
export function EngineMissingDialog({
  binaryPath,
  onDismiss,
}: EngineMissingDialogProps): JSX.Element {
  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="engine-missing-title"
    >
      <div className="dialog">
        <h2 id="engine-missing-title">Stockfish not found</h2>
        <p>
          Hindsight ships its own Stockfish binary so analysis runs offline. The
          expected file isn&apos;t on disk:
        </p>
        <pre className="dialog__code">{binaryPath}</pre>
        <p>
          Run this from the project root to fetch the correct binary for your
          OS:
        </p>
        <pre className="dialog__code">{FETCH_COMMAND}</pre>
        <p className="dialog__hint">
          Then restart the app. If you have your own Stockfish binary, copy it
          to the path above (or set <code>HINDSIGHT_STOCKFISH</code> — coming in
          a future release).
        </p>
        <div className="dialog__actions">
          <button type="button" className="dialog__primary" onClick={onDismiss}>
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
