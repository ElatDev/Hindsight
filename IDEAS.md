# Ideas

Things noticed while preparing v0.1.0 that were out of scope for a release
that allowed only crash, build and broken-screenshot fixes. Nothing here is
scheduled. Each item says where the evidence is.

## Review quality

- **Raise the default analysis depth.** The default is 10. At that depth
  Stockfish grades Morphy's 15.Bxd7+ in the Opera Game (1858) as a blunder,
  because it can't yet see 16.Qb8+ and mate. At 14 it grades Byrne's 11.Bg5 in
  the Game of the Century (1956) as Good. At 16 to 18 both come out right. A
  16-ply default would cost a few seconds per review (an 82-ply game took about
  7.5s at depth 16 on a Ryzen 7 7800X3D). `src/ui/useSettings.ts`.
- **Assign the Sharp and Book grades.** Both are defined, with 15 templates
  between them, but the classifier never produces them.
  `src/chess/classify.ts`.
- **Wire up the discovered-attack detector.** `src/chess/motifs/discovered.ts`
  exists and has tests, but `detectMoveMotifs` doesn't call it. Removing the
  defender has two templates and a UI label but no detector.
- **Fix game-phase detection in reviews.** `runGameReview` rebuilds each position
  with `Game.fromFen`, which has no move history, so `detectGamePhase`'s
  "fewer than 16 plies" rule is always true. Any position with most pieces
  still on the board is treated as the opening when templates are picked.
  `src/chess/review.ts`, `src/chess/positional/gamePhase.ts`.
- **Fill the two template variables that are always empty.** `threatSan` and
  `attackedSquare` are always null, so templates that use them render with a
  blank. `src/chess/review.ts` (`buildRenderContext`).
- **Name the square in pin explanations.** The 11.Bg5 explanation says "the
  pawn is now pinned" without saying which pawn.
- **Make reviews repeatable.** The same game at the same depth gives slightly
  different accuracies from run to run (89.1/97.1, 88.8/95.6, 90.1/96.4 in
  three runs). The engine pool's processes keep their hash tables between
  positions, so results depend on scheduling. Clearing the hash (`ucinewgame`)
  per position would fix it at some speed cost. `electron/engine/pool.ts`.
- **Say "allows mate" instead of a pawn count.** When a move walks into a
  forced mate, the panel reads "gives up" roughly 1,000 pawns, because a mate
  counts as 100,000 centipawns in the loss math. `src/chess/classify.ts`
  (`evalAsCp`), `src/ui/Review.tsx`.
- **Show the result at the final position.** After a checkmate the eval bar
  sits at 50/50 and the panel shows `?` for the mating move's eval. Scoring is
  right (it uses the result), but the display has no "1-0" or "mate" state.
  `src/chess/review.ts` (`snapshotsFromAnalysis`), `src/ui/EvalBar.tsx`.

## Review features

- **Cache analysis.** Saved games store only the PGN, so opening one re-runs
  Stockfish. A cache keyed by PGN hash and depth would make it instant.
- **Show results while analysis runs**, instead of only when the whole review
  is done.
- **Make alternatives clickable** to preview each line on the board.
- **Use a faster Stockfish build.** The fetch scripts get the plain x86-64
  build, which runs on any x64 CPU. The AVX2 and BMI2 builds are much faster on
  modern CPUs. The app could pick one at install time or at startup.
  `scripts/fetch-stockfish.*`.

## Layout

- **Use the empty space under the board.** In review mode the summary and
  critical moments sit below the fold at the default 1280x800 window while the
  area under the board is empty.
- **Collapse secondary header buttons.** Below about 1210px in play mode the
  nine header buttons wrap to a second row. A menu for the less-used ones would
  keep one row.
- **Show more of saved-game names.** Names and player lists now truncate cleanly
  in the saved-games dialog, but long ones are cut short.

## Distribution

- **App icon.** The exe, installer, taskbar, Dock and window all use Electron's
  default icon. There is no `build/icon.*`, and `build/` is gitignored even
  though it's `buildResources`.
- **Code signing and notarization.** Windows shows SmartScreen and macOS shows
  its unverified-developer prompt (ADR-005, ADR-007). This needs a Windows
  code-signing certificate and a paid Apple Developer ID.
- **Upgrade Electron.** Electron 32 is end-of-life. `npm audit` reports 32
  advisories. The two critical ones (`vitest`, and `tar` via electron-builder)
  are build-time only, but Electron ships in the app. Upgrading means major
  bumps of Electron, electron-builder, Vite and Vitest.
- **Decide on the non-commercial piece sets.** `alpha` and `leipzig` are listed
  as non-free by Lichess, and five sets are CC BY-NC-SA 4.0 (ADR-006).
  Dropping them would let the whole app be used commercially.
- **Show licenses in the app.** An About screen could display
  `THIRD_PARTY_NOTICES.md`, which today only sits in the resources folder.
- **Linux arm64.** There's no arm64 Linux Stockfish download in the fetch
  script and no arm64 AppImage target.

## Tooling

- **Keep the screenshot script in the repo.** The README screenshots were made
  by driving the packaged app with Playwright. Checked in as
  `npm run screenshots`, it would make them easy to refresh.
- **End-to-end smoke test in CI.** Launch the packaged app, paste a PGN and
  finish a review. This was done by hand for v0.1.0 on Windows and on an
  Apple Silicon Mac.
- **Line endings.** `npm run format:check` fails on every file in a Windows
  checkout with `core.autocrlf=true`, because Prettier wants LF.
  `* text=auto eol=lf` in `.gitattributes` would fix it for good.
