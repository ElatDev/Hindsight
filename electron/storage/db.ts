/**
 * better-sqlite3 wrapper. Opens the application database at
 * `<userData>/hindsight.db` (or wherever the caller specifies — tests use
 * `:memory:`) and runs a tiny embedded migrator. The schema is intentionally
 * small: a `settings` KV table and a `saved_games` table. Future schema
 * changes append to the migration list and bump `schema_version`.
 */

import Database, { type Database as DatabaseType } from 'better-sqlite3';

export type Db = DatabaseType;

/** Migrations run in order; each is a single `db.exec` step. The index
 *  doubles as the schema version. Never reorder or rewrite an existing
 *  entry — append a new one. */
const MIGRATIONS: readonly string[] = [
  `CREATE TABLE IF NOT EXISTS settings (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   );
   CREATE TABLE IF NOT EXISTS saved_games (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     name       TEXT NOT NULL,
     pgn        TEXT NOT NULL,
     white      TEXT,
     black      TEXT,
     result     TEXT,
     event      TEXT,
     played_at  TEXT,
     created_at TEXT NOT NULL,
     ply_count  INTEGER NOT NULL
   );
   CREATE INDEX IF NOT EXISTS saved_games_created_idx
     ON saved_games (created_at DESC);`,
];

export function openDatabase(filePath: string): Db {
  const db = new Database(filePath);
  // WAL is friendlier to concurrent reads + crash safety. Skip for in-memory
  // since WAL is meaningless there and emits a noisy NOTICE.
  if (filePath !== ':memory:') {
    db.pragma('journal_mode = WAL');
  }
  db.pragma('foreign_keys = ON');
  migrate(db);
  return db;
}

function migrate(db: Db): void {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_version (
             version INTEGER PRIMARY KEY
           );`);
  const row = db
    .prepare<
      [],
      { version: number }
    >('SELECT MAX(version) AS version FROM schema_version')
    .get();
  const current = row?.version ?? 0;
  for (let i = current; i < MIGRATIONS.length; i += 1) {
    const stmt = MIGRATIONS[i];
    const apply = db.transaction(() => {
      db.exec(stmt);
      db.prepare('INSERT INTO schema_version (version) VALUES (?)').run(i + 1);
    });
    apply();
  }
}
