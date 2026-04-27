/**
 * Saved-games CRUD on top of the `saved_games` table. The PGN itself is the
 * source of truth; the denormalised columns (`white`, `black`, etc.) exist
 * only so the list view can render without re-parsing every PGN. They are
 * extracted from `[Tag "Value"]` headers at insert time by `extractHeaders`.
 */

import type { Db } from './db';

export type SavedGameSummary = {
  id: number;
  name: string;
  white: string | null;
  black: string | null;
  result: string | null;
  event: string | null;
  playedAt: string | null;
  createdAt: string;
  plyCount: number;
};

export type SavedGame = SavedGameSummary & {
  pgn: string;
};

export type SaveGameInput = {
  /** Raw PGN text; required. */
  pgn: string;
  /** Display name. If omitted, derived from PGN headers
   *  (`White vs Black, Event` or just `Game DD MMM`). */
  name?: string;
  /** Move count; the renderer already knows it from `Game.history()`. */
  plyCount: number;
};

type GameRow = {
  id: number;
  name: string;
  pgn: string;
  white: string | null;
  black: string | null;
  result: string | null;
  event: string | null;
  played_at: string | null;
  created_at: string;
  ply_count: number;
};

const HEADER_RE =
  /^\s*\[\s*([A-Za-z][A-Za-z0-9_]*)\s+"((?:[^"\\]|\\.)*)"\s*\]\s*$/;

export function extractHeaders(pgn: string): Record<string, string> {
  const out: Record<string, string> = {};
  const lines = pgn.split(/\r?\n/);
  for (const line of lines) {
    if (line.trim() === '') break; // blank line ends the header block
    const m = HEADER_RE.exec(line);
    if (m) out[m[1]] = m[2].replace(/\\(.)/g, '$1');
  }
  return out;
}

function deriveName(headers: Record<string, string>): string {
  const white = headers.White?.trim();
  const black = headers.Black?.trim();
  const event = headers.Event?.trim();
  if (white && black && white !== '?' && black !== '?') {
    const base = `${white} vs ${black}`;
    return event && event !== '?' ? `${base} — ${event}` : base;
  }
  if (event && event !== '?') return event;
  return `Game ${new Date().toISOString().slice(0, 10)}`;
}

function rowToSummary(row: GameRow): SavedGameSummary {
  return {
    id: row.id,
    name: row.name,
    white: row.white,
    black: row.black,
    result: row.result,
    event: row.event,
    playedAt: row.played_at,
    createdAt: row.created_at,
    plyCount: row.ply_count,
  };
}

export function listGames(db: Db): SavedGameSummary[] {
  const rows = db
    .prepare<[], GameRow>(
      `SELECT id, name, '' AS pgn, white, black, result, event,
              played_at, created_at, ply_count
       FROM saved_games
       ORDER BY datetime(created_at) DESC, id DESC`,
    )
    .all();
  return rows.map(rowToSummary);
}

export function getGame(db: Db, id: number): SavedGame | null {
  const row = db
    .prepare<[number], GameRow>(
      `SELECT id, name, pgn, white, black, result, event,
              played_at, created_at, ply_count
       FROM saved_games
       WHERE id = ?`,
    )
    .get(id);
  if (!row) return null;
  return { ...rowToSummary(row), pgn: row.pgn };
}

export function saveGame(db: Db, input: SaveGameInput): SavedGameSummary {
  const headers = extractHeaders(input.pgn);
  const name = (input.name?.trim() || deriveName(headers)).slice(0, 200);
  const createdAt = new Date().toISOString();
  const playedAt = headers.UTCDate || headers.Date || null;
  const stmt = db.prepare(
    `INSERT INTO saved_games
       (name, pgn, white, black, result, event, played_at, created_at, ply_count)
     VALUES (@name, @pgn, @white, @black, @result, @event, @playedAt, @createdAt, @plyCount)`,
  );
  const info = stmt.run({
    name,
    pgn: input.pgn,
    white: headers.White ?? null,
    black: headers.Black ?? null,
    result: headers.Result ?? null,
    event: headers.Event ?? null,
    playedAt,
    createdAt,
    plyCount: input.plyCount,
  });
  return {
    id: Number(info.lastInsertRowid),
    name,
    white: headers.White ?? null,
    black: headers.Black ?? null,
    result: headers.Result ?? null,
    event: headers.Event ?? null,
    playedAt,
    createdAt,
    plyCount: input.plyCount,
  };
}

export function deleteGame(db: Db, id: number): void {
  db.prepare('DELETE FROM saved_games WHERE id = ?').run(id);
}
