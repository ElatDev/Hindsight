import { describe, expect, it, vi } from 'vitest';
import { analyzeGame } from '../analysis';
import { Game } from '../game';
import type { AnalysisResult, AnalyzeRequest } from '../../../shared/ipc';

const stubResult = (
  bestMove: string | null,
  evalCp: number | null,
  mateIn: number | null = null,
): AnalysisResult => ({
  bestMove,
  lines: [
    {
      depth: 16,
      multipv: 1,
      pv: bestMove ? [bestMove] : [],
      evalCp,
      mateIn,
    },
  ],
});

describe('analyzeGame', () => {
  it('returns one record per played ply, in order', async () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');

    const analyze = vi.fn(async (_req: AnalyzeRequest) =>
      stubResult('a1a2', 25),
    );
    const results = await analyzeGame(game, { depth: 16, analyze });

    expect(results).toHaveLength(3);
    expect(results.map((r) => r.ply)).toEqual([1, 2, 3]);
    expect(results.map((r) => r.san)).toEqual(['e4', 'e5', 'Nf3']);
    expect(results[0].uciPlayed).toBe('e2e4');
    expect(results[1].uciPlayed).toBe('e7e5');
    expect(results[2].uciPlayed).toBe('g1f3');
    expect(analyze).toHaveBeenCalledTimes(3);
  });

  it('records the FEN faced *before* each move, not after', async () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');

    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubResult(null, 0));
    const results = await analyzeGame(game, { depth: 12, analyze });

    expect(results[0].fenBefore).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    // Before 1...e5 the black e-pawn is still on e7 — it's white who moved.
    expect(results[1].fenBefore.startsWith('rnbqkbnr/pppppppp/8/8/4P3/')).toBe(
      true,
    );
  });

  it('forwards the engine eval / bestMove untouched', async () => {
    const game = new Game();
    game.move('e4');

    const analyze = vi.fn(async (_req: AnalyzeRequest) =>
      stubResult('e7e5', 12, null),
    );
    const [first] = await analyzeGame(game, { depth: 16, analyze });

    expect(first.bestMove).toBe('e7e5');
    expect(first.evalCp).toBe(12);
    expect(first.mateIn).toBeNull();
  });

  it('passes the requested depth to the analyzer', async () => {
    const game = new Game();
    game.move('e4');

    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubResult(null, 0));
    await analyzeGame(game, { depth: 22, analyze });

    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({ depth: 22 }),
    );
  });

  it('emits onProgress after each ply with the running record', async () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');

    const analyze = vi.fn(async (_req: AnalyzeRequest) =>
      stubResult('a1a2', 0),
    );
    const onProgress = vi.fn();
    await analyzeGame(game, { depth: 12, analyze, onProgress });

    expect(onProgress).toHaveBeenCalledTimes(2);
    expect(onProgress).toHaveBeenNthCalledWith(
      1,
      1,
      2,
      expect.objectContaining({ ply: 1, san: 'e4' }),
    );
    expect(onProgress).toHaveBeenNthCalledWith(
      2,
      2,
      2,
      expect.objectContaining({ ply: 2, san: 'e5' }),
    );
  });

  it('aborts early when the signal is already aborted', async () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');

    const controller = new AbortController();
    controller.abort();
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubResult(null, 0));
    const results = await analyzeGame(game, {
      depth: 12,
      analyze,
      signal: controller.signal,
    });

    expect(results).toHaveLength(0);
    expect(analyze).not.toHaveBeenCalled();
  });

  it('captures promotion in the played UCI', async () => {
    const game = Game.fromFen('8/P7/8/8/8/8/k7/4K3 w - - 0 1');
    game.move('a8=Q');
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubResult(null, 1));
    const [rec] = await analyzeGame(game, { depth: 6, analyze });
    expect(rec.uciPlayed).toBe('a7a8q');
  });
});
