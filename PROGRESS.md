# PROGRESS

> Live build status. Updated after every commit. The most current row in the table below is always at the top.

## Current session

**Phase 11 / Tasks 3-6 complete.** 529 tests pass (+3 review tests); lint + typecheck + build clean.

This session landed two task pairs:

- **Tasks 3-4** (commit `feat: review polish — classification badge, motif chips, engine arrow`): explanation-panel polish (classification badge, motif chips, pawn-relative cp loss copy) and the suggested-move arrow overlay. `Board.tsx` gained an `arrows` prop forwarded to react-chessboard's `customArrows` (tuples are copied per render because the library filters in place); `Review.tsx` derives a blue arrow from `currentMove.bestUci` whenever the engine's preferred move differs from what was played.
- **Tasks 5-6** (commit `feat: review summary panel + critical-moments quick-jump`): `GameReview` now carries a `summary` block — per-side Lichess accuracy via `gameAccuracy`, a `Classification`-keyed counts map per side via the new `countClassifications` helper (attributing by FEN STM so non-standard starts work), and the top 5 critical moments via `criticalMoments`. New `emptyReview()` constructor lets the UI surface a typed zero-state without re-running the pipeline. `Review.tsx` renders a `SummaryPanel` (W/B accuracy + a count table that hides zero-only rows) and a `CriticalMomentsList` (clickable rows that jump `viewPly`, color-coded by swing direction with the current row highlighted).

Manual UI verification: Vite + Electron boot clean, no console errors at startup. Interactive verification (badge legibility, arrow contrast on light theme, summary table layout, criticals click-through) still pending — sequential dev sessions can drive the live window.

**Last updated:** 2026-04-27

## Next up

- **Phase 11 / Task 7** — Multi-PV alternatives panel for flagged moves. Phase 6 / Task 4 already runs a multi-PV second pass for blunders/mistakes/misses; the move records carry the alternatives. Wire them into the Review side panel as a small "alternatives" section under the explanation when the current move is flagged.
- **Phase 11 / Task 8** — Right-click square highlights + arrows (Lichess-style). Persistent across navigation, cleared on left-click. Both Review and play views. Will need a shared `BoardAnnotations` state and right-click handlers on `Board.tsx`.

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
|     5 | Game import (PGN file/paste/manual)                |     ✅     |
|     6 | Analysis pipeline (per-move eval + classification) |     ✅     |
|     7 | Tactical motif detection                           |     ✅     |
|     8 | Positional analysis                                |     ✅     |
|     9 | Opening database (ECO)                             |     ✅     |
|    10 | Explanation template system (100+ templates)       |     ✅     |
|    11 | Review UI                                          | 🟡 in prog |
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
- [x] **Task 2** — PGN paste textarea with parse-on-paste preview.
- [x] **Task 3** — Manual move-entry mode (board accepts moves, no engine).
- [x] **Task 4** — Multi-game PGN: list selector for which game to load.

## Phase 6 — Analysis pipeline

- [x] **Task 1** — `src/chess/analysis.ts`: orchestrate per-move eval over a `Game.history()`.
- [x] **Task 2** — Centipawn-loss thresholds → classification (Brilliant, Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Miss, Book).
- [x] **Task 3** — Mate-in-X handling (eval comparison breaks down at mate scores; treat separately).
- [x] **Task 4** — Multi-PV second pass for flagged moves (top 3 alternatives).
- [x] **Task 5** — Accuracy score (Lichess-style harmonic-mean formula over centipawn losses).
- [x] **Task 6** — Critical moments: rank moves by abs(eval delta), surface top 5.

## Phase 7 — Tactical motif detection

- [x] **Task 1** — Hanging piece detector.
- [x] **Task 2** — Fork detector (one piece attacking 2+ enemy pieces of equal/greater value).
- [x] **Task 3** — Pin detector (absolute + relative).
- [x] **Task 4** — Skewer detector.
- [x] **Task 5** — Discovered-attack and discovered-check detector.
- [x] **Task 6** — Double-attack detector.
- [x] **Task 7** — Back-rank weakness detector.
- [x] **Task 8** — Removing-the-defender + overloaded-piece detector.

## Phase 8 — Positional analysis

- [x] **Task 1** — Pawn structure (doubled, isolated, backward, passed).
- [x] **Task 2** — King safety (open files near king, missing pawn shield, exposure score).
- [x] **Task 3** — Piece activity (knight outposts, bishop diagonals, rook on open/semi-open files).
- [x] **Task 4** — Material imbalance summary.
- [x] **Task 5** — Game-phase detection (opening / middlegame / endgame).

## Phase 9 — Opening database

- [x] **Task 1** — Bundle Lichess ECO data (TSV → JSON in `src/data/eco.json`).
- [x] **Task 2** — `identifyOpening(moves)` walks the move list against the ECO trie.
- [x] **Task 3** — Display "B90: Sicilian Defense, Najdorf Variation" in the review header.

## Phase 10 — Explanation template system

- [x] **Task 1** — Define template DSL (variable substitution syntax, conditionals).
- [x] **Task 2** — Template loader + cache.
- [x] **Task 3** — Template selection logic: match `(classification, motifs[], game phase)` to candidate templates.
- [x] **Task 4** — Random-pick from candidates for variety.
- [x] **Task 5** — Write 100+ templates organized by classification + motif.
- [x] **Task 6** — Tests: every template renders without errors over a sample of real positions.

## Phase 11 — Review UI

- [x] **Task 1** — `src/ui/Review.tsx`: move-by-move walkthrough using the existing board.
- [x] **Task 2** — Annotation icons inline in move list (!, ??, etc.).
- [x] **Task 3** — Explanation panel that updates per move.
- [x] **Task 4** — Suggested-better-move arrow overlay on the board.
- [x] **Task 5** — End-of-game summary (accuracy, blunders, mistakes count, opening).
- [x] **Task 6** — Critical-moments quick-jump list.
- [ ] **Task 7** — Multi-PV alternatives panel for flagged moves.
- [ ] **Task 8** — Right-click square highlights + arrows (Lichess-style: persistent across nav, cleared on left-click). Both review and play views.
- [ ] **Task 9** — On-piece grade badges during review: Chess.com-style overlay icons (green check on best, blue spark on brilliant, orange `?!` on inaccuracy, red `??` on blunder, etc.) rendered over the destination square so the grade is readable from the board itself, not just the side panel.

## Phase 12 — Polish + distribution

- [ ] **Task 1** — Settings panel (analysis depth, theme, engine path override, live-eval toggle, board/piece themes).
- [ ] **Task 2** — SQLite persistence layer + saved-games list.
- [ ] **Task 3** — Export annotated PGN.
- [ ] **Task 4** — `electron-builder` config for Windows / macOS / Linux installers.
- [ ] **Task 5** — Error handling pass: friendly messages for missing Stockfish, malformed PGN, etc.
- [ ] **Task 6** — Performance pass: profile the analysis loop, parallelize where it helps.
- [ ] **Task 7** — Live eval bar during play. Subscribes to engine.analyze on every position change, gated behind the settings toggle from Task 1 so non-coaching purists can keep play "blind".
- [ ] **Task 8** — Board / piece theme picker. Bundle 3-4 board palettes (classic brown, blue, green, gray) and 2-3 piece sets (Cburnett, Merida, Alpha) selectable from the settings panel.
- [ ] **Task 9** — Knight-style L-shaped arrows (custom SVG overlay; Lichess-style) for the suggested-move and right-click arrows. Replaces the straight-line arrows shipped in Phase 11 / Task 4.

## Phase 13 — Documentation

- [ ] **Task 1** — Update README with screenshots / GIFs of the finished app.
- [ ] **Task 2** — User guide (`docs/USER_GUIDE.md`).
- [ ] **Task 3** — Contributor guide (`docs/CONTRIBUTING.md`) — how to add templates, motif detectors, translations.
- [ ] **Task 4** — Cut a v0.1 release on GitHub with installers attached.

---

## Backlog (post-v0.1 ideas)

Not committed for v0.1. Recorded so we don't lose them, and so future sessions don't have to re-decide. Promote to a phase once there's signal that v0.1 needs them.

- **Live coach mode** — eval bar, classification, motif callouts, and rendered explanations live during play (the same pipeline the Review screen runs, applied per-move while a game is in progress). Adds a "second product" to the app, so deferred until v0.1 ships and we know whether users actually want it. Risk worth flagging: live coaching during play can become a crutch — the post-game review loop is more honest about how training works.
- **Threat arrows** — show what the opponent threatens if you pass. Static analysis pass over the position. Naturally pairs with live coach mode.
- **Hint mode during play** — explicit "show me a good move + why" affordance. Pairs with coach mode.
- **PGN-only headless review** — `hindsight review game.pgn -o annotated.pgn` CLI for batch processing. The orchestration in `src/chess/review.ts` is already React-free; just needs a node entry point.
- **Translations of the explanation library** — DSL-friendly format means localising means swapping the source strings, not the engine.
- **Engine-strength ladder for review** — let the user pick depth-12 / depth-18 / depth-25 per review (Phase 12 Task 1 lands the global setting; per-review override is a stretch).
