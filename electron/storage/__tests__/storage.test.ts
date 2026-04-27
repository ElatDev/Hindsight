import { describe, expect, it } from 'vitest';
import { extractHeaders } from '../games';

/**
 * The SQLite-dependent tests (full CRUD round-trips on `saved_games` /
 * `settings`) live outside vitest because better-sqlite3 ships a single
 * native binary, and on this project that binary is built against Electron's
 * Node ABI (v128) by `electron-rebuild` — vitest, however, runs on the host
 * Node (currently v137), so the same `.node` file can't satisfy both.
 *
 * The CRUD layer is small (one INSERT, one SELECT, one DELETE per table)
 * and exercised end-to-end every time the app boots; we cover the *parsing*
 * helpers here and rely on the dev-run smoke test for the SQL paths. If the
 * persistence layer grows non-trivial logic, lift it to its own electron-
 * mocha runner instead of trying to dual-build the native module.
 */

describe('extractHeaders', () => {
  it('parses the seven-tag roster from a normal PGN header block', () => {
    const pgn = `[Event "Friendly"]
[Site "Anywhere"]
[Date "2024.05.01"]
[Round "?"]
[White "Magnus"]
[Black "Hikaru"]
[Result "1-0"]

1. e4 e5 2. Nf3 *
`;
    const h = extractHeaders(pgn);
    expect(h).toMatchObject({
      Event: 'Friendly',
      Site: 'Anywhere',
      Date: '2024.05.01',
      White: 'Magnus',
      Black: 'Hikaru',
      Result: '1-0',
    });
  });

  it('stops parsing at the first blank line', () => {
    const pgn = `[White "A"]

[Black "B"]
1. e4 *`;
    const h = extractHeaders(pgn);
    expect(h.White).toBe('A');
    expect(h.Black).toBeUndefined();
  });

  it('handles escaped quotes inside header values', () => {
    const pgn = `[Event "He said \\"hi\\""]\n\n1. e4 *`;
    const h = extractHeaders(pgn);
    expect(h.Event).toBe('He said "hi"');
  });

  it('returns an empty object for PGNs without a header block', () => {
    expect(extractHeaders('1. e4 e5 *')).toEqual({});
  });

  it('ignores lines that do not match the [Tag "value"] shape', () => {
    const pgn = `[White "A"]
not a header
[Black "B"]

1. e4 *`;
    const h = extractHeaders(pgn);
    expect(h.White).toBe('A');
    expect(h.Black).toBe('B');
  });
});
