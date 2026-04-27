export type NavControlsProps = {
  canPrev: boolean;
  canNext: boolean;
  onFirst: () => void;
  onPrev: () => void;
  onNext: () => void;
  onLast: () => void;
  onFlip: () => void;
};

/**
 * First / Prev / Next / Last / Flip board buttons. Disabled buttons are
 * non-interactive but stay visible so the layout doesn't shift when toggling
 * between "at start" and "at end" states.
 */
export function NavControls({
  canPrev,
  canNext,
  onFirst,
  onPrev,
  onNext,
  onLast,
  onFlip,
}: NavControlsProps): JSX.Element {
  return (
    <div className="nav-controls">
      <button
        type="button"
        onClick={onFirst}
        disabled={!canPrev}
        title="First move"
        aria-label="Jump to start"
      >
        |&lt;
      </button>
      <button
        type="button"
        onClick={onPrev}
        disabled={!canPrev}
        title="Previous move"
        aria-label="Previous move"
      >
        &lt;
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canNext}
        title="Next move"
        aria-label="Next move"
      >
        &gt;
      </button>
      <button
        type="button"
        onClick={onLast}
        disabled={!canNext}
        title="Last move"
        aria-label="Jump to end"
      >
        &gt;|
      </button>
      <button
        type="button"
        onClick={onFlip}
        title="Flip board"
        aria-label="Flip board"
      >
        Flip
      </button>
    </div>
  );
}
