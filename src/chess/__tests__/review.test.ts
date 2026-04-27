import { describe, expect, it, vi } from 'vitest';
import type { AnalysisResult, AnalyzeRequest } from '../../../shared/ipc';
import { Game } from '../game';
import {
  countClassifications,
  detectMoveMotifs,
  emptyReview,
  formatEval,
  resolveAlternatives,
  runGameReview,
  snapshotsFromAnalysis,
  uciToMoveInfo,
} from '../review';

const stub = (
  bestMove: string | null,
  evalCp: number | null,
  mateIn: number | null = null,
): AnalysisResult => ({
  bestMove,
  lines: [
    {
      depth: 12,
      multipv: 1,
      pv: bestMove ? [bestMove] : [],
      evalCp,
      mateIn,
    },
  ],
});

const fixedRng = (n: number) => () => n;

describe('formatEval', () => {
  it('formats centipawn scores as signed pawn fractions', () => {
    expect(formatEval({ cp: 65, mate: null })).toBe('+0.65');
    expect(formatEval({ cp: -120, mate: null })).toBe('-1.20');
    expect(formatEval({ cp: 0, mate: null })).toBe('0.00');
  });

  it('formats mate scores with the M prefix', () => {
    expect(formatEval({ cp: null, mate: 3 })).toBe('M3');
    expect(formatEval({ cp: null, mate: -2 })).toBe('M-2');
  });

  it('renders missing eval as ?', () => {
    expect(formatEval({ cp: null, mate: null })).toBe('?');
  });
});

describe('snapshotsFromAnalysis', () => {
  it('preserves white-mover evals as-is', () => {
    const snap = snapshotsFromAnalysis({
      ply: 1,
      san: 'e4',
      uciPlayed: 'e2e4',
      fenBefore: '',
      evalCp: 20,
      mateIn: null,
      bestMove: 'e2e4',
      evalCpAfter: 10,
      mateInAfter: null,
    });
    expect(snap.evalBefore).toEqual({ cp: 20, mate: null });
    expect(snap.evalAfter).toEqual({ cp: 10, mate: null });
  });

  it('flips signs for black-mover evals into white-POV', () => {
    const snap = snapshotsFromAnalysis({
      ply: 2,
      san: 'e5',
      uciPlayed: 'e7e5',
      fenBefore: '',
      evalCp: 30, // black's POV: black is +0.30
      mateIn: null,
      bestMove: 'e7e5',
      evalCpAfter: 15,
      mateInAfter: null,
    });
    // White POV: black being +0.30 is white -0.30.
    expect(snap.evalBefore).toEqual({ cp: -30, mate: null });
    expect(snap.evalAfter).toEqual({ cp: -15, mate: null });
  });

  it('flips mate signs the same way', () => {
    const snap = snapshotsFromAnalysis({
      ply: 2,
      san: 'g6',
      uciPlayed: 'g7g6',
      fenBefore: '',
      evalCp: null,
      mateIn: -3, // black is being mated in 3
      bestMove: 'a7a6',
      evalCpAfter: null,
      mateInAfter: -2,
    });
    // White POV: black being mated in 3 is white mating in 3.
    expect(snap.evalBefore).toEqual({ cp: null, mate: 3 });
    expect(snap.evalAfter).toEqual({ cp: null, mate: 2 });
  });
});

describe('uciToMoveInfo', () => {
  it('resolves a UCI move to its SAN, piece, and target square', () => {
    const startFen = new Game().fen();
    expect(uciToMoveInfo(startFen, 'e2e4')).toEqual({
      san: 'e4',
      piece: 'p',
      to: 'e4',
    });
    expect(uciToMoveInfo(startFen, 'g1f3')).toEqual({
      san: 'Nf3',
      piece: 'n',
      to: 'f3',
    });
  });

  it('returns null for an illegal UCI string', () => {
    const startFen = new Game().fen();
    expect(uciToMoveInfo(startFen, 'e2e5')).toBeNull();
  });
});

describe('detectMoveMotifs', () => {
  it('flags a hanging piece left by the played move', () => {
    // White's queen on d4 is undefended and attacked by a pawn on c5
    // after we let the pawn alone — set up the position directly.
    // Position: white queen on d4, black pawn on c5; black to move (we'll
    // use a quiet black move that leaves the queen hanging from c5's POV).
    // Easier: set up white-to-move where white moves Qd4 into attack.
    const before = Game.fromFen('4k3/8/8/2p5/8/8/4K3/3Q4 w - - 0 1');
    const result = detectMoveMotifs(before, 'Qd4');
    expect(result.motifs).toContain('hanging');
    expect(result.data.hangingPiece).toBe('queen');
    expect(result.data.hangingSquare).toBe('d4');
  });

  it('flags a fork against the mover', () => {
    // Black knight on b3 forks white queen on a1 and rook on c5. Any
    // white tempo move (Kg1) leaves the fork in place — the post-move
    // detector will see opponent (black) forking mover (white).
    const before = Game.fromFen('7k/8/8/2R5/8/1n6/8/Q6K w - - 0 1');
    const result = detectMoveMotifs(before, 'Kg1');
    expect(result.motifs).toContain('fork');
    expect(result.data.attackerPiece).toBe('knight');
    expect(result.data.forkTargets).toEqual(
      expect.arrayContaining(['queen', 'rook']),
    );
  });

  it('returns no motifs for an illegal move', () => {
    const before = new Game();
    const result = detectMoveMotifs(before, 'Qh5'); // illegal at start
    expect(result.motifs).toEqual([]);
    expect(result.data).toEqual({});
  });

  it('suppresses back-rank motif when the move gave check', () => {
    // Black king on g8 with the classic f7/g7/h7 pawn shield (textbook
    // back-rank-trap pattern). Black has a bishop on a3 and plays Bb4+,
    // attacking the white king on e1 along the b4–e1 diagonal. The
    // structural back-rank weakness exists, but white must address the
    // check before exploiting it — so the explanation system shouldn't
    // imply imminent back-rank mate.
    const before = Game.fromFen('6k1/5ppp/8/8/8/b7/8/4K3 b - - 0 1');
    const result = detectMoveMotifs(before, 'Bb4+');
    expect(result.motifs).not.toContain('backRank');
  });
});

describe('resolveAlternatives', () => {
  const baseRec = (
    overrides: Partial<Parameters<typeof resolveAlternatives>[0]> = {},
  ) => ({
    ply: 5,
    san: 'Nc6',
    uciPlayed: 'b8c6',
    fenBefore: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
    evalCp: 30,
    mateIn: null,
    bestMove: 'g8f6',
    evalCpAfter: -180,
    mateInAfter: null,
    cpLoss: 210,
    classification: 'mistake' as const,
    ...overrides,
  });

  it('returns an empty list for non-flagged classifications', () => {
    const rec = baseRec({ classification: 'best' });
    expect(resolveAlternatives(rec)).toEqual([]);
  });

  it('returns an empty list when alternatives field is missing', () => {
    const rec = baseRec();
    expect(resolveAlternatives(rec)).toEqual([]);
  });

  it('resolves UCI lines to SAN and filters out the played move', () => {
    const rec = baseRec({
      alternatives: [
        { depth: 14, multipv: 1, pv: ['g8f6'], evalCp: 25, mateIn: null },
        { depth: 14, multipv: 2, pv: ['b8c6'], evalCp: 10, mateIn: null }, // played
        { depth: 14, multipv: 3, pv: ['d7d6'], evalCp: 0, mateIn: null },
      ],
    });
    const out = resolveAlternatives(rec);
    expect(out.map((a) => a.san)).toEqual(['Nf6', 'd6']);
    expect(out[0].evalCp).toBe(25);
  });

  it('skips PV lines that resolve to illegal moves', () => {
    const rec = baseRec({
      alternatives: [
        { depth: 14, multipv: 1, pv: ['g8f6'], evalCp: 25, mateIn: null },
        { depth: 14, multipv: 2, pv: ['a1h8'], evalCp: 0, mateIn: null }, // illegal
      ],
    });
    const out = resolveAlternatives(rec);
    expect(out).toHaveLength(1);
    expect(out[0].san).toBe('Nf6');
  });
});

describe('emptyReview', () => {
  it('returns a zeroed-out review with empty arrays', () => {
    const r = emptyReview();
    expect(r.perMove).toEqual([]);
    expect(r.opening).toBeNull();
    expect(r.summary.criticalMoments).toEqual([]);
    expect(r.summary.accuracy.white.overall).toBe(0);
    expect(r.summary.accuracy.black.overall).toBe(0);
    expect(r.summary.counts.white.blunder).toBe(0);
    expect(r.summary.counts.black.blunder).toBe(0);
  });
});

describe('countClassifications', () => {
  it('attributes counts to the side that was on move', () => {
    const counts = countClassifications([
      {
        ply: 1,
        san: 'e4',
        uciPlayed: 'e2e4',
        fenBefore: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
        evalCp: 24,
        mateIn: null,
        bestMove: 'e2e4',
        evalCpAfter: 14,
        mateInAfter: null,
        cpLoss: 0,
        classification: 'best',
      },
      {
        ply: 2,
        san: 'a5',
        uciPlayed: 'a7a5',
        fenBefore: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
        evalCp: -300,
        mateIn: null,
        bestMove: 'e7e5',
        evalCpAfter: -480,
        mateInAfter: null,
        cpLoss: 180,
        classification: 'mistake',
      },
    ]);
    expect(counts.white.best).toBe(1);
    expect(counts.white.mistake).toBe(0);
    expect(counts.black.mistake).toBe(1);
    expect(counts.black.best).toBe(0);
    // All buckets should be present even when zero.
    expect(counts.white.blunder).toBe(0);
    expect(counts.black.sharp).toBe(0);
  });
});

describe('runGameReview', () => {
  it('returns an empty review for a game with no moves', async () => {
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stub('e2e4', 0));
    const review = await runGameReview(new Game(), { analyze });
    expect(review.perMove).toEqual([]);
    expect(review.opening).toBeNull();
    expect(review.summary.criticalMoments).toEqual([]);
    expect(analyze).not.toHaveBeenCalled();
  });

  it('produces one ReviewedMove per ply with a non-empty explanation', async () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');

    // Stockfish likes e4/e5/Nf3 — return them as best moves so each
    // classification is "best".
    const analyze = vi.fn(async (req: AnalyzeRequest) => {
      // Pretend the engine's top pick matches whichever move was played.
      // For the e4 starting position we report e2e4; after e4 the top is
      // e7e5; after e4 e5 the top is g1f3.
      if (req.fen.startsWith('rnbqkbnr/pppppppp/8/8/8/8')) {
        return stub('e2e4', 24);
      }
      if (req.fen.includes('4P3/')) return stub('e7e5', 14);
      if (req.fen.includes('4p3/4P3/')) return stub('g1f3', 22);
      return stub(null, 0);
    });

    const review = await runGameReview(game, {
      depth: 12,
      analyze,
      rng: fixedRng(0),
    });
    expect(review.perMove).toHaveLength(3);
    expect(review.perMove.map((m) => m.ply)).toEqual([1, 2, 3]);
    expect(review.perMove.map((m) => m.san)).toEqual(['e4', 'e5', 'Nf3']);
    for (const m of review.perMove) {
      expect(m.explanation.length).toBeGreaterThan(0);
      expect(m.templateId).not.toBeNull();
      // No stray DSL syntax should leak into the rendered output.
      expect(m.explanation).not.toMatch(/[{}]/);
    }
  });

  it('attaches the matched ECO opening when one is found', async () => {
    const game = new Game();
    game.move('e4');
    game.move('c5');
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stub('a1a2', 0));
    const review = await runGameReview(game, { analyze });
    expect(review.opening).not.toBeNull();
    expect(review.opening?.eco?.startsWith('B')).toBe(true);
  });

  it('forwards onProgress over all plies', async () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');

    const calls: { done: number; total: number }[] = [];
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stub('a1a2', 0));
    await runGameReview(game, {
      analyze,
      onProgress: (done, total) => calls.push({ done, total }),
    });
    expect(calls.length).toBe(2);
    expect(calls[calls.length - 1]).toEqual({ done: 2, total: 2 });
  });

  it('attaches an end-of-game summary with accuracy + counts + critical moments', async () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stub('e2e4', 20));
    const review = await runGameReview(game, { analyze });
    // Top-level fields exist and are sensibly typed.
    expect(review.summary.accuracy.white.perMove.length).toBe(2); // plies 1, 3
    expect(review.summary.accuracy.black.perMove.length).toBe(1); // ply 2
    expect(review.summary.accuracy.white.overall).toBeGreaterThan(0);
    expect(review.summary.accuracy.black.overall).toBeGreaterThan(0);
    // Counts strip — e4/e5/Nf3 with stable evals classify as best.
    const total =
      review.summary.counts.white.best + review.summary.counts.black.best;
    expect(total).toBeGreaterThan(0);
    // Critical moments are capped at 5 and ordered by absolute swing.
    expect(review.summary.criticalMoments.length).toBeLessThanOrEqual(5);
  });

  it('threads the rng through to template selection', async () => {
    const game = new Game();
    game.move('e4');
    const analyze = vi.fn(async (_req: AnalyzeRequest) => stub('e2e4', 0));
    const rng = vi.fn(() => 0);
    await runGameReview(game, { analyze, rng });
    // At least once per ply that has matching templates.
    expect(rng).toHaveBeenCalled();
  });
});
