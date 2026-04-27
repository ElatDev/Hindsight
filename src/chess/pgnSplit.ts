import { Game } from './game';

/**
 * Split a multi-game PGN string into individual game PGNs. Multi-game PGNs
 * concatenate games with header sections separated by blank lines; the
 * canonical separator is the start of a new `[Event "..."]` (or any other tag)
 * after the previous game's movetext.
 *
 * The algorithm tracks whether we're currently inside the movetext of a game.
 * When a new tag-line appears while inside movetext, that's the boundary
 * between games. PGNs with no headers (movetext-only) come back as a single
 * game.
 *
 * Returns an empty array for empty/whitespace-only input.
 */
export function splitPgn(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const games: string[] = [];
  let current: string[] = [];
  let inMovetext = false;

  const flush = (): void => {
    const joined = current.join('\n').trim();
    if (joined) games.push(joined);
    current = [];
    inMovetext = false;
  };

  for (const line of lines) {
    const trimmed = line.trim();
    const isTagLine = /^\[[A-Za-z][A-Za-z0-9_]*\s+"/.test(trimmed);

    if (isTagLine && inMovetext) {
      flush();
      current.push(line);
      continue;
    }

    if (!isTagLine && trimmed.length > 0) {
      inMovetext = true;
    }
    current.push(line);
  }
  flush();
  return games;
}

export type PgnGamePreview = {
  /** The raw PGN text for this single game. */
  pgn: string;
  /** Index in the source text (0-based), useful as a list key. */
  index: number;
} & (
  | {
      ok: true;
      headers: Record<string, string>;
      moveCount: number;
    }
  | { ok: false; error: string }
);

/**
 * Run `splitPgn` and attempt to parse each resulting chunk. Each preview
 * carries the parsed headers + ply count on success, or the parse error on
 * failure. Order matches the source order.
 */
export function previewPgnGames(text: string): PgnGamePreview[] {
  const chunks = splitPgn(text);
  return chunks.map((pgn, index) => {
    try {
      const g = Game.fromPgn(pgn);
      return {
        pgn,
        index,
        ok: true,
        headers: g.headers(),
        moveCount: g.history().length,
      };
    } catch (err) {
      return {
        pgn,
        index,
        ok: false,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  });
}
