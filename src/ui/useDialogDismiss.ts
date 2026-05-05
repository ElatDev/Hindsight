import { useEffect } from 'react';
import type { MouseEvent } from 'react';

export type DialogOverlayProps = {
  onMouseDown: (e: MouseEvent<HTMLDivElement>) => void;
};

/**
 * Standard "Esc dismisses, click on backdrop dismisses" wiring shared by every
 * modal dialog in the app. Returns props to spread on the `.dialog-overlay`
 * root.
 *
 * Backdrop click uses `mousedown` rather than `click` so a drag that starts
 * inside a dialog field (e.g., selecting text in the PGN textarea) and
 * finishes on the overlay doesn't unintentionally close the dialog. The
 * `e.target === e.currentTarget` check filters out events bubbled from the
 * inner `.dialog`.
 *
 * The Esc listener is attached to `document` so it fires regardless of focus
 * — typing in an input still allows Esc-to-dismiss.
 */
export function useDialogDismiss(onDismiss: () => void): DialogOverlayProps {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onDismiss();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onDismiss]);

  return {
    onMouseDown: (e) => {
      if (e.target === e.currentTarget) onDismiss();
    },
  };
}
