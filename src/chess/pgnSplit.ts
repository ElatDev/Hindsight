import { Game } from './game';

/**
 * Split a multi-game PGN string into individual game PGNs. Multi-game PGNs
 * concatenate games with header sections separated by blank lines; the
 * canonical separator is the start of a new `[Event "..."]` (or any other tag)
 * after the previous game's movetext.
 *
 * The algorithm tracks whether we're currently inside the movetext of a game,
 * and whether the current line started inside an unclosed `{...}` PGN comment.
 * A line opened inside a comment can never be the start of a new game even if
 * it superficially looks like a tag line — `{ ... [Event "fake"] ... }` lives
 * entirely in comment-text. PGNs with no headers (movetext-only) come back as
 * a single game.
 *
 * Returns an empty array for empty/whitespace-only input.
 */
export function splitPgn(text: string): string[] {
  const lines = text.split(/\r?\n/);
  const games: string[] = [];
  let current: string[] = [];
  let inMovetext = false;
  let inComment = false;

  const flush = (): void => {
    const joined = current.join('\n').trim();
    if (joined) games.push(joined);
    current = [];
    inMovetext = false;
    inComment = false;
  };

  for (const line of lines) {
    const startedInComment = inComment;
    const trimmed = line.trim();
    const isTagLine =
      !startedInComment && /^\[[A-Za-z][A-Za-z0-9_]*\s+"/.test(trimmed);

    // Update comment balance from this line for the next iteration. Skip the
    // scan on tag lines — tag values are quoted strings and any literal
    // braces inside them aren't comment delimiters; treating them as such
    // would break the next-line tag detection.
    if (!isTagLine) {
      for (let i = 0; i < line.length; i += 1) {
        const ch = line[i];
        if (inComment) {
          if (ch === '}') inComment = false;
        } else if (ch === '{') {
          inComment = true;
        }
      }
    }

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
