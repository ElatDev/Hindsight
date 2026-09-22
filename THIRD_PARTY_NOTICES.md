# Third-party notices

Hindsight's own code is released under the MIT license (see `LICENSE`).
The app ships with, or is built from, the components below. Each keeps its
own license.

In an installed copy of Hindsight, this file, `LICENSE.txt` and
`pieces-LICENSE.txt` are in the app's `resources` folder (`Contents/Resources`
on macOS).

## Stockfish

Hindsight runs [Stockfish](https://stockfishchess.org/) for all analysis and
for the engine opponent. Stockfish ships as a separate executable in
`resources/stockfish/bin/<platform>-<arch>/`. Hindsight starts it as a child
process and talks to it over the UCI text protocol. It does not link to it.

- Version: Stockfish 17 (release tag `sf_17`), an unmodified official build
  from <https://github.com/official-stockfish/Stockfish/releases/tag/sf_17>.
- License: GNU General Public License, version 3. The full text is in
  `Copying.txt` next to the Stockfish binary, and `AUTHORS` lists the
  authors.
- Source: <https://github.com/official-stockfish/Stockfish/tree/sf_17>. The
  upstream release archive also contains the full source, and each Hindsight
  release on GitHub has a copy of the matching Stockfish source attached.
  `SOURCE.txt` next to the binary gives the exact archive it came from.

## Piece artwork

The ten piece sets come from the
[Lichess repository](https://github.com/lichess-org/lila/tree/master/public/piece).
Each set keeps its author's license, as listed in lila's
[COPYING.md](https://github.com/lichess-org/lila/blob/master/COPYING.md):

| Set        | Author                      | License         |
| ---------- | --------------------------- | --------------- |
| cburnett   | Colin M.L. Burnett          | GPLv2+          |
| merida     | Armando Hernandez Marroquin | GPLv2+          |
| california | Jerry S.                    | CC BY-NC-SA 4.0 |
| cardinal   | sadsnake1                   | CC BY-NC-SA 4.0 |
| chessnut   | Alexis Luengas              | Apache 2.0      |
| fantasy    | Maurizio Monge              | MIT             |
| maestro    | sadsnake1                   | CC BY-NC-SA 4.0 |
| pirouetti  | pirouetti                   | AGPLv3+         |
| staunty    | sadsnake1                   | CC BY-NC-SA 4.0 |
| tatiana    | sadsnake1                   | CC BY-NC-SA 4.0 |

The CC BY-NC-SA 4.0 sets do not allow commercial use. These licenses apply
to the artwork only, not to Hindsight's code. Two sets that lila lists as
non-free (alpha and leipzig) are not included. The same list ships as
`pieces-LICENSE.txt`.

## Opening names

`src/data/eco.json` is built from
[lichess-org/chess-openings](https://github.com/lichess-org/chess-openings),
which is dedicated to the public domain under CC0 1.0.

## Electron and Chromium

Hindsight runs on [Electron](https://www.electronjs.org/) (MIT), which
bundles Chromium. Their licenses ship with the app as `LICENSE.electron.txt`
and `LICENSES.chromium.html`.

## npm packages

The main runtime libraries are:

| Package                                                          | License      |
| ---------------------------------------------------------------- | ------------ |
| [React and React DOM](https://github.com/facebook/react)         | MIT          |
| [chess.js](https://github.com/jhlywa/chess.js)                   | BSD-2-Clause |
| [react-chessboard](https://github.com/Clariity/react-chessboard) | MIT          |
| [better-sqlite3](https://github.com/WiseLibs/better-sqlite3)     | MIT          |

Their dependencies are under the MIT, ISC, BSD-2-Clause, BSD-3-Clause or
Apache-2.0 licenses. Each package's own license file is included in the app
archive (`resources/app.asar`, under `node_modules/`).
