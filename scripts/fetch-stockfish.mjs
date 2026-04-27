#!/usr/bin/env node
// Cross-platform dispatcher: picks the right shell script for the current OS
// and forwards exit status. Wired into `postinstall` in package.json so the
// Stockfish binary lands in stockfish/bin/<platform>-<arch>/ on first install.

import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';

const command = isWindows ? 'powershell' : 'bash';
const args = isWindows
  ? [
      '-NoProfile',
      '-ExecutionPolicy',
      'Bypass',
      '-File',
      join(here, 'fetch-stockfish.ps1'),
    ]
  : [join(here, 'fetch-stockfish.sh')];

const result = spawnSync(command, args, { stdio: 'inherit' });

if (result.error) {
  console.error('[fetch-stockfish]', result.error.message);
  process.exit(1);
}

process.exit(result.status ?? 1);
