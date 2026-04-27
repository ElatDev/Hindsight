# Hindsight

> Free, offline, open-source chess game review.

**Hindsight** is a desktop application that reviews your chess games the way Chess.com's Game Review does — move-by-move annotations, tactical explanations, accuracy scores, suggested better moves — but **runs entirely offline**, with **no subscription**, **no API calls**, and **no telemetry**. Stockfish lives on your machine. Analysis lives on your machine. Your games never leave your machine.

If you've ever wanted Chess.com's review feature without paying for Diamond, or Lichess's analysis with richer per-move explanations, this is for you.

---

## Features

- **Play vs Stockfish** at configurable strength (UCI Elo or skill level)
- **Import games** — PGN file, paste PGN text, or enter moves manually
- **Full game review** with annotations: Brilliant (‼), Great (!), Best, Excellent, Good, Inaccuracy (?!), Mistake (?), Blunder (??), Miss, Book
- **Tactical motif detection** — forks, pins, skewers, discovered attacks, hanging pieces, back-rank weaknesses, removing the defender, overloaded pieces
- **Positional analysis** — pawn structure, king safety, piece activity, space, material imbalances
- **Opening identification** via the bundled ECO database
- **Human-readable explanations** generated from a 100+ template library — no LLM calls at runtime
- **Accuracy score** per player, à la Lichess / Chess.com
- **Critical moments** view that jumps to the biggest evaluation swings
- **Multi-PV analysis** for flagged moves (top 3 alternatives shown)
- **Configurable analysis depth** — fast (depth 18), deep (depth 25), ultra (depth 30)
- **Local SQLite database** — saved reviews available without re-analyzing
- **Export annotated PGN** for use in any chess software
- **Light + dark themes**

> Screenshots coming once Phase 11 (Review UI) lands.

---

## Tech stack

| Layer       | Choice                                                                       |
| ----------- | ---------------------------------------------------------------------------- |
| Shell       | [Electron](https://www.electronjs.org/)                                      |
| UI          | [React](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)  |
| Build       | [Vite](https://vitejs.dev/) + `vite-plugin-electron`                         |
| Chess logic | [`chess.js`](https://github.com/jhlywa/chess.js)                             |
| Board UI    | [`react-chessboard`](https://github.com/Clariity/react-chessboard) (Phase 3) |
| Engine      | [Stockfish](https://stockfishchess.org/) (native binary, fetched at install) |
| Storage     | SQLite (`better-sqlite3`)                                                    |
| Lint/format | ESLint + Prettier + husky + lint-staged                                      |

The full stack rationale is in [ARCHITECTURE.md](./ARCHITECTURE.md).

---

## Quickstart

> Requires Node 20+, npm 10+, git.

```bash
git clone https://github.com/ElatDev/Hindsight.git
cd Hindsight
npm install
npm run dev
```

Stockfish will be downloaded on first run (cached locally; never committed).

---

## Build

| OS      | Command               | Output                              |
| ------- | --------------------- | ----------------------------------- |
| Windows | `npm run build:win`   | `release/Hindsight Setup x.x.x.exe` |
| macOS   | `npm run build:mac`   | `release/Hindsight-x.x.x.dmg`       |
| Linux   | `npm run build:linux` | `release/Hindsight-x.x.x.AppImage`  |

(Build scripts land in Phase 12.)

---

## Roadmap

| Phase | Scope                                              |   Status   |
| ----: | -------------------------------------------------- | :--------: |
|     0 | Repo + scaffold                                    |     ✅     |
|     1 | Stockfish UCI integration                          | 🟡 next up |
|     2 | Chess logic layer (`chess.js`, PGN, FEN)           |     ⬜     |
|     3 | Board GUI                                          |     ⬜     |
|     4 | Play vs Stockfish                                  |     ⬜     |
|     5 | Game import (PGN file/paste/manual)                |     ⬜     |
|     6 | Analysis pipeline (per-move eval + classification) |     ⬜     |
|     7 | Tactical motif detection                           |     ⬜     |
|     8 | Positional analysis                                |     ⬜     |
|     9 | Opening database (ECO)                             |     ⬜     |
|    10 | Explanation template system (100+ templates)       |     ⬜     |
|    11 | Review UI                                          |     ⬜     |
|    12 | Polish + distribution                              |     ⬜     |
|    13 | Documentation + screenshots                        |     ⬜     |

Live progress is tracked in [PROGRESS.md](./PROGRESS.md). Architectural decisions in [DECISIONS.md](./DECISIONS.md).

---

## Contributing

Contributions welcome — especially:

- New explanation templates (the more the merrier)
- Additional tactical motif detectors
- Translations of explanation templates
- Bug reports with PGN attached

Standard flow: fork, branch, PR. Run `npm run lint && npm run typecheck` before pushing — the pre-commit hook will catch most issues automatically.

---

## License

[MIT](./LICENSE) — do whatever you want, just don't blame us if Stockfish tells you your favorite move was a blunder.
