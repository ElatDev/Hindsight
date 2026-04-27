/**
 * Settings persistence on top of the SQLite KV table. Values are JSON-encoded
 * so any shape the renderer wants survives a round-trip; the renderer applies
 * its own type-narrowing sanitizer (`useSettings` reuses the same one for
 * localStorage). Keeping the shape opaque here means schema migrations only
 * need to add new keys — never alter columns.
 */

import type { Db } from './db';

export type SettingsRecord = Readonly<Record<string, unknown>>;

export type SettingsLoad = {
  settings: SettingsRecord;
  /** True iff the table had at least one row when we loaded. Lets the
   *  renderer detect a fresh DB and seed it from localStorage. */
  bootstrapped: boolean;
};

export function loadSettings(db: Db): SettingsLoad {
  const rows = db
    .prepare<
      [],
      { key: string; value: string }
    >('SELECT key, value FROM settings')
    .all();
  const settings: Record<string, unknown> = {};
  for (const { key, value } of rows) {
    try {
      settings[key] = JSON.parse(value);
    } catch {
      // Corrupt row — skip and let the sanitizer fill in the default.
    }
  }
  return { settings, bootstrapped: rows.length > 0 };
}

export function saveSettings(db: Db, patch: SettingsRecord): void {
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (@key, @value)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
  );
  const tx = db.transaction((entries: [string, unknown][]) => {
    for (const [key, value] of entries) {
      upsert.run({ key, value: JSON.stringify(value) });
    }
  });
  tx(Object.entries(patch));
}
