export type EvalBarProps = {
  /** Centipawn score from white's POV (positive = white better). Null when
   *  there's a mate score or no evaluation yet. */
  evalCp: number | null;
  /** Mate distance from white's POV. Positive = white mates in N, negative =
   *  black mates in N. Null when there's a centipawn score instead. */
  mateIn: number | null;
  /** Match the orientation of the adjacent board so the bar's white/black
   *  ends line up visually with the side closer to that colour. */
  orientation?: 'white' | 'black';
};

/**
 * Vertical eval bar. Currently driven by placeholder data from `App.tsx`;
 * Phase 6 will swap that out for live `analyzePosition` output. The math is:
 *
 *   percent_white = sigmoid(evalCp / 410) * 100
 *
 * 410 cp ≈ 0.84 share for white, which roughly matches the curve used by
 * Lichess. Mate scores clamp to 99% / 1%.
 */
export function EvalBar({
  evalCp,
  mateIn,
  orientation = 'white',
}: EvalBarProps): JSX.Element {
  const whiteShare = computeWhiteShare(evalCp, mateIn);
  const blackShare = 100 - whiteShare;

  const label =
    mateIn !== null
      ? `M${Math.abs(mateIn)}`
      : evalCp !== null
        ? formatCp(evalCp)
        : '--';

  // White always at the bottom of the bar in white-orientation, top in
  // black-orientation, so the bar matches the board's perspective.
  const flexDirection = orientation === 'white' ? 'column-reverse' : 'column';

  return (
    <div
      className="eval-bar"
      style={{ flexDirection }}
      role="img"
      aria-label={`Evaluation: ${label}`}
    >
      <div className="eval-bar__white" style={{ flexBasis: `${whiteShare}%` }}>
        {orientation === 'white' && whiteShare >= 50 ? (
          <span className="eval-bar__label">{label}</span>
        ) : null}
      </div>
      <div className="eval-bar__black" style={{ flexBasis: `${blackShare}%` }}>
        {orientation === 'white' && whiteShare < 50 ? (
          <span className="eval-bar__label">{label}</span>
        ) : null}
      </div>
    </div>
  );
}

function computeWhiteShare(
  evalCp: number | null,
  mateIn: number | null,
): number {
  if (mateIn !== null) return mateIn > 0 ? 99 : 1;
  if (evalCp === null) return 50;
  const sigmoid = 1 / (1 + Math.exp(-evalCp / 410));
  return Math.max(1, Math.min(99, sigmoid * 100));
}

function formatCp(cp: number): string {
  const pawns = cp / 100;
  const sign = pawns > 0 ? '+' : '';
  return `${sign}${pawns.toFixed(1)}`;
}
