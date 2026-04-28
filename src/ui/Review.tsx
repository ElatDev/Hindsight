import { useEffect, useMemo, useState } from 'react';
import type { Square } from 'chess.js';
import type { Classification } from '../chess/classify';
import { Game } from '../chess/game';
import {
  emptyReview,
  formatEval,
  runGameReview,
  type EvalSnapshot,
  type GameReview,
  type GameSummary,
  type ReviewedAlternative,
  type ReviewedMove,
} from '../chess/review';
import type { CriticalMoment } from '../chess/critical';
import type { MotifTag } from '../chess/templates/selector';
import { exportAnnotatedPgn } from '../chess/pgnExport';
import { Board, type ArrowSpec, type GradeBadge } from './Board';
import { EvalBar } from './EvalBar';
import { MaterialAdvantage } from './MaterialAdvantage';
import { MoveList } from './MoveList';
import { NavControls } from './NavControls';
import { PositionalPanel } from './PositionalPanel';
import type { BoardTheme } from './useSettings';

export type ReviewProps = {
  /** The game to walk through. The component does not mutate it. */
  game: Game;
  orientation: 'white' | 'black';
  /** Stockfish search depth fed into `runGameReview`. Sourced from the
   *  Settings dialog (Phase 12 / Task 1); falls back to 12 if unset. */
  analysisDepth?: number;
  /** Board palette key from the Settings dialog (Phase 12 / Task 8). */
  boardTheme?: BoardTheme;
  onFlip: () => void;
  onToggleTheme: () => void;
  /** Leave review mode and return to the previous (play / free) view. */
  onExit: () => void;
};

const DEFAULT_REVIEW_DEPTH = 12;

/** Arrow color used for the engine's suggested-better-move overlay. Picked
 *  for contrast against both light and dark board palettes; close enough to
 *  the chess.com convention that returning users won't have to re-learn. */
const SUGGESTED_ARROW_COLOR = 'rgba(33, 150, 243, 0.85)';

const CLASSIFICATION_LABEL: Record<Classification, string> = {
  sharp: 'Sharp',
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
  sharp: '!!',
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
  analysisDepth = DEFAULT_REVIEW_DEPTH,
  boardTheme,
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
  const [exportStatus, setExportStatus] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  // Bumped to force the analysis effect to re-run on user-requested retry.
  const [retryToken, setRetryToken] = useState(0);

  const displayed = useMemo(() => {
    const g = new Game();
    for (let i = 0; i < viewPly; i += 1) g.move(history[i]);
    return g;
  }, [history, viewPly]);

  useEffect(() => {
    if (totalPlies === 0) {
      setStatus('ready');
      setResult(emptyReview());
      return;
    }
    let cancelled = false;
    const ac = new AbortController();
    setStatus('analyzing');
    setProgress({ done: 0, total: totalPlies });
    setError(null);
    void runGameReview(game, {
      depth: analysisDepth,
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
  }, [game, totalPlies, analysisDepth, retryToken]);

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

  // On-piece grade badge: the destination square of the just-played move
  // gets a small classification-coloured glyph. Skipped at the start of the
  // game (viewPly === 0) and for `book` moves so the opening doesn't get
  // visually noisy.
  const gradeBadge = useMemo<GradeBadge | null>(() => {
    if (!currentMove) return null;
    if (currentMove.classification === 'book') return null;
    return {
      square: currentMove.toSquare,
      classification: currentMove.classification,
    };
  }, [currentMove]);

  const handleSaveAnnotatedPgn = async (): Promise<void> => {
    if (!result || totalPlies === 0) return;
    try {
      const pgn = exportAnnotatedPgn(game, result);
      const headers = game.headers();
      const slug = (headers.White ?? 'white')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const opp = (headers.Black ?? 'black')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
      const defaultFileName = `${slug}-vs-${opp}-hindsight.pgn`;
      const saved = await window.hindsight.pgn.saveFile({
        pgn,
        defaultFileName,
      });
      if (saved) {
        setExportStatus({
          kind: 'success',
          message: `Saved to ${saved.path}`,
        });
      } else {
        // User cancelled the native save dialog — drop any prior message so
        // a stale "Saved to ..." doesn't linger from an earlier export.
        setExportStatus(null);
      }
    } catch (err: unknown) {
      setExportStatus({
        kind: 'error',
        message: `Export failed: ${err instanceof Error ? err.message : String(err)}`,
      });
    }
  };

  const headerLine = (() => {
    if (status === 'analyzing') {
      return `Analyzing… ${progress.done} / ${progress.total} plies.`;
    }
    if (status === 'error') {
      const msg = error ?? 'unknown';
      // Stockfish-not-found is rendered separately as a modal in the play
      // shell; the inline header just nods to it so the user knows why
      // analysis bailed.
      if (msg.includes('[STOCKFISH_NOT_FOUND]')) {
        return 'Analysis paused — Stockfish binary missing.';
      }
      return `Analysis failed: ${msg}.`;
    }
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
      <div className="board-stack">
        <MaterialAdvantage
          game={displayed}
          side={orientation === 'white' ? 'b' : 'w'}
        />
        <div className="board-frame">
          <Board
            game={displayed}
            width={520}
            orientation={orientation}
            boardTheme={boardTheme}
            arrows={arrows}
            gradeBadge={gradeBadge}
          />
        </div>
        <MaterialAdvantage
          game={displayed}
          side={orientation === 'white' ? 'w' : 'b'}
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
        {totalPlies > 0 ? <PositionalPanel game={displayed} /> : null}
        {status === 'error' ? (
          <button
            type="button"
            className="header-secondary-btn"
            onClick={() => setRetryToken((t) => t + 1)}
          >
            Retry analysis
          </button>
        ) : null}
        {status === 'ready' && totalPlies > 0 && result ? (
          <>
            <SummaryPanel summary={result.summary} />
            {result.summary.criticalMoments.length > 0 ? (
              <CriticalMomentsList
                moments={result.summary.criticalMoments}
                currentPly={viewPly}
                onSelect={setViewPly}
              />
            ) : null}
            <button
              type="button"
              className="header-secondary-btn"
              onClick={() => void handleSaveAnnotatedPgn()}
            >
              Save annotated PGN
            </button>
            {exportStatus ? (
              <p
                className={`status review-export-status review-export-status--${exportStatus.kind}`}
                role={exportStatus.kind === 'error' ? 'alert' : 'status'}
              >
                {exportStatus.message}
              </p>
            ) : null}
          </>
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
  const showBest = Boolean(move.bestSan) && move.bestSan !== move.san;
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
      {showBest ? (
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
      {move.alternatives.length > 0 ? (
        <AlternativesList alternatives={move.alternatives} />
      ) : null}
    </div>
  );
}

function AlternativesList({
  alternatives,
}: {
  alternatives: readonly ReviewedAlternative[];
}): JSX.Element {
  return (
    <div className="review-alternatives" aria-label="Engine alternatives">
      <span className="review-alternatives__label">Alternatives</span>
      <ol className="review-alternatives__list">
        {alternatives.map((alt) => (
          <li key={alt.uci} className="review-alternatives__item">
            <span className="review-alternatives__san">{alt.san}</span>
            <span className="review-alternatives__eval">
              {formatAlternativeEval(alt)}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Format a mover-POV alternative eval as a signed pawn fraction or `Mn`.
 *  Stays distinct from `formatEval` because that one assumes white-POV. */
function formatAlternativeEval(alt: ReviewedAlternative): string {
  if (alt.mateIn != null) {
    return alt.mateIn >= 0 ? `M${alt.mateIn}` : `M-${Math.abs(alt.mateIn)}`;
  }
  if (alt.evalCp != null) {
    const pawns = alt.evalCp / 100;
    const sign = pawns > 0 ? '+' : '';
    return `${sign}${pawns.toFixed(2)}`;
  }
  return '?';
}

/** Classifications shown in the summary count strip, ordered roughly from
 *  best to worst. Zero-count buckets are hidden so a clean game doesn't look
 *  cluttered with rows full of zeros. */
const SUMMARY_CLASSIFICATIONS: readonly Classification[] = [
  'sharp',
  'best',
  'excellent',
  'good',
  'book',
  'inaccuracy',
  'mistake',
  'miss',
  'blunder',
];

function SummaryPanel({ summary }: { summary: GameSummary }): JSX.Element {
  return (
    <section className="review-summary" aria-label="Game summary">
      <header className="review-summary__heading">Summary</header>
      <div className="review-summary__accuracy">
        <AccuracyRow side="White" overall={summary.accuracy.white.overall} />
        <AccuracyRow side="Black" overall={summary.accuracy.black.overall} />
      </div>
      <table className="review-summary__counts">
        <thead>
          <tr>
            <th aria-label="Classification" />
            <th>W</th>
            <th>B</th>
          </tr>
        </thead>
        <tbody>
          {SUMMARY_CLASSIFICATIONS.map((c) => {
            const w = summary.counts.white[c];
            const b = summary.counts.black[c];
            if (w === 0 && b === 0) return null;
            return (
              <tr key={c}>
                <th scope="row">
                  <span
                    className={`review-panel__badge review-panel__badge--${c} review-summary__badge`}
                    aria-label={CLASSIFICATION_LABEL[c]}
                  >
                    {CLASSIFICATION_GLYPH[c]}
                  </span>
                  <span className="review-summary__count-label">
                    {CLASSIFICATION_LABEL[c]}
                  </span>
                </th>
                <td>{w}</td>
                <td>{b}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

function AccuracyRow({
  side,
  overall,
}: {
  side: 'White' | 'Black';
  overall: number;
}): JSX.Element {
  return (
    <div className="review-summary__acc-row">
      <span className="review-summary__acc-side">{side}</span>
      <span className="review-summary__acc-value">{overall.toFixed(1)}</span>
    </div>
  );
}

function CriticalMomentsList({
  moments,
  currentPly,
  onSelect,
}: {
  moments: readonly CriticalMoment[];
  currentPly: number;
  onSelect: (ply: number) => void;
}): JSX.Element {
  return (
    <section className="review-criticals" aria-label="Critical moments">
      <header className="review-summary__heading">Critical moments</header>
      <ol className="review-criticals__list">
        {moments.map((m) => {
          const moveNumber = Math.floor((m.ply + 1) / 2);
          const dots = m.ply % 2 === 1 ? '.' : '...';
          const swing = `${m.wpDelta >= 0 ? '+' : '−'}${Math.round(Math.abs(m.wpDelta))}%`;
          const moverHurt = m.wpDelta < 0;
          const isCurrent = currentPly === m.ply;
          const className = [
            'review-criticals__item',
            isCurrent ? 'review-criticals__item--current' : '',
            moverHurt
              ? 'review-criticals__item--down'
              : 'review-criticals__item--up',
          ]
            .filter(Boolean)
            .join(' ');
          return (
            <li key={m.ply}>
              <button
                type="button"
                className={className}
                onClick={() => onSelect(m.ply)}
              >
                <span className="review-criticals__ply">
                  {moveNumber}
                  {dots}
                </span>
                <span className="review-criticals__san">{m.san}</span>
                <span className="review-criticals__swing">{swing}</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
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
