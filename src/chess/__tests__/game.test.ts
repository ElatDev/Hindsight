import { describe, expect, it } from 'vitest';
import { Game } from '../game';

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
