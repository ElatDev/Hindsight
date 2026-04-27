import type { SanMove } from '../chess/game';

export type MoveListProps = {
  /** Full move history in SAN. */
  history: SanMove[];
  /**
   * Ply index currently displayed on the board. 0 = initial position (no
   * moves played); `history.length` = position after the last move. The list
   * highlights `history[currentPly - 1]`.
   */
  currentPly: number;
  /** Click handler. `ply` is the index to jump to (0..history.length). */
  onSelect: (ply: number) => void;
};

/**
 * Move list rendered as numbered pairs (white move + black move). The
 * currently-displayed ply is highlighted; clicking any move jumps the board
 * to that ply.
 */
export function MoveList({
  history,
  currentPly,
  onSelect,
}: MoveListProps): JSX.Element {
  if (history.length === 0) {
    return <div className="move-list move-list--empty">No moves yet.</div>;
  }

  const rows: { number: number; white: SanMove; black?: SanMove }[] = [];
  for (let i = 0; i < history.length; i += 2) {
    rows.push({
      number: i / 2 + 1,
      white: history[i],
      black: history[i + 1],
    });
  }

  return (
    <ol className="move-list">
      {rows.map((row, rowIdx) => {
        const whitePly = rowIdx * 2 + 1;
        const blackPly = rowIdx * 2 + 2;
        return (
          <li key={row.number} className="move-list__row">
            <span className="move-list__number">{row.number}.</span>
            <button
              type="button"
              className={`move-list__move${
                currentPly === whitePly ? ' move-list__move--current' : ''
              }`}
              onClick={() => onSelect(whitePly)}
            >
              {row.white}
            </button>
            {row.black ? (
              <button
                type="button"
                className={`move-list__move${
                  currentPly === blackPly ? ' move-list__move--current' : ''
                }`}
                onClick={() => onSelect(blackPly)}
              >
                {row.black}
              </button>
            ) : (
              <span className="move-list__move move-list__move--placeholder" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
