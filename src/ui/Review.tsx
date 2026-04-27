import { useEffect, useMemo, useState } from 'react';
import type { Square } from 'chess.js';
import type { Classification } from '../chess/classify';
import { Game } from '../chess/game';
import {
  formatEval,
  runGameReview,
  type EvalSnapshot,
  type GameReview,
  type ReviewedMove,
} from '../chess/review';
import type { MotifTag } from '../chess/templates/selector';
import { Board, type ArrowSpec } from './Board';
import { EvalBar } from './EvalBar';
import { MoveList } from './MoveList';
import { NavControls } from './NavControls';

export type ReviewProps = {
  /** The game to walk through. The component does not mutate it. */
  game: Game;
  orientation: 'white' | 'black';
  onFlip: () => void;
  onToggleTheme: () => void;
  /** Leave review mode and return to the previous (play / free) view. */
  onExit: () => void;
};

const REVIEW_DEPTH = 12;

/** Arrow color used for the engine's suggested-better-move overlay. Picked
 *  for contrast against both light and dark board palettes; close enough to
 *  the chess.com convention that returning users won't have to re-learn. */
const SUGGESTED_ARROW_COLOR = 'rgba(33, 150, 243, 0.85)';

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  brilliant: 'Brilliant',
  best: 'Best',
  excellent: 'Excellent',
  good: 'Good',
  inaccuracy: 'Inaccuracy',
  mistake: 'Mistake',
  blunder: 'Blunder',
  miss: 'Miss',
  book: 'Book',
};

/** NAG-style glyph rendered inside the panel badge. Mirrors the move-list
 *  annotations but covers all classifications (the move-list intentionally
 *  skips Best/Excellent/Good to avoid clutter; the panel always shows one). */
const CLASSIFICATION_GLYPH: Record<Classification, string> = {
  brilliant: '!!',
  best: '✓',
  excellent: '!',
  good: '·',
  inaccuracy: '?!',
  mistake: '?',
  blunder: '??',
  miss: '?!',
  book: 'B',
};

const MOTIF_LABEL: Record<MotifTag, string> = {
  hanging: 'Hanging piece',
  fork: 'Fork',
  pin: 'Pin',
  skewer: 'Skewer',
  discoveredAttack: 'Discovered attack',
  discoveredCheck: 'Discovered check',
  doubleAttack: 'Double attack',
  backRank: 'Back-rank weakness',
  overloaded: 'Overloaded defender',
  removingDefender: 'Removing the defender',
};

/**
 * Phase 11 / Task 1 — review screen. Runs the full analysis pipeline once
 * for the supplied game, then lets the user walk through it move-by-move.
 * Reuses Board / EvalBar / NavControls / MoveList so the UX matches the
 * play view; adds an explanation panel pinned to the current ply.
 */
export function Review({
  game,
  orientation,
  onFlip,
  onToggleTheme,
  onExit,
}: ReviewProps): JSX.Element {
  const history = useMemo(() => game.history(), [game]);
  const totalPlies = history.length;

  const [viewPly, setViewPly] = useState(0);
  const [status, setStatus] = useState<
    'idle' | 'analyzing' | 'ready' | 'error'
  >('idle');
  const [progress, setProgress] = useState({ done: 0, total: totalPlies });
  const [result, setResult] = useState<GameReview | null>(null);
  const [error, setError] = useState<string | null>(null);

  const displayed = useMemo(() => {
    const g = new Game();
    for (let i = 0; i < viewPly; i += 1) g.move(history[i]);
    return g;
  }, [history, viewPly]);

  useEffect(() => {
    if (totalPlies === 0) {
      setStatus('ready');
      setResult({ perMove: [], opening: null });
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setStatus('analyzing');
    setProgress({ done: 0, total: totalPlies });
    setError(null);
    void runGameReview(game, {
      depth: REVIEW_DEPTH,
      signal: ac.signal,
      onProgress: (done, total) => {
        if (cancelled) return;
        setProgress({ done, total });
      },
    })
      .then((r) => {
        if (cancelled) return;
        setResult(r);
        setStatus('ready');
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : String(err));
        setStatus('error');
      });
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [game, totalPlies]);

  const evalForView = useMemo(
    () => computeEvalForView(viewPly, totalPlies, result?.perMove ?? null),
    [viewPly, totalPlies, result],
  );

  const annotations = useMemo(() => {
    if (!result) return undefined;
    return result.perMove.map((m) => m.classification);
  }, [result]);

  const currentMove: ReviewedMove | null =
    viewPly > 0 && result ? (result.perMove[viewPly - 1] ?? null) : null;

  // Engine-suggested arrow: drawn only when the engine preferred something
  // other than what the player chose. Squares come from the pre-move
  // position, so the source square is sometimes empty in the displayed
  // (post-move) board — accepted compromise; flipping the displayed view
  // to pre-move would re-shape every other piece of the UX.
  const arrows = useMemo<readonly ArrowSpec[] | undefined>(() => {
    if (!currentMove?.bestUci) return undefined;
    if (currentMove.bestSan && currentMove.bestSan === currentMove.san) {
      return undefined;
    }
    const from = currentMove.bestUci.slice(0, 2) as Square;
    const to = currentMove.bestUci.slice(2, 4) as Square;
    return [[from, to, SUGGESTED_ARROW_COLOR] as const];
  }, [currentMove]);

  const headerLine = (() => {
    if (status === 'analyzing') {
      return `Analyzing… ${progress.done} / ${progress.total} plies.`;
    }
    if (status === 'error') return `Analysis failed: ${error ?? 'unknown'}.`;
    if (totalPlies === 0) return 'No moves to review.';
    if (!result?.opening) return 'Review';
    return `${result.opening.eco}: ${result.opening.name}`;
  })();

  return (
    <div className="play-area">
      <EvalBar
        evalCp={evalForView.cp}
        mateIn={evalForView.mate}
        orientation={orientation}
      />
      <div className="board-frame">
        <Board
          game={displayed}
          width={520}
          orientation={orientation}
          arrows={arrows}
        />
      </div>
      <aside className="side-panel">
        <p className="review-header">{headerLine}</p>
        <NavControls
          canPrev={viewPly > 0}
          canNext={viewPly < totalPlies}
          onFirst={() => setViewPly(0)}
          onPrev={() => setViewPly((p) => Math.max(0, p - 1))}
          onNext={() => setViewPly((p) => Math.min(totalPlies, p + 1))}
          onLast={() => setViewPly(totalPlies)}
          onFlip={onFlip}
          onToggleTheme={onToggleTheme}
        />
        <MoveList
          history={history}
          currentPly={viewPly}
          onSelect={setViewPly}
          annotations={annotations}
        />
        {currentMove ? (
          <ExplanationPanel move={currentMove} />
        ) : status === 'ready' && totalPlies > 0 ? (
          <p className="status">Use Next to step through the game.</p>
        ) : null}
        <button type="button" className="header-secondary-btn" onClick={onExit}>
          Exit review
        </button>
      </aside>
    </div>
  );
}

function ExplanationPanel({ move }: { move: ReviewedMove }): JSX.Element {
  const label = CLASSIFICATION_LABEL[move.classification];
  const glyph = CLASSIFICATION_GLYPH[move.classification];
  const showAlt = Boolean(move.bestSan) && move.bestSan !== move.san;
  const cpLossPawns =
    move.cpLoss != null && move.cpLoss > 0 ? move.cpLoss / 100 : null;
  return (
    <div className={`review-panel review-panel--${move.classification}`}>
      <header className="review-panel__heading">
        <span
          className={`review-panel__badge review-panel__badge--${move.classification}`}
          aria-label={label}
        >
          {glyph}
        </span>
        <span className="review-panel__san">{move.san}</span>
        <span className="review-panel__classification">{label}</span>
        <span className="review-panel__eval">{formatEval(move.evalAfter)}</span>
      </header>
      {move.explanation ? (
        <p className="review-panel__explanation">{move.explanation}</p>
      ) : null}
      {showAlt ? (
        <p className="review-panel__best">
          Engine preferred <strong>{move.bestSan}</strong>
          {cpLossPawns != null
            ? ` — gives up ${cpLossPawns.toFixed(2)} pawns`
            : ''}
          .
        </p>
      ) : null}
      {move.motifs.length > 0 ? (
        <ul className="review-panel__motifs" aria-label="Detected motifs">
          {move.motifs.map((m) => (
            <li key={m} className="review-panel__motif">
              {MOTIF_LABEL[m]}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/**
 * Resolve the eval to show for a given displayed ply. White-POV; falls back
 * to a neutral 0 when the review hasn't loaded yet.
 */
function computeEvalForView(
  viewPly: number,
  totalPlies: number,
  perMove: readonly ReviewedMove[] | null,
): EvalSnapshot {
  if (!perMove || perMove.length === 0) return { cp: 0, mate: null };
  if (viewPly === 0) return perMove[0].evalBefore;
  if (viewPly < totalPlies) {
    // Position after viewPly moves — the eval *facing* the next move is
    // evalBefore of perMove[viewPly].
    return perMove[viewPly]?.evalBefore ?? perMove[viewPly - 1].evalAfter;
  }
  // viewPly === totalPlies: post-final-move eval.
  return perMove[totalPlies - 1].evalAfter;
}
