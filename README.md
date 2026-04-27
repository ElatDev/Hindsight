# Hindsight

> Free, offline, open-source chess game review.

**Hindsight** is a desktop application that reviews your chess games the way Chess.com's Game Review does — move-by-move annotations, tactical explanations, accuracy scores, suggested better moves — but **runs entirely offline**, with **no subscription**, **no API calls**, and **no telemetry**. Stockfish lives on your machine. Analysis lives on your machine. Your games never leave your machine.

If you've ever wanted Chess.com's review feature without paying for Diamond, or Lichess's analysis with richer per-move explanations, this is for you.

---

## Features

- **Play vs Stockfish** at configurable strength (UCI Elo 1320–3190)
- **Import games** — PGN file, paste PGN text, or enter moves manually; multi-game PGNs prompt a game selector
- **Full game review** with annotations: Sharp (‼), Best (✓), Excellent (!), Good, Inaccuracy (?!), Mistake (?), Blunder (??), Miss, Book — surfaced both inline in the move list and as on-piece grade badges over the board
- **Tactical motif detection** — forks, pins, skewers, discovered attacks, hanging pieces, back-rank weaknesses, removing the defender, overloaded pieces
- **Positional analysis** — pawn structure, king safety, piece activity, material imbalances, game-phase detection
- **Opening identification** via the bundled ECO database (Lichess opening data)
- **Human-readable explanations** generated from a 100+ template library — no LLM calls at runtime
- **Accuracy score** per player, à la Lichess / Chess.com (harmonic-mean over centipawn losses)
- **Critical moments** view that jumps to the biggest evaluation swings
- **Multi-PV alternatives** for flagged moves (top 3 lines, single-pass)
- **Configurable analysis depth** — slider from depth 8 (fast) to depth 22 (deep)
- **Live eval bar** during play (toggleable from settings)
- **Saved games** — store any played or imported PGN to a local SQLite database; load it back later
- **Right-click highlights + Lichess-style L-shaped knight arrows** for both review and play
- **Multiple board palettes** (classic / blue / green / gray) and a light + dark theme toggle
- **Export annotated PGN** with per-move NAG glyphs, `[%eval ...]` comments, and rendered explanations

---

## Screenshots

_Coming with the v0.1 release._ The screenshot set planned for the release page covers the play view, the post-game review (annotations + suggested-move arrow + grade badges), the critical-moments / alternatives panel, the saved-games browser, and the settings dialog.

---

## Tech stack

| Layer       | Choice                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| Shell       | [Electron](https://www.electronjs.org/)                                      |
| UI          | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)  |
| Build       | [Vite](https://vitejs.dev/) + `vite-plugin-electron`                         |
| Chess logic | [`chess.js`](https://github.com/jhlywa/chess.js)                             |
| Board UI    | [`react-chessboard`](https://github.com/Clariity/react-chessboard)           |
| Engine      | [Stockfish](https://stockfishchess.org/) (native binary, fetched at install) |
| Storage     | SQLite (`better-sqlite3`)                                                    |
| Lint/format | ESLint + Prettier + husky + lint-staged                                      |

The full stack rationale is in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Install

Pre-built installers for the latest release are on the [GitHub Releases page](https://github.com/ElatDev/Hindsight/releases). Download the artifact for your OS and run it.

> No code signing is in place yet, so Windows SmartScreen / macOS Gatekeeper will prompt before launching. See [DECISIONS.md ADR-005](./DECISIONS.md) for the rationale.

---

## Quickstart (development)

> Requires Node 20+, npm 10+, git.

```bash
git clone https://github.com/ElatDev/Hindsight.git
cd Hindsight
npm install
npm run dev
```

Stockfish is downloaded on first install (cached locally, never committed). On Windows, if `npm run dev` crashes with a `whenReady` error, your shell has `ELECTRON_RUN_AS_NODE` set — `unset` it and re-run. (Full troubleshooting in [docs/USER_GUIDE.md](./docs/USER_GUIDE.md).)

---

## Build

`npm run dist` produces an installer for the **host operating system** using `electron-builder`. Cross-OS builds need their respective hosts (or a CI matrix) — there's no cross-compilation for the macOS / Linux targets.

| OS      | Command        | Output                                        |
| ------- | -------------- | --------------------------------------------- |
| Windows | `npm run dist` | `release/Hindsight-x.y.z-windows-x64.exe`     |
| macOS   | `npm run dist` | `release/Hindsight-x.y.z-mac-{x64,arm64}.dmg` |
| Linux   | `npm run dist` | `release/Hindsight-x.y.z-linux-x64.AppImage`  |

`npm run dist:dir` produces the unpacked app folder without wrapping it in an installer — handy for quick smoke tests.

Code signing and notarization are **not** configured in v0.1; users will see the standard "unidentified developer" warnings (SmartScreen on Windows, Gatekeeper on macOS). See [DECISIONS.md ADR-005](./DECISIONS.md) for context.

---

## Roadmap

| Phase | Scope                                              |   Status   |
| ----: | -------------------------------------------------- | :--------: |
|     0 | Repo + scaffold                                    |     ✅     |
|     1 | Stockfish UCI integration                          |     ✅     |
|     2 | Chess logic layer (`chess.js`, PGN, FEN)           |     ✅     |
|     3 | Board GUI                                          |     ✅     |
|     4 | Play vs Stockfish                                  |     ✅     |
|     5 | Game import (PGN file/paste/manual)                |     ✅     |
|     6 | Analysis pipeline (per-move eval + classification) |     ✅     |
|     7 | Tactical motif detection                           |     ✅     |
|     8 | Positional analysis                                |     ✅     |
|     9 | Opening database (ECO)                             |     ✅     |
|    10 | Explanation template system (100+ templates)       |     ✅     |
|    11 | Review UI                                          |     ✅     |
|    12 | Polish + distribution                              |     ✅     |
|    13 | Documentation + screenshots                        | 🟡 in prog |

The full per-task checklist is in [PROGRESS.md](./PROGRESS.md). Architectural decisions are in [DECISIONS.md](./DECISIONS.md). User-facing walkthrough lives in [docs/USER_GUIDE.md](./docs/USER_GUIDE.md); contributor onboarding in [docs/CONTRIBUTING.md](./docs/CONTRIBUTING.md).

---

## Contributing

Contributions welcome — especially:

- New explanation templates (the more the merrier)
- Additional tactical motif detectors
- Translations of explanation templates
- Bug reports with PGN attached

Standard flow: fork, branch, PR. Run `npm run lint && npm run typecheck` before pushing — the pre-commit hook will catch most issues automatically. The [contributor guide](./docs/CONTRIBUTING.md) walks through adding a template, writing a motif detector, and rebuilding the opening database.

---

## License

[MIT](./LICENSE) — do whatever you want, just don't blame us if Stockfish tells you your favorite move was a blunder.
