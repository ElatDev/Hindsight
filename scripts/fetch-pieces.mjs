#!/usr/bin/env node
/**
 * Fetches the Cburnett, Merida, and Alpha piece-set SVGs from Lichess'
 * lila repository so the renderer can offer real piece-set choice. Each
 * set ships as 12 SVGs (white + black × king queen rook bishop knight pawn).
 *
 * The SVGs are CC-BY-SA 4.0 (Lichess assets) — see `src/data/pieces/LICENSE`
 * for attribution. Run once via `npm run fetch-pieces`; the result is
 * committed into `src/data/pieces/<set>/<piece>.svg`. Re-run to refresh the
 * artwork if upstream updates.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(__dirname, '..', 'src', 'data', 'pieces');

const SETS = ['cburnett', 'merida', 'alpha'];
const PIECES = ['K', 'Q', 'R', 'B', 'N', 'P'];
const COLORS = ['w', 'b'];
const BASE =
  'https://raw.githubusercontent.com/lichess-org/lila/master/public/piece';

async function fetchOne(set, color, piece) {
  const filename = `${color}${piece}.svg`;
  const url = `${BASE}/${set}/${filename}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  const body = await res.text();
  const out = join(DEST, set, filename);
  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, body, 'utf8');
  return filename;
}

async function main() {
  console.log(`Fetching piece sets into ${DEST}`);
  for (const set of SETS) {
    for (const color of COLORS) {
      for (const piece of PIECES) {
        const name = await fetchOne(set, color, piece);
        process.stdout.write(`  ${set}/${name}\n`);
      }
    }
  }

  // Drop a small NOTICE so anyone reading the repo knows the license + source.
  const notice = `Piece-set artwork in this directory is sourced from the
Lichess public assets (https://github.com/lichess-org/lila/tree/master/public/piece)
and is licensed under CC-BY-SA 4.0:
https://creativecommons.org/licenses/by-sa/4.0/

Sets included:
- cburnett — by C. Burnett (Wikipedia chess piece designer); CC-BY-SA 3.0/4.0
- merida — Armando Hernandez Marroquin (alpha), CC0
- alpha — Eric Bentzen, CC-BY-NC

Refer to the upstream Lichess repository for full per-set attribution.

The Hindsight application code (everything outside this directory) is MIT
licensed; including CC-BY-SA assets does not relicense the app code, only
the assets themselves.
`;
  await writeFile(join(DEST, 'LICENSE'), notice, 'utf8');
  console.log('Done.');
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
