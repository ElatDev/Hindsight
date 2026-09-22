# Architecture

This document explains the technical choices behind Hindsight and the high-level shape of the system. For a phase-by-phase build status, see [PROGRESS.md](./PROGRESS.md). For point-in-time decisions and their reasoning, see [DECISIONS.md](./DECISIONS.md).

---

## Stack rationale

### Why Electron + TypeScript + React (not Tauri, not pure web)

- **Electron** ships a full Chromium + Node runtime. We need a Node main process to spawn the native Stockfish binary as a UCI subprocess and to access the local filesystem (PGN import and export, SQLite). Electron gives us this with zero ceremony.
- **Tauri** would be lighter (no Chromium), but it requires a Rust toolchain to build, and the project is intended to be maintainable by a single developer without that learning curve.
- **Pure web + Stockfish.js (WASM)** is the simplest distribution but loses native subprocess control (slower analysis, harder threading), native file dialogs, and easy local SQLite. Keeping native Stockfish is a meaningful win for Phase 6 (analysis pipeline).

### Why no Python (deviation from the original spec)

The original spec recommended Electron + Python + `python-chess`. I chose to drop Python because:

- **One language, one runtime.** All chess logic, UI, and engine orchestration live in TypeScript. No JSON-RPC bridge, no second test stack, no second runtime to ship in the installer.
- **`chess.js` is sufficient.** It handles FEN parsing, PGN parsing, move generation, legal-move validation, threefold-repetition / fifty-move detection, and game-end conditions. The advanced ergonomics of `python-chess` (board introspection helpers, opening book parsers) are nice-to-haves we can replicate as small TS utilities when needed.
- **Tactical detection is the same effort in either language.** It's deterministic logic over a `Board` data structure — equally clean in TS or Python.

This is documented as ADR-001 in [DECISIONS.md](./DECISIONS.md).

---

## Process model

```
┌──────────────────────────────────────────────────────────────┐
│  Electron Main Process (Node.js)                             │
│                                                              │
│   ┌────────────────┐   ┌─────────────────┐  ┌────────────┐  │
│   │  Stockfish     │   │  Filesystem /   │  │  SQLite    │  │
│   │  pool, up to 4 │   │  PGN files      │  │  (games)   │  │
│   └───────┬────────┘   └────────┬────────┘  └─────┬──────┘  │
│           │                     │                 │          │
│           └──────────┬──────────┴─────────────────┘          │
│                     │ typed IPC (contextBridge)              │
└─────────────────────┼────────────────────────────────────────┘
                      │
┌─────────────────────┼────────────────────────────────────────┐
│  Renderer Process (React + chess.js)                         │
│                     │                                        │
│   ┌─────────────────▼──────────────┐  ┌──────────────────┐  │
│   │  Game state (chess.js Board)   │  │  Board UI        │  │
│   │  Move list / navigation        │  │  (drag, arrows)  │  │
│   │  Review panel / explanations   │  │  Eval bar        │  │
│   └────────────────────────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
```

### Module boundaries

- **`electron/main.ts`** — app lifecycle, BrowserWindow, IPC handlers.
- **`electron/engine/`** — Stockfish UCI wrapper (`stockfish.ts`), `analyzePosition(engine, fen, opts)` (`analyze.ts`) and an engine pool (`pool.ts`). The pool runs up to 4 Stockfish processes, started lazily as work arrives. The `engine:analyze` and `engine:bestMove` IPC handlers in `main.ts` dispatch to it.
- **`electron/storage/`** — SQLite layer for settings and saved games.
- **`electron/preload.ts`** — typed `contextBridge` API that the renderer calls. Strict types defined in `shared/ipc.ts`.
- **`src/`** — React renderer. No direct Node access; everything goes through preload.
- **`src/chess/`** — game state, PGN/FEN handling, classification thresholds, motif detectors, template renderer.
- **`src/ui/`** — board, move list, eval bar, review panel, settings.
- **`shared/`** — type definitions used by both processes.

---

## Data flow: review pipeline

1. **Input** — user imports a PGN or finishes a game vs Stockfish. Renderer parses with `chess.js` → array of `(fen, sanMove)` pairs.
2. **Analysis request** — renderer-side `analyzeGame(game, { depth, multiPV })` (`src/chess/analysis.ts`) sends one `engine:analyze` IPC call per position, all at once. Each position is analyzed once: the position after one move is the position before the next, so one search covers both.
3. **Parallel UCI searches** — the main-process engine pool spreads the positions across up to 4 Stockfish processes. Each search captures `info depth N score cp X pv ...` and `bestmove`. It is a single pass with MultiPV 3 on every position a move was played from; flagged moves (Inaccuracy, Mistake, Blunder, Miss) take their alternatives from those lines, with no second pass.
4. **Classification** — for each move, compare eval before vs after. The engine's first choice or any checkmate is Best; otherwise centipawn loss thresholds → Excellent / Good / Inaccuracy / Mistake / Blunder. Mate-in-X handled separately (Miss for a lost forced mate, Blunder for walking into one). Sharp and Book are defined but never assigned.
5. **Motif detection** — for every move, run motif detectors on the position after it, from the mover's side (hanging pieces, forks, pins, skewers, back-rank weakness, double attacks, overloaded defenders).
6. **Template selection** — pick from the explanation library based on `(classification, motifs, game phase)`. Substitute squares, pieces and moves.
7. **Persistence** — none for reviews. SQLite stores settings and saved games (PGN plus a few header fields) only, so every review re-runs Stockfish.
8. **Render** — review UI walks the user through the game with annotations and explanations.

---

## Stockfish bundling strategy

Stockfish binaries are **not committed to git** (license-compatible but bulky and OS-specific).

- A `scripts/fetch-stockfish.{ps1,sh}` script downloads the appropriate binary for the current OS at install time (`postinstall` hook in `package.json`, through the `scripts/fetch-stockfish.mjs` dispatcher).
- Binaries land in `stockfish/bin/{platform}-{arch}/stockfish[.exe]`, gitignored. The fetch scripts also keep Stockfish's `Copying.txt` and `AUTHORS` and write a `SOURCE.txt` next to the binary that points to the matching source.
- For distribution builds (Phase 12), `electron-builder` is configured to bundle the matching binary into the installer. The same `build.extraResources` list in `package.json` ships `LICENSE`, `THIRD_PARTY_NOTICES.md` and the piece-set license.
- On macOS, `scripts/adhoc-sign-mac.cjs` runs as an electron-builder `afterPack` hook and ad-hoc signs the app, because there is no Developer ID yet.
- Source: the official Stockfish releases on GitHub (`official-stockfish/Stockfish`, tag `sf_17` by default), GPL v3.

---

## Performance notes

- Each position is searched to a fixed depth (default 10, range 8–22 in Settings). Search time grows quickly with depth, so review time depends on depth, game length and hardware. We show progress.
- The engine pool runs up to 4 single-threaded Stockfish processes and dispatches every position up front, so positions are analyzed in parallel. Each position is analyzed once.
- There is no analysis cache. Re-opening a saved game and reviewing it runs Stockfish again.
- Multi-PV runs on every position in the single pass (MultiPV 3), so alternatives for flagged moves need no second pass.

---

## What this architecture does _not_ do

- **No network calls at runtime.** The fetch-stockfish script runs once at install and is the only network touch. Analysis, opening identification, template rendering — all local.
- **No telemetry, ever.**
- **No accounts, no cloud sync.** Saved games are local SQLite. If a user wants cloud sync they can sync the SQLite file with their own tool.
