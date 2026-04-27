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
    const results = await analyzeGame(game, {
      depth: 16,
      analyze,
      analyzeAfter: false,
    });

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
    const results = await analyzeGame(game, {
      depth: 12,
      analyze,
      analyzeAfter: false,
    });

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
    const [first] = await analyzeGame(game, {
      depth: 16,
      analyze,
      analyzeAfter: false,
    });

    expect(first.bestMove).toBe('e7e5');
    expect(first.evalCp).toBe(12);
    expect(first.mateIn).toBeNull();
  });

  it('passes the requested depth to the analyzer', async () => {
    const game = new Game();
    game.move('e4');

    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubResult(null, 0));
    await analyzeGame(game, { depth: 22, analyze, analyzeAfter: false });

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
    await analyzeGame(game, {
      depth: 12,
      analyze,
      onProgress,
      analyzeAfter: false,
    });

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
    const [rec] = await analyzeGame(game, {
      depth: 6,
      analyze,
      analyzeAfter: false,
    });
    expect(rec.uciPlayed).toBe('a7a8q');
  });

  it('analyzeAfter:true triggers a second engine call per ply and flips POV', async () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');

    // First call returns +30 from white's POV; after 1.e4 it's black's turn so
    // the second call should report from black's POV — return -30 (black's
    // perspective: white is +30 ahead). The orchestrator should flip the sign
    // so we record +30 from the original mover (white)'s POV.
    let callIndex = 0;
    const analyze = vi.fn(async (_req: AnalyzeRequest) => {
      callIndex += 1;
      // Odd calls = "before" position from white's POV.
      // Even calls = "after" position from black's POV.
      const evalCp = callIndex % 2 === 1 ? 30 : -30;
      return stubResult(null, evalCp);
    });

    const results = await analyzeGame(game, { depth: 12, analyze });

    expect(analyze).toHaveBeenCalledTimes(4); // 2 plies × 2 calls each
    expect(results[0].evalCp).toBe(30);
    expect(results[0].evalCpAfter).toBe(30); // -(-30) flipped to white's POV
    expect(results[1].evalCp).toBe(30); // black's perspective from stub odd
    expect(results[1].evalCpAfter).toBe(30); // flipped from -30
  });

  it('analyzeAfter skips the after-call when the game ended on the move', async () => {
    // Fool's mate: 1.f3 e5 2.g4 Qh4# — the last move ends the game.
    const game = new Game();
    game.move('f3');
    game.move('e5');
    game.move('g4');
    game.move('Qh4');
    expect(game.isGameOver()).toBe(true);

    const analyze = vi.fn(async (_req: AnalyzeRequest) => stubResult(null, 1));
    const results = await analyzeGame(game, { depth: 8, analyze });

    // 4 plies; only the first 3 should produce after-calls (8 total). The
    // mate-ending ply contributes only its before-call.
    expect(analyze).toHaveBeenCalledTimes(7);
    expect(results[3].evalCpAfter).toBeNull();
    expect(results[3].mateInAfter).toBeNull();
  });

  it('flips mate sign on the after-position eval', async () => {
    const game = new Game();
    game.move('e4');

    let callIndex = 0;
    const analyze = vi.fn(async (_req: AnalyzeRequest) => {
      callIndex += 1;
      // After 1.e4 black is to move; if black is being mated the engine reports
      // a negative mate from black's POV. We expect the orchestrator to flip
      // it so white's record shows +mate.
      if (callIndex === 1) return stubResult(null, 50, null);
      return stubResult(null, null, -3);
    });

    const [rec] = await analyzeGame(game, { depth: 8, analyze });
    expect(rec.mateInAfter).toBe(3);
    expect(rec.evalCpAfter).toBeNull();
  });
});
