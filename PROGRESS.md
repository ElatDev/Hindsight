# PROGRESS

> Live build status. Updated after every commit. The most current row in the table below is always at the top.

## Current session

**Phases 1-4 complete; Phase 5 / Task 1 done.** 34 tests pass.

- Phase 1: Stockfish fetcher + UCI handshake + analyzePosition + Vitest engine tests (8) + IPC surface.
- Phase 2: `chess.js@^1.4.0` wrapper with full typed surface, `GameEnd` const + union, 26 tests.
- Phase 3:
  - Task 1: `react-chessboard@^4.7.3` board (pinned to 4.x — 5.x needs React 19).
  - Task 2: drag-drop with `Game.move({from, to, promotion})` + version-counter re-renders.
  - Task 3: click-to-select with legal-target dots / red capture rings.
  - Task 4: MoveList button-pair grid; click any ply to jump.
  - Task 5: NavControls (First/Prev/Next/Last/Flip) + Left/Right/Home/End shortcuts; reviewing past disables drag-drop.
  - Task 6: EvalBar with sigmoid(evalCp / 410) → white-share, mate clamps to 99/1. Currently fed evalCp=0 placeholder; Phase 6 will wire `analyzePosition` output.
  - Task 7: useTheme hook (localStorage + prefers-color-scheme fallback) writes `<html data-theme>`; index.css fully driven by CSS variables.
- Phase 4 / Task 1: `src/ui/NewGameDialog.tsx` modal — mode (vs-engine / free play), color (white / black / random), Elo slider 1320..3190. Random color resolves on confirm. `App.tsx` now carries `{ game, mode, playerColor, elo }` and re-orients the board to the player's color on vs-engine start.
- Phase 4 / Task 2: When `mode='vs-engine'` and it's the engine's turn, an effect calls `window.hindsight.engine.bestMove({ fen, depth: 12, elo })`; the main process applies `UCI_LimitStrength=true` + `UCI_Elo=<elo>` before the search and returns the bestMove UCI string. The renderer parses `e2e4` / `e7e8q` and applies via `Game.move({from, to, promotion})`. `requestId` ref discards stale results.
- Phase 4 / Task 3: `src/ui/GameEndBanner.tsx` shows on game end with result headline + reason (checkmate / stalemate / threefold / fifty-move / insufficient material / draw). Actions: Review (placeholder — jumps to ply 0 today, will seed Phase 6 analysis later), New game, Dismiss. Winner derived from the side NOT to move on a mate FEN.
- Phase 5 / Task 1: `pgn:openFile` IPC channel — main process spawns `dialog.showOpenDialog` with a PGN filter, reads the file via `fs/promises.readFile`, returns `{ path, pgn } | null`. "Open PGN" header button calls it and loads the file into a fresh Game in free-play mode at the final ply.

Notes:

- PowerShell scripts must be ASCII-safe.
- IPC round-trip still wants a manual DevTools smoke. Now BOTH `engine.bestMove` and `pgn.openFile` are wired but unverified; "New game → Black → Start" exercises the engine path, "Open PGN" exercises the file path.
- Renderer bundle ~280kB. Main bundle 10.44kB.

**Last updated:** 2026-04-27

## Next up

- **Phase 5 / Task 2** — PGN paste textarea with parse-on-paste preview. A small modal/inline panel where the user pastes PGN text; the panel shows the parsed move count + result header before "Load" applies it to a fresh Game. Build on the existing `Game.fromPgn` + `headers()` surface.
- **Phase 5 / Task 3** — Manual move-entry mode (board accepts moves, no engine). Already mostly true: free play mode with mode='free' is exactly this. Task probably resolves to confirming the UX is acceptable + perhaps a "Manual entry" preset in the new-game dialog (vs vs-engine vs free vs manual = all the same minus the engine-thinking path).

## Blockers

_None._

---

## Phase status

| Phase | Scope                                              |   Status   |
| ----: | -------------------------------------------------- | :--------: |
|     0 | Repo + scaffold                                    |     ✅     |
|     1 | Stockfish UCI integration                          |     ✅     |
|     2 | Chess logic layer (`chess.js`, PGN, FEN)           |     ✅     |
|     3 | Board GUI                                          |     ✅     |
|     4 | Play vs Stockfish                                  |     ✅     |
|     5 | Game import (PGN file/paste/manual)                | 🟡 in prog |
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
- [x] **Task 2** — Drag-and-drop with legal-move enforcement (only allow legal moves; snap back on illegal).
- [x] **Task 3** — Legal-move highlighting on piece selection.
- [x] **Task 4** — Move list (`src/ui/MoveList.tsx`) in algebraic notation, click to navigate.
- [x] **Task 5** — Navigation controls (first / prev / next / last / flip board).
- [x] **Task 6** — Eval bar (placeholder data until Phase 6 wires it to engine output).
- [x] **Task 7** — Light/dark theme toggle.

## Phase 4 — Play vs Stockfish

- [x] **Task 1** — "New game vs engine" flow with Elo / skill-level chooser.
- [x] **Task 2** — Engine plays its move on its turn (renderer requests `engine.bestMove` via IPC).
- [x] **Task 3** — Game-end detection triggers "review this game?" prompt.

## Phase 5 — Game import

- [x] **Task 1** — PGN file picker (Electron native dialog).
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
