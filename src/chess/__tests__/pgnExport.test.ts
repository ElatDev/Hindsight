import { describe, expect, it } from 'vitest';
import { Game } from '../game';
import { exportAnnotatedPgn } from '../pgnExport';
import type { GameReview, ReviewedMove } from '../review';

const ZERO_COUNTS = {
  sharp: 0,
  best: 0,
  excellent: 0,
  good: 0,
  inaccuracy: 0,
  mistake: 0,
  blunder: 0,
  miss: 0,
  book: 0,
};

function makeReview(perMove: ReviewedMove[]): GameReview {
  return {
    perMove,
    opening: null,
    summary: {
      accuracy: {
        white: { perMove: [], overall: 0 },
        black: { perMove: [], overall: 0 },
      },
      counts: { white: { ...ZERO_COUNTS }, black: { ...ZERO_COUNTS } },
      criticalMoments: [],
    },
  };
}

function move(
  ply: number,
  san: string,
  toSquare: ReviewedMove['toSquare'],
  classification: ReviewedMove['classification'],
  evalCp: number | null,
  explanation = '',
): ReviewedMove {
  return {
    ply,
    san,
    toSquare,
    classification,
    cpLoss: null,
    evalBefore: { cp: 0, mate: null },
    evalAfter: { cp: evalCp, mate: null },
    bestUci: null,
    bestSan: null,
    motifs: [],
    phase: 'opening',
    templateId: null,
    explanation,
    alternatives: [],
  };
}

describe('exportAnnotatedPgn', () => {
  it('emits Seven Tag Roster headers in canonical order with safe defaults', () => {
    const game = new Game();
    game.move('e4');
    const pgn = exportAnnotatedPgn(
      game,
      makeReview([move(1, 'e4', 'e4', 'best', 30)]),
    );
    const lines = pgn.split('\n').filter((l) => l.startsWith('['));
    // chess.js seeds the Seven Tag Roster on a fresh Game; we preserve
    // those defaults verbatim and emit them in canonical order.
    expect(lines[0]).toMatch(/^\[Event /);
    expect(lines[1]).toMatch(/^\[Site /);
    expect(lines[2]).toMatch(/^\[Date /);
    expect(lines[3]).toMatch(/^\[Round /);
    expect(lines[4]).toMatch(/^\[White /);
    expect(lines[5]).toMatch(/^\[Black /);
    expect(lines[6]).toMatch(/^\[Result /);
    expect(lines).toContain('[Annotator "Hindsight"]');
  });

  it('preserves source-PGN headers and lets extraHeaders override them', () => {
    const game = new Game();
    game.load(
      '[Event "Casual"]\n[Site "Local"]\n[White "A"]\n[Black "B"]\n\n1. e4 *',
    );
    const pgn = exportAnnotatedPgn(
      game,
      makeReview([move(1, 'e4', 'e4', 'best', 30)]),
      { extraHeaders: { Event: 'Test Cup', Annotator: 'Custom' } },
    );
    expect(pgn).toMatch(/\[Event "Test Cup"\]/);
    expect(pgn).toMatch(/\[White "A"\]/);
    // extraHeaders wins over the auto-injected Hindsight Annotator.
    expect(pgn).toMatch(/\[Annotator "Custom"\]/);
  });

  it('attaches NAG glyphs by classification', () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');
    game.move('Nc6');
    const review = makeReview([
      move(1, 'e4', 'e4', 'sharp', 50),
      move(2, 'e5', 'e5', 'inaccuracy', -100),
      move(3, 'Nf3', 'f3', 'mistake', 120),
      move(4, 'Nc6', 'c6', 'blunder', -350),
    ]);
    const pgn = exportAnnotatedPgn(game, review, { maxWidth: 0 });
    // sharp → $3, inaccuracy → $6, mistake → $2, blunder → $4
    expect(pgn).toMatch(/1\.\s+e4\s+\$3/);
    expect(pgn).toMatch(/e5\s+\$6/);
    expect(pgn).toMatch(/2\.\s+Nf3\s+\$2/);
    expect(pgn).toMatch(/Nc6\s+\$4/);
  });

  it('omits NAG for best / excellent / good / book classifications', () => {
    const game = new Game();
    game.move('e4');
    const review = makeReview([move(1, 'e4', 'e4', 'best', 30)]);
    const pgn = exportAnnotatedPgn(game, review);
    expect(pgn).not.toMatch(/\$\d/);
  });

  it('emits [%eval ...] comments using a signed pawn fraction', () => {
    const game = new Game();
    game.move('e4');
    const review = makeReview([move(1, 'e4', 'e4', 'best', 145)]);
    const pgn = exportAnnotatedPgn(game, review);
    expect(pgn).toMatch(/\{\[%eval 1\.45\]\}/);
  });

  it('renders mate scores as #N / #-N inside [%eval ...]', () => {
    const game = new Game();
    game.move('e4');
    const m = move(1, 'e4', 'e4', 'best', null);
    const review = makeReview([{ ...m, evalAfter: { cp: null, mate: 4 } }]);
    const pgn = exportAnnotatedPgn(game, review);
    expect(pgn).toMatch(/\[%eval #4\]/);
  });

  it('includes the rendered explanation in the comment when present', () => {
    const game = new Game();
    game.move('e4');
    const review = makeReview([
      move(1, 'e4', 'e4', 'best', 30, 'A solid first move.'),
    ]);
    const pgn = exportAnnotatedPgn(game, review);
    expect(pgn).toMatch(/A solid first move\./);
  });

  it('strips closing braces from explanations to keep PGN comments framed', () => {
    const game = new Game();
    game.move('e4');
    const review = makeReview([
      move(1, 'e4', 'e4', 'best', 30, 'Captures the {pawn} on } the file.'),
    ]);
    const pgn = exportAnnotatedPgn(game, review);
    // Substituted ')' for the closing brace; the inner '{pawn}' becomes
    // '{pawn)' which is still safe inside the outer { ... }.
    expect(pgn).toMatch(/\{pawn\) on \) the file\./);
  });

  it('respects includeExplanations: false (eval-only comments)', () => {
    const game = new Game();
    game.move('e4');
    const review = makeReview([
      move(1, 'e4', 'e4', 'best', 30, 'A solid first move.'),
    ]);
    const pgn = exportAnnotatedPgn(game, review, {
      includeExplanations: false,
    });
    expect(pgn).not.toMatch(/A solid first move/);
    expect(pgn).toMatch(/\[%eval/);
  });

  it('infers Result from the terminal state when the source has none', () => {
    const game = new Game();
    // Scholar's mate — checkmate by white.
    game.move('e4');
    game.move('e5');
    game.move('Bc4');
    game.move('Nc6');
    game.move('Qh5');
    game.move('Nf6');
    game.move('Qxf7#');
    const review = makeReview([
      move(1, 'e4', 'e4', 'best', 30),
      move(2, 'e5', 'e5', 'best', 0),
      move(3, 'Bc4', 'c4', 'best', 30),
      move(4, 'Nc6', 'c6', 'best', 0),
      move(5, 'Qh5', 'h5', 'best', 50),
      move(6, 'Nf6', 'f6', 'blunder', -1000),
      move(7, 'Qxf7#', 'f7', 'best', null),
    ]);
    const pgn = exportAnnotatedPgn(game, review);
    expect(pgn).toMatch(/\[Result "1-0"\]/);
    // Result token also appears at the end of the movetext.
    expect(pgn.trim().endsWith('1-0')).toBe(true);
  });

  it('emits move numbers correctly for white + black plies', () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');
    game.move('Nf3');
    const review = makeReview([
      move(1, 'e4', 'e4', 'best', 30),
      move(2, 'e5', 'e5', 'best', 0),
      move(3, 'Nf3', 'f3', 'best', 30),
    ]);
    const pgn = exportAnnotatedPgn(game, review, { maxWidth: 0 });
    const movetext = pgn.split('\n\n')[1];
    expect(movetext.startsWith('1. e4')).toBe(true);
    expect(movetext).toMatch(/1\. e4 [^]*e5 [^]*2\. Nf3/);
  });

  it('soft-wraps movetext at maxWidth without breaking inside comments', () => {
    const game = new Game();
    game.move('e4');
    const review = makeReview([
      move(
        1,
        'e4',
        'e4',
        'best',
        30,
        'A reasonably long explanation that should stay together inside its braces even though the surrounding line is being wrapped.',
      ),
    ]);
    const pgn = exportAnnotatedPgn(game, review, { maxWidth: 30 });
    const movetext = pgn.split('\n\n')[1];
    // Find the comment line(s); verify each line containing { and } is intact.
    for (const line of movetext.split('\n')) {
      const opens = (line.match(/\{/g) ?? []).length;
      const closes = (line.match(/\}/g) ?? []).length;
      expect(opens).toBe(closes);
    }
  });

  it('round-trips through chess.js loadPgn for a simple game', () => {
    const game = new Game();
    game.move('e4');
    game.move('e5');
    const review = makeReview([
      move(1, 'e4', 'e4', 'best', 30, 'Solid.'),
      move(2, 'e5', 'e5', 'inaccuracy', -100, 'Looser than c5.'),
    ]);
    const pgn = exportAnnotatedPgn(game, review);
    // chess.js should accept what we emit.
    const reloaded = new Game();
    reloaded.load(pgn);
    expect(reloaded.history()).toEqual(['e4', 'e5']);
  });
});
