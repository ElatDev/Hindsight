import { describe, expect, it } from 'vitest';
import { Game, GameEnd } from '../game';

describe('Game', () => {
  it('starts at the initial position', () => {
    const g = new Game();
    expect(g.fen()).toBe(
      'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    );
    expect(g.turn()).toBe('w');
    expect(g.history()).toEqual([]);
    expect(g.isGameOver()).toBe(false);
    expect(g.gameEnd()).toBeNull();
  });

  it('applies legal moves in SAN', () => {
    const g = new Game();
    expect(g.move('e4')?.san).toBe('e4');
    expect(g.move('e5')?.san).toBe('e5');
    expect(g.move('Nf3')?.san).toBe('Nf3');
    expect(g.history()).toEqual(['e4', 'e5', 'Nf3']);
    expect(g.turn()).toBe('b');
  });

  it('returns null for illegal moves without throwing', () => {
    const g = new Game();
    expect(g.move('e5')).toBeNull(); // not white's pawn
    expect(g.move('Ke2')).toBeNull(); // king blocked by own pawn
    expect(g.history()).toEqual([]);
  });

  it('detects checkmate via Fool’s Mate', () => {
    const g = new Game();
    g.move('f3');
    g.move('e5');
    g.move('g4');
    g.move('Qh4');
    expect(g.isGameOver()).toBe(true);
    expect(g.gameEnd()).toBe('checkmate');
  });

  it('detects stalemate', () => {
    // Classic stalemate: black king h8, white queen f7, white king f6, black to move.
    const g = Game.fromFen('7k/5Q2/5K2/8/8/8/8/8 b - - 0 1');
    expect(g.gameEnd()).toBe('stalemate');
  });

  it('detects insufficient material (K vs K)', () => {
    const g = Game.fromFen('4k3/8/8/8/8/8/8/4K3 w - - 0 1');
    expect(g.gameEnd()).toBe('insufficient-material');
  });

  it('round-trips a short PGN through load/history', () => {
    const pgn = '1. e4 e5 2. Nf3 Nc6 3. Bb5';
    const g = Game.fromPgn(pgn);
    expect(g.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
    expect(g.turn()).toBe('b');
  });

  it('undo reverts the last move', () => {
    const g = new Game();
    g.move('d4');
    g.move('d5');
    const undone = g.undo();
    expect(undone?.san).toBe('d5');
    expect(g.history()).toEqual(['d4']);
    expect(g.turn()).toBe('b');
  });

  it('legalMoves returns all opening moves from the start', () => {
    const g = new Game();
    expect(g.legalMoves()).toHaveLength(20); // 16 pawn moves + 4 knight moves
  });
});

describe('Game / PGN parsing edge cases', () => {
  it('parses headers from a Seven Tag Roster PGN', () => {
    const pgn = [
      '[Event "Casual Game"]',
      '[Site "Berlin GER"]',
      '[Date "1852.??.??"]',
      '[Round "?"]',
      '[White "Adolf Anderssen"]',
      '[Black "Jean Dufresne"]',
      '[Result "1-0"]',
      '',
      '1. e4 e5 2. Nf3 Nc6 3. Bc4 Bc5',
    ].join('\n');
    const g = Game.fromPgn(pgn);
    const h = g.headers();
    expect(h.Event).toBe('Casual Game');
    expect(h.White).toBe('Adolf Anderssen');
    expect(h.Black).toBe('Jean Dufresne');
    expect(h.Result).toBe('1-0');
    expect(g.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
  });

  it('preserves brace comments tied to positions', () => {
    const pgn = '1. e4 {best by test} e5 2. Nf3 {develop} Nc6';
    const g = Game.fromPgn(pgn);
    const comments = g.comments();
    expect(comments.length).toBeGreaterThanOrEqual(2);
    const texts = comments.map((c) => c.comment);
    expect(texts).toContain('best by test');
    expect(texts).toContain('develop');
    expect(g.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6']);
  });

  it('accepts PGN with NAG glyphs and ! ? annotations without erroring', () => {
    const pgn = '1. e4! e5 $1 2. Nf3?! Nc6 $14 3. Bb5!! a6 $6';
    const g = Game.fromPgn(pgn);
    expect(g.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6']);
  });

  it('accepts PGN with parenthesised variations and loads only the main line', () => {
    const pgn =
      '1. e4 e5 (1... c5 2. Nf3 d6) 2. Nf3 Nc6 (2... Nf6 3. Nxe5) 3. Bb5';
    const g = Game.fromPgn(pgn);
    expect(g.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  });

  it('handles tricky SAN: en passant, promotion, and castling', () => {
    const pgn = [
      // En passant: ...exf6 e.p.
      '1. e4 d5 2. e5 f5 3. exf6',
      // Continue to a kingside castle and a promotion
      'Nf6 4. Nf3 e6 5. Bc4 Bd6 6. O-O',
    ].join(' ');
    const g = Game.fromPgn(pgn);
    expect(g.history()).toContain('exf6');
    expect(g.history()).toContain('O-O');

    // Separate promotion test from a tactical FEN.
    // White pawn on a7 promotes to queen on a8.
    const promo = Game.fromFen('4k3/P7/8/8/8/8/8/4K3 w - - 0 1');
    expect(promo.move('a8=Q')?.promotion).toBe('q');
    expect(promo.fen()).toMatch(/^Q3k3/);
  });
});

describe('Game / tricky SAN and PGN inputs', () => {
  it('handles disambiguated knight moves (Nbd2 vs Nfd2)', () => {
    // White knights on b1 and f3, both legally reach d2.
    const fen = '4k3/8/8/8/8/5N2/8/1N2K3 w - - 0 1';

    const fromB = Game.fromFen(fen);
    expect(fromB.move('Nbd2')?.from).toBe('b1');

    const fromF = Game.fromFen(fen);
    expect(fromF.move('Nfd2')?.from).toBe('f3');
  });

  it('accepts queenside castling (O-O-O) from a clear position', () => {
    const g = Game.fromFen(
      'r3kbnr/pppqpppp/2nb4/3p4/3P4/2NB4/PPPQPPPP/R3KBNR w KQkq - 0 1',
    );
    const move = g.move('O-O-O');
    expect(move?.flags).toContain('q'); // queenside-castle flag
    expect(move?.san).toBe('O-O-O');
  });

  it('handles underpromotion to knight, bishop, and rook', () => {
    const fen = '4k3/P7/8/8/8/8/8/4K3 w - - 0 1';

    const toN = Game.fromFen(fen);
    expect(toN.move('a8=N')?.promotion).toBe('n');
    expect(toN.fen()).toMatch(/^N3k3/);

    const toB = Game.fromFen(fen);
    expect(toB.move('a8=B')?.promotion).toBe('b');

    const toR = Game.fromFen(fen);
    expect(toR.move('a8=R')?.promotion).toBe('r');
  });

  it('handles capture-with-promotion (exd8=Q+)', () => {
    // Black rook on d8, white pawn on e7. White plays exd8=Q, giving check.
    const g = Game.fromFen('3rk3/4P3/8/8/8/8/8/4K3 w - - 0 1');
    const move = g.move('exd8=Q');
    expect(move?.promotion).toBe('q');
    expect(move?.captured).toBe('r');
    expect(g.inCheck()).toBe(true);
  });

  it('accepts SAN with check (+) and checkmate (#) annotations', () => {
    // Scholar's Mate: 1.e4 e5 2.Bc4 Nc6 3.Qh5 Nf6?? 4.Qxf7#
    const g = new Game();
    g.move('e4');
    g.move('e5');
    g.move('Bc4');
    g.move('Nc6');
    g.move('Qh5');
    g.move('Nf6');
    expect(g.move('Qxf7#')?.san).toBe('Qxf7#');
    expect(g.gameEnd()).toBe(GameEnd.Checkmate);
  });

  it('round-trips a PGN containing en passant + castling + promotion symbols', () => {
    // En passant, both castles, and a check symbol — all in one game.
    const pgn = [
      '1. e4 c5 2. Nf3 d6 3. d4 cxd4 4. Nxd4 Nf6 5. Nc3 a6',
      '6. Be2 e5 7. Nb3 Be7 8. O-O O-O 9. Be3 Be6 10. Nd5 Nbd7',
      '11. Qd3 Bxd5 12. exd5 Re8',
    ].join(' ');
    const g = Game.fromPgn(pgn);
    expect(g.history()).toContain('O-O');
    expect(g.history()).toContain('cxd4');
    expect(g.history()).toContain('Bxd5');
  });
});

describe('Game / GameEnd detection', () => {
  it('exposes the GameEnd const with stable string literal values', () => {
    expect(GameEnd.Checkmate).toBe('checkmate');
    expect(GameEnd.ThreefoldRepetition).toBe('threefold-repetition');
    expect(GameEnd.FiftyMove).toBe('fifty-move');
    expect(GameEnd.InsufficientMaterial).toBe('insufficient-material');
  });

  it('detects threefold repetition from quiet knight shuffles', () => {
    const g = new Game();
    // White Nf3-Ng1, Black Nf6-Ng8, repeated three times → starting position
    // appears three times.
    for (let i = 0; i < 3; i += 1) {
      g.move('Nf3');
      g.move('Nf6');
      g.move('Ng1');
      g.move('Ng8');
    }
    expect(g.gameEnd()).toBe(GameEnd.ThreefoldRepetition);
  });

  it('detects the fifty-move rule via a high halfmove clock', () => {
    // Halfmove clock = 100 → fifty full moves without capture or pawn move.
    const g = Game.fromFen('4k3/8/8/8/8/8/4K3/R7 w - - 100 60');
    expect(g.gameEnd()).toBe(GameEnd.FiftyMove);
  });
});
