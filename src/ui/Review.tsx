import { useEffect, useMemo, useState } from 'react';
import { Game } from '../chess/game';
import {
  runGameReview,
  type EvalSnapshot,
  type GameReview,
  type ReviewedMove,
} from '../chess/review';
import { Board } from './Board';
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

const CLASSIFICATION_LABEL: Record<string, string> = {
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
        <Board game={displayed} width={520} orientation={orientation} />
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
  const label =
    CLASSIFICATION_LABEL[move.classification] ?? move.classification;
  return (
    <div className={`review-panel review-panel--${move.classification}`}>
      <p className="review-panel__heading">
        <span className="review-panel__san">{move.san}</span>
        <span className="review-panel__classification">{label}</span>
      </p>
      {move.explanation ? (
        <p className="review-panel__explanation">{move.explanation}</p>
      ) : null}
      {move.bestSan && move.bestSan !== move.san ? (
        <p className="review-panel__best">
          Engine prefers <strong>{move.bestSan}</strong>
          {move.cpLoss != null && move.cpLoss > 0
            ? ` (loss ≈ ${move.cpLoss} cp)`
            : ''}
          .
        </p>
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
