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

  it('emits onProgress as each pre-move analysis lands', async () => {
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
    expect(onProgress).toHaveBeenNthCalledWith(1, 1, 2);
    expect(onProgress).toHaveBeenNthCalledWith(2, 2, 2);
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

  it('analyzeAfter:true populates evalCpAfter via dedup with the next ply', async () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');

    // Stub: eval is reported from the side-to-move's POV. We pretend white
    // is at +30 from white's perspective; black sees the same as -30. The
    // orchestrator should flip the sign on the after-eval so each ply's
    // record stays in the *original mover's* POV.
    const analyze = vi.fn(async (req: AnalyzeRequest) => {
      const stm = req.fen.split(' ')[1];
      return stubResult(null, stm === 'w' ? 30 : -30);
    });

    const results = await analyzeGame(game, { depth: 12, analyze });

    // Three FENs to evaluate: starting position (w STM), after-1.e4 (b STM,
    // shared between ply 1's "after" and ply 2's "before"), after-1...e5
    // (w STM, used for ply 2's "after"). Without dedup this would be four.
    expect(analyze).toHaveBeenCalledTimes(3);

    // Ply 1 (white): before-eval = white-POV +30; after-eval is black-POV
    // -30 sign-flipped back to white-POV +30.
    expect(results[0].evalCp).toBe(30);
    expect(results[0].evalCpAfter).toBe(30);

    // Ply 2 (black): before-eval is black-POV -30 (black is losing); after-
    // eval is white-POV +30 sign-flipped to black-POV -30.
    expect(results[1].evalCp).toBe(-30);
    expect(results[1].evalCpAfter).toBe(-30);
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

    // 4 plies → 4 unique pre-move FENs to analyse. The post-final position
    // is checkmate (gameOverAt[4] = true), so the standalone after-call we
    // dispatch for non-terminal final positions is skipped.
    expect(analyze).toHaveBeenCalledTimes(4);
    expect(results[3].evalCpAfter).toBeNull();
    expect(results[3].mateInAfter).toBeNull();
  });

  it('plumbs multiPV into the pre-move analyze call and surfaces linesBefore', async () => {
    const game = new Game();
    game.move('e4');

    const analyze = vi.fn(async (req: AnalyzeRequest) => ({
      bestMove: 'e2e4',
      lines: [
        { depth: 12, multipv: 1, pv: ['e2e4'], evalCp: 30, mateIn: null },
        { depth: 12, multipv: 2, pv: ['d2d4'], evalCp: 25, mateIn: null },
        { depth: 12, multipv: 3, pv: ['c2c4'], evalCp: 20, mateIn: null },
      ].slice(0, req.multiPV ?? 1),
    }));

    const [rec] = await analyzeGame(game, {
      depth: 12,
      multiPV: 3,
      analyze,
      analyzeAfter: false,
    });
    // The pre-move analyze call must carry the multiPV request.
    expect(analyze).toHaveBeenCalledWith(
      expect.objectContaining({ multiPV: 3 }),
    );
    expect(rec.linesBefore).toBeDefined();
    expect(rec.linesBefore).toHaveLength(3);
  });

  it('omits linesBefore when multiPV defaults to 1', async () => {
    const game = new Game();
    game.move('e4');
    const analyze = vi.fn(async (_req: AnalyzeRequest) =>
      stubResult('e2e4', 30),
    );
    const [rec] = await analyzeGame(game, {
      depth: 12,
      analyze,
      analyzeAfter: false,
    });
    expect(rec.linesBefore).toBeUndefined();
    expect(analyze).toHaveBeenCalledWith(
      expect.not.objectContaining({ multiPV: expect.anything() }),
    );
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
