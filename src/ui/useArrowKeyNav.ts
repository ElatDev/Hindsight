import { useEffect } from 'react';

/**
 * Wires up Left/Right/Home/End keyboard navigation across a ply timeline.
 * Used by both the Play view and the Review view so the same gesture set
 * works everywhere.
 *
 * Skips when focus is in an `<input>` or `<textarea>` so typing in dialog
 * fields (PGN paste, saved-game name) keeps cursor movement.
 */
export function useArrowKeyNav(
  goTo: (ply: number) => void,
  viewPly: number,
  totalPlies: number,
): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }
      if (e.key === 'ArrowLeft') goTo(viewPly - 1);
      else if (e.key === 'ArrowRight') goTo(viewPly + 1);
      else if (e.key === 'Home') goTo(0);
      else if (e.key === 'End') goTo(totalPlies);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [goTo, viewPly, totalPlies]);
}
