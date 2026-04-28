# PROGRESS

> Live build status. Updated after every commit. The most current row in the table below is always at the top.

## Current session

**User-feedback round 2.** The user kept testing and turned up more gaps. This round delivers the actual fixes: real arrows in every direction, real piece-set selection, defensive promotion, scrollable settings.

Arrows now support every direction the user can draw:

- Right-click drag detection moved into our own DOM-level handler on the board wrapper (`mousedown` records the source square via the library's `data-square` attribute; document-level `mouseup` resolves single-square = toggle highlight, drag = toggle arrow). `areArrowsAllowed={false}` keeps react-chessboard's straight-line drawing out of the way. The user's arrows feed our existing SVG overlay, so knight jumps come out L-shaped and everything else (sideways, diagonal, straight) is a single line. The default OS context menu is preventDefault'd so right-clicking on the board doesn't pop the menu.

Piece sets ship for real:

- New `scripts/fetch-pieces.mjs` downloads Cburnett, Merida, and Alpha SVGs from Lichess' `lila` repo into `src/data/pieces/<set>/<piece>.svg`. 36 files, ~3 KB each, committed (stable upstream, no point fetching at install time). Per `src/data/pieces/LICENSE`, the artwork is CC-BY-SA 4.0; the rest of the app stays MIT.
- New `src/ui/pieceSets.tsx` glob-imports the SVGs as raw strings via Vite's `?raw` query and exposes `customPiecesFor(theme)`, which builds the render-function map react-chessboard's `customPieces` prop expects.
- `Board` accepts a new `pieceTheme` prop; both the play view (App.tsx) and the review view (Review.tsx) pass `settings.pieceTheme` through.
- The Settings dialog's piece-set picker now shows a real white-king tile preview for each option — exactly the artwork the user gets on the board. The "preview only" hint is gone.

Settings dialog polish:

- **Scrollable**: `.dialog` got `max-height: 90vh; overflow-y: auto` so the now-taller Settings dialog scrolls instead of running off the bottom of the viewport.
- **Board palette preview tiles**: each option renders a 36×36 swatch showing the actual light/dark colour pair instead of plain radio chrome.
- **`autoQueen` defensive defaulting**: every dialog field initialises with `?? DEFAULT_SETTINGS.<key>`, so a stale settings blob that's missing the (recently-added) `autoQueen` field doesn't render the checkbox as a phantom-`undefined` that submits as `undefined` and gets sanitize'd back to `true`. The submit also coerces booleans explicitly. Same defensive coalesce at the call site in App.tsx (`autoQueen={settings.autoQueen !== false}`) so even a rendering tree with stale state doesn't silently auto-queen.

All the changes ship behind HMR'd code paths (no main-process changes); existing dev session picked them up cleanly. Lint + typecheck green; full vitest suite (572 tests) green.

---

## Earlier session — User-feedback round 1

The user actually played with the running app and surfaced real regressions + asks the audit pass missed. This session closes the bugs and lands the small features that were on the asked-for list.

Bugs:

- **Right-click arrows are visible again.** `customArrowColor` was hardcoded to "transparent" to suppress the library's straight-line drawing of engine-suggested arrows (we render those L-shaped via our SVG overlay). But that same colour also wiped out user-drawn right-click drags — the library renders those internally with `customArrowColor`. The XOR-based interceptor over `onArrowsChange` was dead code on react-chessboard ^4.7.3 (the callback only echoes prop-driven arrows on this version, never user gestures). Removed the dead state and let the library paint its own user arrows in green; engine-suggested arrows still get the L-shape from our SVG overlay.
- **Pawn promotion now opens an under-promotion picker** when the new `autoQueen` setting is off. The library's built-in `onPromotionPieceSelect` carries the chosen piece-type back through our `onMove` path so chess.js gets the right `promotion` key. Defaults to auto-queen so existing flows are unchanged.
- **Default analysis depth lowered from 12 → 10** to address "review takes forever". Each step roughly doubles per-move analysis cost on Stockfish; 10 stays well above the noise floor for classification accuracy. Settings hint rewritten to explain the tradeoff. The bigger structural win — running multiple Stockfish processes in parallel — is now flagged on the v0.2 backlog.
- **Piece animation duration is explicit** (`animationDuration={250}` on Chessboard). The library default is 300; the user reported "pieces move instantly" so we made the value visible at the call site for future tuning. If 250 still feels instant, bump it.

Features:

- **More board palettes.** Picker grew from 4 → 9: classic / blue / green / gray (canon) plus walnut, rose, ocean, midnight, mint.
- **Material-advantage strip above + below the board.** New `MaterialAdvantage` component diffs the current piece census against starting material, lists the captured-enemy pieces (queen → rook → bishop → knight → pawn) as Unicode glyphs, and trails the leading side's pawn-equivalent advantage as `+N`. Promotion-correct: a side's surplus queens cancel against the opponent's "missing" pawns so under-promoted pieces don't double-count. Renders in both play and review views, oriented to the side it represents.
- **`autoQueen` toggle in Settings → "Pawn promotion".** Defaults on; turning it off lets the user under-promote.

Lint + typecheck green; full vitest suite (572 tests) green; HMR happily picked up every edit while the dev server was live; no error events fired in the main-process log monitor.

---

## Earlier session — Post-audit bug sweep + Phase 8 surfacing

A code-level audit (boot the dev server, drive every UI / chess module, cross-reference PROGRESS "✅" claims) flagged seven gaps where the checklist had marked things done but the user-facing reality didn't match. The previous session closed them.

Headline fix:

- **Phase 8 positional analysis is no longer dead code.** `analyzePawnStructure`, `analyzeKingSafety`, `analyzePieceActivity`, and `analyzeMaterial` were fully implemented + tested but never invoked from the review pipeline or the UI. New `src/ui/PositionalPanel.tsx` runs all four against the position at the current review ply and renders a compact "Position notes" block (material delta with imbalance breakdown + bishop pair, pawn structure, king-safety exposure, piece activity). Empty rows omitted so quiet positions stay clean. Wired into `src/ui/Review.tsx` below the explanation panel; updates as the user navigates plies.

Bug fixes:

- **Settings "Restore defaults" stops fighting Save/Cancel** — the reset now only repopulates the dialog's local form state; nothing persists until Save. Previously the dialog's `useState` was seeded once on mount and didn't refresh when the parent's settings changed, so Save would overwrite the just-applied defaults and Cancel would orphan them. Drops `onReset` from the dialog API.
- **Saved-games load surfaces its own parse errors** — `onLoad` is now `(pgn) => boolean`; the dialog renders an inline error and stays open on failure. Before, a corrupt saved PGN set `pgnError` _behind_ the still-open dialog, so the user saw a click that did nothing.
- **Right-click annotations stop leaking across games** — new `gameInstanceId` counter bumps on `startNewGame` / `loadSinglePgn` (not on every move). Play-view Board is keyed on it so its internal highlight/arrow state flushes when the user starts a fresh game; navigation within the same game doesn't trigger a remount.
- **`useSettings` stops echoing the seeded state to disk on cold launch** — a `persistReadyRef` gate keeps the mirror effect dormant until the load effect has reconciled. Cold launches no longer fire a redundant `settings:save(DEFAULT_SETTINGS)` IPC.
- **PGN export status is visually distinct success vs. error** — `exportStatus` is now a discriminated union with `role="alert"` on errors, and `.review-export-status--{success,error}` got its missing CSS rules.

Polish:

- Dropped the stale "placeholder data" comment on `EvalBar.tsx` (live-eval-driven since Phase 12 / Task 7).
- Dropped the "live eval ships in a later Phase 12 task" hint in `SettingsDialog.tsx` (the feature shipped).
- Reworded the piece-set hint to make it explicit that the radio is preview-only — selecting Merida or Alpha records the preference but the on-board pieces stay Cburnett until the asset bundle ships.

Lint + typecheck green; full vitest suite (572 tests) green; dev server boots cleanly with no IPC errors. The audit also verified that the analysis pipeline (`runGameReview`, `classify`, `accuracy`, `critical`, `alternatives`, `pgnExport`) is _not_ buggy — every claim there held up.

**Last updated:** 2026-04-27

## Next up

Two Phase 13 deliverables still need user input. Everything inside the app's surface area has been audited against PROGRESS this session; the audit-driven backlog below captures what's still on the list.

- **Phase 13 / Task 1** — Screenshot capture. The README has the **Screenshots** section already; what's missing is the actual captures of the play view, the post-game review (annotations + suggested-move arrow + grade badges + new positional notes panel), the critical-moments / alternatives panel, the saved-games browser, and the settings dialog. Task 1 stays unchecked until those land.
- **Phase 13 / Task 4** — Cut a v0.1 release on GitHub. The build path is verified; remaining steps are: bump `package.json` `version` from `0.0.0` to `0.1.0`, re-run `npm run dist` to produce `Hindsight-0.1.0-windows-x64.exe`, then `gh release create v0.1.0 release/Hindsight-0.1.0-windows-x64.exe ...` with release notes drawn from the recent commit log. macOS DMG + Linux AppImage need their respective hosts or a CI matrix; ship Windows-only for v0.1 unless those are easy to obtain.

User-feedback backlog (asks that didn't fit; sized for separate sessions):

- **Time-based games / clocks.** New game dialog should grow a Time Control section: bullet / blitz / rapid / classical presets + a custom (initial + increment) form. Renderer-side clock that ticks via `requestAnimationFrame`, pauses when the engine is thinking, flips on every move, and resigns the side that flags. Probably wants a small `clock.ts` state machine and a `<Clock>` component above the board (would replace or sit next to the `MaterialAdvantage` strip's slot).
- **Smooth piece animation review.** User reported "pieces move instantly". We're now passing `animationDuration={250}` explicitly; if that still feels too fast or doesn't fire reliably (maybe react-chessboard skips the animation when two FEN updates land in the same frame, e.g. after the engine responds), investigate. The library's source has the animation infra; it might be that an engine-move-immediately-after-user-move pair cancels the first transition.
- **Parallel Stockfish engine pool (v0.2).** `electron/engine/` currently spawns one Stockfish process and serializes every analyse call. A pool of N processes (one per logical core) running independent plies in parallel would give the biggest review-speed win. Existing `engineQueue` in `main.ts` is the natural seam — change it from a single chain into a small worker-pool dispatcher. Wants its own design pass.

Earlier audit-driven backlog (still open, smaller polish):

- **No Esc-key / overlay-click dismiss** on any dialog. Cleanest fix is a shared `useDialogDismiss` hook applied across the set.
- **Engine-error toast doesn't auto-clear** on idle — it does clear on the next engine request, but a transient error shown after the final move of a game stays up forever.
- **Multi-game PGN with unclosed-brace comments mis-splits** in `pgnSplit.ts`.
- **Motif test suite uses weak assertions** (`toBeGreaterThanOrEqual(2)` instead of checking exact squares).

Also worth flagging for v0.2: an analysis-cache table keyed on `(pgn_hash, depth)` so re-opening a saved review is instant — the `electron/storage/` layer is now the natural home for it.

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
|    11 | Review UI                                          |     ✅     |
|    12 | Polish + distribution                              |     ✅     |
|    13 | Documentation + screenshots                        | 🟡 in prog |

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
- [x] **Task 2** — Centipawn-loss thresholds → classification (Sharp, Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Miss, Book).
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
- [x] **Task 7** — Multi-PV alternatives panel for flagged moves.
- [x] **Task 8** — Right-click square highlights + arrows (Lichess-style: persistent across nav, cleared on left-click). Both review and play views.
- [x] **Task 9** — On-piece grade badges during review: overlay icons (green check on best, blue spark on sharp, orange `?!` on inaccuracy, red `??` on blunder, etc.) rendered over the destination square so the grade is readable from the board itself, not just the side panel.

## Phase 12 — Polish + distribution

- [x] **Task 1** — Settings panel (analysis depth, theme, engine path override, live-eval toggle, board/piece themes). Engine path override deferred — needs main-process IPC + restart logic; will be folded back in alongside Task 5's error-handling pass.
- [x] **Task 2** — SQLite persistence layer + saved-games list. better-sqlite3 (native, electron-rebuilt postinstall) hosts a KV settings table + a `saved_games` table with denormalised PGN-header columns; renderer migrated through a localStorage-as-cache + SQLite-as-canonical seam; new "Saved games" dialog covers save/load/delete with Vite externalising the native module so Rollup leaves the `.node` resolution to runtime.
- [x] **Task 3** — Export annotated PGN.
- [x] **Task 4** — `electron-builder` config for Windows / macOS / Linux installers. NSIS / DMG / AppImage targets land in v0.1; code signing + notarization deferred (paid certs + per-OS workflows).
- [x] **Task 5** — Error handling pass: friendly missing-Stockfish dialog + retry on engine failures during review. Engine-path override and PGN-error polish remain deferred — both need their own targeted follow-ups.
- [x] **Task 6** — Performance pass: collapsed the multi-PV second pass into the first-pass `multiPV=3` request, saving one engine call per flagged ply. Engine-pool / parallel analyses still possible as a future v0.2 win.
- [x] **Task 7** — Live eval bar during play. Subscribes to engine.analyze on every position change, gated behind the settings toggle from Task 1 so non-coaching purists can keep play "blind".
- [x] **Task 8** — Board / piece theme picker. Board palettes (classic / blue / green / gray) ship now; piece-set bundling (Cburnett, Merida, Alpha) is the deferred half — wants its own asset-pipeline pass.
- [x] **Task 9** — Knight-style L-shaped arrows (custom SVG overlay; Lichess-style) for the suggested-move and right-click arrows. Replaces the straight-line arrows shipped in Phase 11 / Task 4.

## Phase 13 — Documentation

- [ ] **Task 1** — Update README with screenshots / GIFs of the finished app.
- [x] **Task 2** — User guide (`docs/USER_GUIDE.md`).
- [x] **Task 3** — Contributor guide (`docs/CONTRIBUTING.md`) — how to add templates, motif detectors, translations.
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
