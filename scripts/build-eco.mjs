#!/usr/bin/env node
// Fetch the Lichess open-source ECO opening database and bundle it as
// src/data/eco.json. Run manually when we want to refresh the data:
//   npm run build-eco
//
// The Lichess dataset is split across a.tsv..e.tsv on master; each row is
// `eco<TAB>name<TAB>pgn`. We strip move numbers from each pgn into a flat
// SAN array (no need for chess.js — Lichess data is well-formed) so the
// runtime matcher can compare token-by-token.
//
// Source: https://github.com/lichess-org/chess-openings (CC0).

import { writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const outPath = join(here, '..', 'src', 'data', 'eco.json');

const FILES = ['a', 'b', 'c', 'd', 'e'];
const BASE = 'https://raw.githubusercontent.com/lichess-org/chess-openings/master';

/** Parse "1. e4 e5 2. Nf3" → ["e4", "e5", "Nf3"]. */
function pgnToSan(pgn) {
  return pgn
    .split(/\s+/)
    .filter((t) => t && !/^\d+\.+$/.test(t))
    .filter((t) => !/^(1-0|0-1|1\/2-1\/2|\*)$/.test(t));
}

async function fetchTsv(letter) {
  const url = `${BASE}/${letter}.tsv`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return res.text();
}

function parseTsv(text) {
  const lines = text.split(/\r?\n/);
  const header = lines.shift();
  if (!header || !header.startsWith('eco')) {
    throw new Error('Unexpected TSV header (no eco column)');
  }
  const out = [];
  for (const line of lines) {
    if (!line) continue;
    const [eco, name, pgn] = line.split('\t');
    if (!eco || !name || !pgn) continue;
    const san = pgnToSan(pgn);
    if (san.length === 0) continue;
    out.push({ eco, name, pgn, san });
  }
  return out;
}

async function main() {
  const all = [];
  for (const f of FILES) {
    process.stdout.write(`[build-eco] fetching ${f}.tsv … `);
    const text = await fetchTsv(f);
    const rows = parseTsv(text);
    all.push(...rows);
    process.stdout.write(`${rows.length} entries\n`);
  }
  // Sort longest-first so the matcher's longest-prefix win is implicit even
  // for naive iterations. Tie-break alphabetically by name for stable output.
  all.sort((a, b) => b.san.length - a.san.length || a.name.localeCompare(b.name));

  await writeFile(outPath, JSON.stringify(all, null, 0) + '\n', 'utf8');
  console.log(`[build-eco] wrote ${all.length} entries to ${outPath}`);
}

main().catch((err) => {
  console.error('[build-eco] failed:', err.message);
  process.exit(1);
});
