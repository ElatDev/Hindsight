#!/usr/bin/env node
/**
 * Fetches the piece-set SVGs listed in `SETS` from Lichess' lila
 * repository so the renderer can offer real piece-set choice. Each
 * set ships as 12 SVGs (white + black × king queen rook bishop knight pawn).
 *
 * Each set has its own author and license, copied from lila's COPYING.md
 * into `LICENSES` below and written out to `src/data/pieces/LICENSE`.
 * Run once via `npm run fetch-pieces`; the result is
 * committed into `src/data/pieces/<set>/<piece>.svg`. Re-run to refresh the
 * artwork if upstream updates.
 */

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DEST = resolve(__dirname, '..', 'src', 'data', 'pieces');

const SETS = [
  'cburnett',
  'merida',
  'alpha',
  'california',
  'cardinal',
  'chessnut',
  'fantasy',
  'leipzig',
  'maestro',
  'pirouetti',
  'staunty',
  'tatiana',
];
// Per-set author and license, as listed in
// https://github.com/lichess-org/lila/blob/master/COPYING.md. Check that
// file again before adding a set: several are non-free or non-commercial.
const LICENSES = {
  cburnett: ['Colin M.L. Burnett', 'GPLv2+'],
  merida: ['Armando Hernandez Marroquin', 'GPLv2+'],
  alpha: ['Eric Bentzen', '"free for personal non commercial use" (non-free)'],
  california: ['Jerry S.', 'CC BY-NC-SA 4.0'],
  cardinal: ['sadsnake1', 'CC BY-NC-SA 4.0'],
  chessnut: ['Alexis Luengas', 'Apache 2.0'],
  fantasy: ['Maurizio Monge', 'MIT'],
  leipzig: ['Armando Hernandez Marroquin', '"freeware" (non-free)'],
  maestro: ['sadsnake1', 'CC BY-NC-SA 4.0'],
  pirouetti: ['pirouetti', 'AGPLv3+'],
  staunty: ['sadsnake1', 'CC BY-NC-SA 4.0'],
  tatiana: ['sadsnake1', 'CC BY-NC-SA 4.0'],
};
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

  // Drop a NOTICE so anyone reading the repo (or the installed app) knows
  // who drew each set and under what terms.
  const rows = SETS.map((set) => {
    const [author, license] = LICENSES[set];
    return `- ${set}: ${author}, ${license}`;
  });
  const notice = `Piece-set artwork in this directory comes from the Lichess
repository (https://github.com/lichess-org/lila/tree/master/public/piece).
Each set keeps its author's license. The authors and licenses below are
copied from https://github.com/lichess-org/lila/blob/master/COPYING.md,
which is the authoritative list:

${rows.join('\n')}

Some of these licenses are non-commercial (CC BY-NC-SA 4.0, "free for
personal non commercial use") and lila lists alpha and leipzig as non-free.
They cover the artwork only. The Hindsight application code (everything
outside this directory) is MIT licensed.
`;
  await writeFile(join(DEST, 'LICENSE'), notice, 'utf8');
  console.log('Done.');
}

void main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
