import type { Classification } from '../chess/classify';
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
  /** Optional per-move classification. When provided, each move gets the
   *  matching annotation icon (`!`, `??`, etc.) rendered next to its SAN. */
  annotations?: readonly Classification[];
};

/**
 * Annotation icon shown beside a move when its classification is non-neutral.
 * Maps to the chess-conventional NAG glyphs: `!!`/`!`/`!?`/`?!`/`?`/`??`. We
 * skip Best/Excellent/Good — those are common enough that a glyph would just
 * be visual noise. `book` gets `B` so the user can see the opening was still
 * in theory; `miss` gets `?!` (chess convention for "missed a tactic").
 */
const CLASSIFICATION_GLYPH: Partial<Record<Classification, string>> = {
  sharp: '!!',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  miss: '?!',
  book: 'B',
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
  annotations,
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
            <MoveButton
              san={row.white}
              ply={whitePly}
              currentPly={currentPly}
              annotation={annotations?.[whitePly - 1]}
              onSelect={onSelect}
            />
            {row.black ? (
              <MoveButton
                san={row.black}
                ply={blackPly}
                currentPly={currentPly}
                annotation={annotations?.[blackPly - 1]}
                onSelect={onSelect}
              />
            ) : (
              <span className="move-list__move move-list__move--placeholder" />
            )}
          </li>
        );
      })}
    </ol>
  );
}

function MoveButton({
  san,
  ply,
  currentPly,
  annotation,
  onSelect,
}: {
  san: SanMove;
  ply: number;
  currentPly: number;
  annotation?: Classification;
  onSelect: (ply: number) => void;
}): JSX.Element {
  const glyph = annotation ? CLASSIFICATION_GLYPH[annotation] : undefined;
  const isCurrent = currentPly === ply;
  const className = [
    'move-list__move',
    isCurrent ? 'move-list__move--current' : '',
    annotation ? `move-list__move--${annotation}` : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <button type="button" className={className} onClick={() => onSelect(ply)}>
      <span className="move-list__san">{san}</span>
      {glyph ? (
        <span
          className={`move-list__annotation move-list__annotation--${annotation}`}
          aria-label={annotation}
        >
          {glyph}
        </span>
      ) : null}
    </button>
  );
}
