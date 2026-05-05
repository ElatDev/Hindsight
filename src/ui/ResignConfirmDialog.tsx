import { useDialogDismiss } from './useDialogDismiss';

export type ResignConfirmDialogProps = {
  /** Side that's about to resign — names the loser in the prompt so the
   *  user is clear about which colour they're forfeiting. */
  side: 'white' | 'black';
  onConfirm: () => void;
  onCancel: () => void;
};

export function ResignConfirmDialog({
  side,
  onConfirm,
  onCancel,
}: ResignConfirmDialogProps): JSX.Element {
  const dismissProps = useDialogDismiss(onCancel);
  const opponent = side === 'white' ? 'Black' : 'White';
  return (
    <div
      className="dialog-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="resign-confirm-title"
      {...dismissProps}
    >
      <div className="dialog">
        <h2 id="resign-confirm-title">Resign?</h2>
        <p>
          You&apos;ll forfeit the game and {opponent} will be recorded as the
          winner. The move list stays intact, so you can still review the game
          and see what the engine would have preferred.
        </p>
        <div className="dialog__actions">
          <button type="button" onClick={onCancel}>
            Cancel
          </button>
          <button type="button" className="dialog__primary" onClick={onConfirm}>
            Resign
          </button>
        </div>
      </div>
    </div>
  );
}
