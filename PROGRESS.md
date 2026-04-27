# PROGRESS

> Live build status. Updated after every commit. The most current row in the table below is always at the top.

## Current session

**Phase 1 complete; Phase 2 complete; Phase 3 / Task 1 done.** 31 tests pass.

- Phase 1: Stockfish fetcher + UCI handshake + analyzePosition + Vitest engine tests + IPC surface (typed `shared/ipc.ts`, `electron/main.ts` owns a lazily-started long-lived `StockfishEngine`, preload bridges `window.hindsight.engine.{analyze,bestMove}`).
- Phase 2: `chess.js@^1.4.0` wrapper in `src/chess/game.ts` (factories, load/loadFen, move, undo, history(+verbose), legalMoves(+verbose), inCheck, isGameOver, `gameEnd()`, `headers()`, `comments()`, `raw()` escape hatch). `GameEnd` is a const + string-literal union. 23 chess tests cover initial state, legal/illegal moves, Fool's Mate, stalemate, K-vs-K insufficient material, threefold (knight shuffle), fifty-move (high halfmove clock), PGN headers, brace comments, NAGs, variations, ambiguous SAN (`Nbd2`/`Nfd2`), queenside castling, underpromotion, capture+promotion, check/mate suffixes, and a multi-feature PGN round-trip.
- Phase 3 / Task 1: `src/ui/Board.tsx` is a thin `react-chessboard` wrapper rendering `game.fen()` with optional orientation + width. Pinned `react-chessboard@^4.7.3` (5.x requires React 19, we're on 18). `App.tsx` replaces the placeholder with the live board against a fresh `Game()`. Manual smoke: `npm run dev` boots Vite + Electron cleanly (4 electron.exe processes, no console errors). Dev mode for now leaves the board read-only — drag-drop arrives in Task 2.

Notes:

- PowerShell scripts must be ASCII-safe — Windows PowerShell 5.1 reads `.ps1` as Windows-1252 unless there's a BOM.
- IPC `window.hindsight.engine.bestMove(...)` round-trip is still untested through the renderer DevTools. Easy follow-up: in DevTools, paste `await window.hindsight.engine.bestMove({ fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', depth: 8 })` and confirm a UCI move comes back. Worth doing during Phase 3 / Task 2 when we're already in the renderer.
- Renderer bundle ballooned from 142kB → 280kB after react-chessboard + react-dnd. Acceptable for desktop.

**Last updated:** 2026-04-27

## Next up

- **Phase 3 / Task 2** — Drag-and-drop with legal-move enforcement: `Board` accepts an `onMove` callback, the parent (`App.tsx` for now) applies it via `Game.move()`, and react-chessboard's `onPieceDrop` returns true/false based on legality. State management: trigger React re-renders by bumping a counter or holding the FEN as state alongside the Game instance.
- **Phase 3 / Task 3** — Legal-move highlighting on piece selection: use `Game.legalMovesVerbose({ square })` to derive a `customSquareStyles` map. Wire into Board's `onSquareClick` / `onPieceClick`.

## Blockers

_None._

---

## Phase status

| Phase | Scope                                              |   Status   |
| ----: | -------------------------------------------------- | :--------: |
|     0 | Repo + scaffold                                    |     ✅     |
|     1 | Stockfish UCI integration                          |     ✅     |
|     2 | Chess logic layer (`chess.js`, PGN, FEN)           |     ✅     |
|     3 | Board GUI                                          | 🟡 in prog |
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

---

## Phase 0 — Repo + scaffold

- [x] **Task 1** — Install `gh` CLI via winget (`winget install --id GitHub.cli -e`).
- [x] **Task 2** — Create local repo skeleton: `git init`, `LICENSE` (MIT), `.gitignore`, `.editorconfig`.
- [x] **Task 3** — Write `README.md` (public-facing pitch, features, roadmap).
- [x] **Task 4** — Write `ARCHITECTURE.md` (stack rationale, process model, data flow).
- [x] **Task 5** — Write `PROGRESS.md` (this file).
- [x] **Task 6** — Write `DECISIONS.md` (seeded with ADR-001..004 + Windows env-var note).
- [x] **Task 7** — Scaffold Vite + React + TS + Electron. Build green; window opens via `node_modules/electron/dist/electron.exe .`.
- [x] **Task 8** — ESLint + Prettier + husky pre-commit; `lint`, `format`, `typecheck`, `format:check` scripts.
- [x] **Task 9** — `gh auth login` (account: ElatDev), `gh repo create Hindsight --public`, push to GitHub.
- [x] **Task 10** — Phase 0 housekeeping: this update.

## Phase 1 — Stockfish UCI integration

- [x] **Task 1** — Write `scripts/fetch-stockfish.{ps1,sh}` to download the OS-appropriate Stockfish binary into `stockfish/bin/`. Hook into `postinstall` in `package.json`.
- [x] **Task 2** — `electron/engine/stockfish.ts`: spawn the Stockfish process, handle UCI handshake (`uci`, `isready`, `ucinewgame`).
- [x] **Task 3** — `electron/engine/analyze.ts`: `analyzePosition(fen, depth, multiPV)` returning `{ bestMove, evalCp, mateIn, pv[] }`.
- [x] **Task 4** — `electron/engine/__tests__/`: unit tests using a real Stockfish (Vitest + child_process). Cover handshake, bestmove on starting position, mate-in-1 detection.
- [x] **Task 5** — IPC: expose `engine.analyze` / `engine.bestMove` via preload. Typed in `shared/ipc.ts`.

## Phase 2 — Chess logic layer

- [x] **Task 1** — Add `chess.js`. Wrap in `src/chess/game.ts` with our typed surface (`Game.load(pgn)`, `Game.move(san)`, `Game.fen()`, `Game.history()`, `Game.isGameOver()`).
- [x] **Task 2** — PGN parsing: support headers, comments, NAGs, variations (we'll mostly ignore variations on import for v1 but parse without erroring).
- [x] **Task 3** — Game-end detection: checkmate, stalemate, threefold, fifty-move, insufficient material. Surface as a typed `GameEnd` enum.
- [x] **Task 4** — Tests for tricky PGN inputs (en passant, promotion, castling notation variants).

## Phase 3 — Board GUI

- [x] **Task 1** — Add `react-chessboard`. Render board in `src/ui/Board.tsx` with the current `Game` state.
- [ ] **Task 2** — Drag-and-drop with legal-move enforcement (only allow legal moves; snap back on illegal).
- [ ] **Task 3** — Legal-move highlighting on piece selection.
- [ ] **Task 4** — Move list (`src/ui/MoveList.tsx`) in algebraic notation, click to navigate.
- [ ] **Task 5** — Navigation controls (first / prev / next / last / flip board).
- [ ] **Task 6** — Eval bar (placeholder data until Phase 6 wires it to engine output).
- [ ] **Task 7** — Light/dark theme toggle.

## Phase 4 — Play vs Stockfish

- [ ] **Task 1** — "New game vs engine" flow with Elo / skill-level chooser.
- [ ] **Task 2** — Engine plays its move on its turn (renderer requests `engine.bestMove` via IPC).
- [ ] **Task 3** — Game-end detection triggers "review this game?" prompt.

## Phase 5 — Game import

- [ ] **Task 1** — PGN file picker (Electron native dialog).
- [ ] **Task 2** — PGN paste textarea with parse-on-paste preview.
- [ ] **Task 3** — Manual move-entry mode (board accepts moves, no engine).
- [ ] **Task 4** — Multi-game PGN: list selector for which game to load.

## Phase 6 — Analysis pipeline

- [ ] **Task 1** — `src/chess/analysis.ts`: orchestrate per-move eval over a `Game.history()`.
- [ ] **Task 2** — Centipawn-loss thresholds → classification (Brilliant, Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Miss, Book).
- [ ] **Task 3** — Mate-in-X handling (eval comparison breaks down at mate scores; treat separately).
- [ ] **Task 4** — Multi-PV second pass for flagged moves (top 3 alternatives).
- [ ] **Task 5** — Accuracy score (Lichess-style harmonic-mean formula over centipawn losses).
- [ ] **Task 6** — Critical moments: rank moves by abs(eval delta), surface top 5.

## Phase 7 — Tactical motif detection

- [ ] **Task 1** — Hanging piece detector.
- [ ] **Task 2** — Fork detector (one piece attacking 2+ enemy pieces of equal/greater value).
- [ ] **Task 3** — Pin detector (absolute + relative).
- [ ] **Task 4** — Skewer detector.
- [ ] **Task 5** — Discovered-attack and discovered-check detector.
- [ ] **Task 6** — Double-attack detector.
- [ ] **Task 7** — Back-rank weakness detector.
- [ ] **Task 8** — Removing-the-defender + overloaded-piece detector.

## Phase 8 — Positional analysis

- [ ] **Task 1** — Pawn structure (doubled, isolated, backward, passed).
- [ ] **Task 2** — King safety (open files near king, missing pawn shield, exposure score).
- [ ] **Task 3** — Piece activity (knight outposts, bishop diagonals, rook on open/semi-open files).
- [ ] **Task 4** — Material imbalance summary.
- [ ] **Task 5** — Game-phase detection (opening / middlegame / endgame).

## Phase 9 — Opening database

- [ ] **Task 1** — Bundle Lichess ECO data (TSV → JSON in `src/data/eco.json`).
- [ ] **Task 2** — `identifyOpening(moves)` walks the move list against the ECO trie.
- [ ] **Task 3** — Display "B90: Sicilian Defense, Najdorf Variation" in the review header.

## Phase 10 — Explanation template system

- [ ] **Task 1** — Define template DSL (variable substitution syntax, conditionals).
- [ ] **Task 2** — Template loader + cache.
- [ ] **Task 3** — Template selection logic: match `(classification, motifs[], game phase)` to candidate templates.
- [ ] **Task 4** — Random-pick from candidates for variety.
- [ ] **Task 5** — Write 100+ templates organized by classification + motif.
- [ ] **Task 6** — Tests: every template renders without errors over a sample of real positions.

## Phase 11 — Review UI

- [ ] **Task 1** — `src/ui/Review.tsx`: move-by-move walkthrough using the existing board.
- [ ] **Task 2** — Annotation icons inline in move list (!, ??, etc.).
- [ ] **Task 3** — Explanation panel that updates per move.
- [ ] **Task 4** — Suggested-better-move arrow overlay on the board.
- [ ] **Task 5** — End-of-game summary (accuracy, blunders, mistakes count, opening).
- [ ] **Task 6** — Critical-moments quick-jump list.
- [ ] **Task 7** — Multi-PV alternatives panel for flagged moves.

## Phase 12 — Polish + distribution

- [ ] **Task 1** — Settings panel (analysis depth, theme, engine path override).
- [ ] **Task 2** — SQLite persistence layer + saved-games list.
- [ ] **Task 3** — Export annotated PGN.
- [ ] **Task 4** — `electron-builder` config for Windows / macOS / Linux installers.
- [ ] **Task 5** — Error handling pass: friendly messages for missing Stockfish, malformed PGN, etc.
- [ ] **Task 6** — Performance pass: profile the analysis loop, parallelize where it helps.

## Phase 13 — Documentation

- [ ] **Task 1** — Update README with screenshots / GIFs of the finished app.
- [ ] **Task 2** — User guide (`docs/USER_GUIDE.md`).
- [ ] **Task 3** — Contributor guide (`docs/CONTRIBUTING.md`) — how to add templates, motif detectors, translations.
- [ ] **Task 4** — Cut a v0.1 release on GitHub with installers attached.
