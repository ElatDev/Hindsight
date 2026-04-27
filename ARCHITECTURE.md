# Architecture

This document explains the technical choices behind Hindsight and the high-level shape of the system. For a phase-by-phase build status, see [PROGRESS.md](./PROGRESS.md). For point-in-time decisions and their reasoning, see [DECISIONS.md](./DECISIONS.md).

---

## Stack rationale

### Why Electron + TypeScript + React (not Tauri, not pure web)

- **Electron** ships a full Chromium + Node runtime. We need a Node main process to spawn the native Stockfish binary as a UCI subprocess and to access the local filesystem (PGN import, SQLite, opening database). Electron gives us this with zero ceremony.
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
│   │  UCI subproc   │   │  PGN / ECO data │  │  (games)   │  │
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
- **`electron/engine/`** — Stockfish UCI wrapper. Exposes `analyzePosition(fen, depth, multiPV)` and `getBestMove(fen, depth)`. Manages a single long-lived Stockfish process per session.
- **`electron/storage/`** — SQLite layer for saved games and analysis cache.
- **`electron/preload.ts`** — typed `contextBridge` API that the renderer calls. Strict types defined in `shared/ipc.ts`.
- **`src/`** — React renderer. No direct Node access; everything goes through preload.
- **`src/chess/`** — game state, PGN/FEN handling, classification thresholds, motif detectors, template renderer.
- **`src/ui/`** — board, move list, eval bar, review panel, settings.
- **`shared/`** — type definitions used by both processes.

---

## Data flow: review pipeline

1. **Input** — user imports a PGN or finishes a game vs Stockfish. Renderer parses with `chess.js` → array of `(fen, sanMove)` pairs.
2. **Analysis request** — renderer calls `analyzeGame(moves, depth, multiPV)` over IPC.
3. **Per-move UCI loop** — main process feeds each FEN to Stockfish, captures `info depth N score cp X pv ...` and `bestmove`. Multi-PV gives us the top 3 alternatives.
4. **Classification** — for each move, compare eval before vs after. Centipawn loss thresholds → Brilliant / Best / Excellent / Good / Inaccuracy / Mistake / Blunder. Mate-in-X handled separately.
5. **Motif detection** — for moves flagged as `Mistake` or worse, run motif detectors against the position the player missed (forks, pins, hanging pieces, etc.).
6. **Template selection** — pick from the explanation library based on `(classification, motifs, game phase)`. Substitute squares/pieces/sequences.
7. **Persistence** — store game + per-move annotations in SQLite. Cache key: PGN hash + analysis depth.
8. **Render** — review UI walks the user through the game with annotations and explanations.

---

## Stockfish bundling strategy

Stockfish binaries are **not committed to git** (license-compatible but bulky and OS-specific).

- A `scripts/fetch-stockfish.{ps1,sh}` script downloads the appropriate binary for the current OS at install time (`postinstall` hook in `package.json`).
- Binaries land in `stockfish/bin/{platform}-{arch}/stockfish[.exe]`, gitignored.
- For distribution builds (Phase 12), `electron-builder` is configured to bundle the matching binary into the installer.
- Source: https://stockfishchess.org/download/ — official builds, GPL v3.

---

## Performance notes

- Stockfish at depth 20 evaluates a position in ~50–500ms on modern hardware. A 60-move game = ~30s–5min. We show progress.
- Analysis cache (PGN hash + depth) means re-opening a saved review is instant.
- Multi-PV adds ~30% overhead per move. We only enable it for flagged (mistake/blunder) moves on a second pass — first pass is single-PV for speed.

---

## What this architecture does *not* do

- **No network calls at runtime.** The fetch-stockfish script runs once at install and is the only network touch. Analysis, opening identification, template rendering — all local.
- **No telemetry, ever.**
- **No accounts, no cloud sync.** Saved games are local SQLite. If a user wants cloud sync they can sync the SQLite file with their own tool.
