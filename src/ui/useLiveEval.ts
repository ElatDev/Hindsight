import { useEffect, useRef, useState } from 'react';
import type { EvalSnapshot } from '../chess/review';

/**
 * Phase 12 / Task 7 — live engine evaluation during play. When `enabled` is
 * true the hook subscribes the renderer to `engine.analyze` on every FEN
 * change and exposes the white-POV eval as it lands. Disabled state always
 * yields a neutral `{ cp: 0, mate: null }` so the consumer can render the
 * bar without an "is it ready" branch.
 *
 * Concurrency: each new FEN bumps a request id; in-flight responses for
 * stale ids are dropped, so a fast sequence of moves can't show a lagging
 * eval. The IPC call itself can't be aborted from the renderer (Stockfish
 * runs in main), but the stale-guard keeps the UI honest.
 */
export type UseLiveEvalOptions = {
  /** Master switch — wired to `settings.liveEval`. When false the hook does
   *  no IPC at all and yields the neutral snapshot. */
  enabled: boolean;
  /** FEN of the position to evaluate. Changing this kicks a new analysis. */
  fen: string;
  /** Search depth. Defaults to 12 for snappy live updates. */
  depth?: number;
  /** When true, no analysis runs (used for game-over states or while the
   *  engine is busy serving the play loop). */
  paused?: boolean;
};

const NEUTRAL: EvalSnapshot = { cp: 0, mate: null };

export function useLiveEval(opts: UseLiveEvalOptions): EvalSnapshot {
  const { enabled, fen, depth = 12, paused = false } = opts;
  const [snap, setSnap] = useState<EvalSnapshot>(NEUTRAL);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || paused) {
      setSnap(NEUTRAL);
      return;
    }
    if (typeof window === 'undefined' || !window.hindsight?.engine?.analyze) {
      return;
    }
    const myReq = ++requestIdRef.current;
    const stm: 'w' | 'b' = fen.split(' ')[1] === 'b' ? 'b' : 'w';
    window.hindsight.engine
      .analyze({ fen, depth })
      .then((res) => {
        if (myReq !== requestIdRef.current) return;
        const line = res.lines[0];
        if (!line) {
          setSnap(NEUTRAL);
          return;
        }
        // engine reports from STM POV; flip to white-POV for the eval bar.
        const flip = stm === 'w' ? 1 : -1;
        setSnap({
          cp: line.evalCp != null ? line.evalCp * flip : null,
          mate: line.mateIn != null ? line.mateIn * flip : null,
        });
      })
      .catch(() => {
        if (myReq !== requestIdRef.current) return;
        // Swallow — eval bar simply stays at the previous value rather than
        // blanking out on a transient engine hiccup. The engine error path
        // for play-loop bestMove is the user-visible surface for hard fails.
      });
  }, [enabled, paused, fen, depth]);

  if (!enabled) return NEUTRAL;
  return snap;
}
