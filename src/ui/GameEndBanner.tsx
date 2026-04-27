import type { GameEnd } from '../chess/game';

const REASON_TEXT: Record<NonNullable<GameEnd>, string> = {
  checkmate: 'Checkmate.',
  stalemate: 'Stalemate.',
  'threefold-repetition': 'Draw by threefold repetition.',
  'fifty-move': 'Draw by the fifty-move rule.',
  'insufficient-material': 'Draw by insufficient material.',
  draw: 'Draw.',
};

export type GameEndBannerProps = {
  /** Non-null game-end reason; the banner only renders when there is one. */
  reason: NonNullable<GameEnd>;
  /** Side that won, or null for draws. */
  winner: 'white' | 'black' | null;
  onReview: () => void;
  onNewGame: () => void;
  onDismiss: () => void;
};

/**
 * Banner shown when the active game ends. Offers a "Review" action (Phase 6
 * will wire this up to the analysis pipeline; today it just calls back to the
 * parent) and a "New game" shortcut.
 */
export function GameEndBanner({
  reason,
  winner,
  onReview,
  onNewGame,
  onDismiss,
}: GameEndBannerProps): JSX.Element {
  const headline =
    winner === null
      ? 'Game drawn.'
      : `${winner === 'white' ? 'White' : 'Black'} wins.`;
  return (
    <div className="game-end-banner" role="status">
      <div className="game-end-banner__text">
        <strong>{headline}</strong>
        <span> {REASON_TEXT[reason]}</span>
      </div>
      <div className="game-end-banner__actions">
        <button type="button" onClick={onReview}>
          Review
        </button>
        <button
          type="button"
          className="game-end-banner__primary"
          onClick={onNewGame}
        >
          New game
        </button>
        <button
          type="button"
          className="game-end-banner__dismiss"
          onClick={onDismiss}
          aria-label="Dismiss"
        >
          x
        </button>
      </div>
    </div>
  );
}
