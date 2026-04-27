import { describe, expect, it } from 'vitest';
import { previewPgnGames, splitPgn } from '../pgnSplit';

describe('splitPgn', () => {
  it('returns an empty array for empty input', () => {
    expect(splitPgn('')).toEqual([]);
    expect(splitPgn('   \n\n  ')).toEqual([]);
  });

  it('returns a single game when there is no separator', () => {
    const pgn = '[Event "Solo"]\n[White "A"]\n[Black "B"]\n\n1. e4 e5 2. Nf3 *';
    expect(splitPgn(pgn)).toHaveLength(1);
  });

  it('treats movetext-only input as one game', () => {
    expect(splitPgn('1. e4 e5 2. Nf3 Nc6 *')).toEqual([
      '1. e4 e5 2. Nf3 Nc6 *',
    ]);
  });

  it('splits two games separated by a blank line', () => {
    const pgn = [
      '[Event "Game 1"]',
      '[White "A"]',
      '[Black "B"]',
      '',
      '1. e4 e5 1-0',
      '',
      '[Event "Game 2"]',
      '[White "C"]',
      '[Black "D"]',
      '',
      '1. d4 d5 0-1',
    ].join('\n');
    const games = splitPgn(pgn);
    expect(games).toHaveLength(2);
    expect(games[0]).toContain('[Event "Game 1"]');
    expect(games[0]).toContain('1. e4 e5 1-0');
    expect(games[1]).toContain('[Event "Game 2"]');
    expect(games[1]).toContain('1. d4 d5 0-1');
  });

  it('splits games even without a blank line between them', () => {
    const pgn = [
      '[Event "A"]',
      '',
      '1. e4 e5 *',
      '[Event "B"]',
      '',
      '1. d4 d5 *',
    ].join('\n');
    const games = splitPgn(pgn);
    expect(games).toHaveLength(2);
    expect(games[1].startsWith('[Event "B"]')).toBe(true);
  });

  it('handles three games with CRLF line endings', () => {
    const game = (n: string): string =>
      `[Event "${n}"]\r\n[White "A"]\r\n[Black "B"]\r\n\r\n1. e4 e5 *`;
    const pgn = [game('1'), game('2'), game('3')].join('\r\n\r\n');
    expect(splitPgn(pgn)).toHaveLength(3);
  });

  it('does not split on tag-like text inside braces or comments', () => {
    const pgn =
      '[Event "Annotated"]\n\n1. e4 {[%clk 0:01:00] looks calm} 1... e5 *';
    const games = splitPgn(pgn);
    expect(games).toHaveLength(1);
  });
});

describe('previewPgnGames', () => {
  it('returns headers and move counts per game', () => {
    const pgn = [
      '[Event "G1"]',
      '[White "Alice"]',
      '[Black "Bob"]',
      '[Result "1-0"]',
      '',
      '1. e4 e5 2. Nf3 1-0',
      '',
      '[Event "G2"]',
      '[White "Carol"]',
      '[Black "Dan"]',
      '[Result "0-1"]',
      '',
      '1. d4 d5 0-1',
    ].join('\n');
    const previews = previewPgnGames(pgn);
    expect(previews).toHaveLength(2);
    expect(previews[0].ok).toBe(true);
    if (previews[0].ok) {
      expect(previews[0].headers.White).toBe('Alice');
      expect(previews[0].headers.Black).toBe('Bob');
      expect(previews[0].moveCount).toBe(3);
    }
    if (previews[1].ok) {
      expect(previews[1].headers.White).toBe('Carol');
      expect(previews[1].moveCount).toBe(2);
    }
  });

  it('reports parse errors per-game without aborting the others', () => {
    const good = '[Event "Good"]\n\n1. e4 e5 *';
    const bad = '[Event "Bad"]\n\n1. e4 nonsense_token *';
    const previews = previewPgnGames(`${good}\n\n${bad}`);
    expect(previews).toHaveLength(2);
    expect(previews[0].ok).toBe(true);
    expect(previews[1].ok).toBe(false);
  });
});
