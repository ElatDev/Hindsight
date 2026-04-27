import type { AnalysisLine, AnalysisResult } from '../../shared/ipc';
import type { StockfishEngine } from './stockfish';

export type { AnalysisLine, AnalysisResult };

export type AnalyzeOptions = {
  /** Search depth (plies). */
  depth: number;
  /** Number of principal variations to compute. Defaults to 1. */
  multiPV?: number;
  /** Hard timeout for the whole analysis call, in ms. Defaults to 60s. */
  timeoutMs?: number;
};

/**
 * Analyse a position to a fixed depth and return the engine's evaluation plus
 * up to `multiPV` principal variations. Requires the caller to have already
 * called `engine.start()`.
 */
export async function analyzePosition(
  engine: StockfishEngine,
  fen: string,
  opts: AnalyzeOptions,
): Promise<AnalysisResult> {
  const multiPV = opts.multiPV ?? 1;
  const timeoutMs = opts.timeoutMs ?? 60_000;

  engine.send(`setoption name MultiPV value ${multiPV}`);
  engine.send(`position fen ${fen}`);

  return new Promise<AnalysisResult>((resolve, reject) => {
    const linesByMultipv = new Map<number, AnalysisLine>();

    const onLine = (rawLine: string): void => {
      const trimmed = rawLine.trim();
      if (trimmed.startsWith('info ')) {
        const parsed = parseInfoLine(trimmed);
        if (parsed) linesByMultipv.set(parsed.multipv, parsed);
        return;
      }
      if (trimmed.startsWith('bestmove ')) {
        const parts = trimmed.split(/\s+/);
        const bm = parts[1];
        cleanup();
        const sortedLines = [...linesByMultipv.entries()]
          .sort(([a], [b]) => a - b)
          .map(([, v]) => v);
        resolve({
          bestMove: !bm || bm === '(none)' ? null : bm,
          lines: sortedLines,
        });
      }
    };

    const onExit = (code: number | null): void => {
      cleanup();
      reject(
        new Error(`Stockfish exited (code=${code}) during analysis of ${fen}.`),
      );
    };

    const cleanup = (): void => {
      clearTimeout(timer);
      engine.off('line', onLine);
      engine.off('exit', onExit);
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(
        new Error(
          `analyzePosition timed out after ${timeoutMs}ms (depth=${opts.depth}, fen=${fen}).`,
        ),
      );
    }, timeoutMs);

    engine.on('line', onLine);
    engine.once('exit', onExit);

    engine.send(`go depth ${opts.depth}`);
  });
}

/**
 * Parse a single UCI `info ...` line. Returns null for info lines without a
 * `pv` field (e.g., `info string ...` or early `info depth N currmove ...`).
 *
 * Format reference:
 *   info depth N seldepth N multipv N score cp X|mate Y nodes ... pv m1 m2 ...
 */
function parseInfoLine(line: string): AnalysisLine | null {
  const tokens = line.split(/\s+/);
  let depth: number | null = null;
  let multipv = 1;
  let evalCp: number | null = null;
  let mateIn: number | null = null;
  let pv: string[] = [];

  for (let i = 0; i < tokens.length; i += 1) {
    const tok = tokens[i];
    if (tok === 'depth') {
      depth = Number(tokens[i + 1]);
      i += 1;
    } else if (tok === 'multipv') {
      multipv = Number(tokens[i + 1]);
      i += 1;
    } else if (tok === 'score') {
      const kind = tokens[i + 1];
      const value = Number(tokens[i + 2]);
      if (kind === 'cp') evalCp = value;
      else if (kind === 'mate') mateIn = value;
      i += 2;
    } else if (tok === 'pv') {
      pv = tokens.slice(i + 1);
      break;
    }
  }

  if (depth === null || pv.length === 0) return null;
  return { depth, multipv, evalCp, mateIn, pv };
}
