# Hindsight User Guide

> A walkthrough of the app, end-to-end. If you just want to install Hindsight and try it, the [Download section of README.md](../README.md#download) is faster.

This guide assumes Hindsight is already installed and running. It explains every feature you will see in the UI, how to get the most out of the review pipeline, and what to do when something goes wrong.

---

## Table of contents

1. [What Hindsight is — and isn't](#what-hindsight-is--and-isnt)
2. [First run](#first-run)
3. [Modes at a glance](#modes-at-a-glance)
4. [The board view](#the-board-view)
5. [Playing against Stockfish](#playing-against-stockfish)
6. [Importing a game](#importing-a-game)
7. [Reviewing a game](#reviewing-a-game)
8. [Settings](#settings)
9. [Exporting your annotated PGN](#exporting-your-annotated-pgn)
10. [Privacy and offline behaviour](#privacy-and-offline-behaviour)
11. [Troubleshooting](#troubleshooting)

---

## What Hindsight is — and isn't

Hindsight is a desktop app that reviews your chess games the way Chess.com Game Review does, but it runs entirely on your machine. The review pipeline uses Stockfish (bundled), a hand-written explanation library, and a set of tactical / positional detectors. There are no network calls at runtime, no accounts, no telemetry, and no LLM in the loop. Every annotation you read comes from a hand-curated template chosen for the position, with the squares and pieces filled in.

A few things this means in practice:

- **Your games never leave your machine.** Importing a PGN, playing a game, or exporting an annotated PGN all stay local.
- **Reviews are close, not identical.** Run the same game at the same depth and the evaluations will be close, but they can differ slightly from run to run. Up to four Stockfish processes share the work, and each keeps its search cache between positions, so a result depends on which process analyzed which position. Separately, when several explanation templates apply, one is picked at random.
- **Reviews are bounded by Stockfish.** Hindsight is as strong as the Stockfish build it ships with at the depth you choose. Higher depth = more accurate but slower.

---

## First run

The first time the dev workflow runs `npm install`, the `postinstall` script downloads a Stockfish binary into `stockfish/bin/<platform>-<arch>/` (it is gitignored — never committed). When you launch a packaged installer, the Stockfish binary is bundled with the app, so there is no first-run download.

If the Stockfish binary is missing, Hindsight does not crash. When the engine is asked for a move, a "Stockfish not found" dialog shows the path it expected and the command that fetches the binary. The dialog has a single **Dismiss** button. A review shows "Analysis paused — Stockfish binary missing." instead. See [Troubleshooting](#troubleshooting) below for what to do.

When the app first opens you land on the starting position in **Free** mode — a sandbox where any legal move is allowed for either side. From there you can:

- Start a new game vs the engine
- Import a PGN (file or paste)
- Open Settings

---

## Modes at a glance

Hindsight has three operating modes, all of which share the same board.

| Mode      | Who moves the pieces                     | When you'd use it                                        |
| --------- | ---------------------------------------- | -------------------------------------------------------- |
| Free      | You — both colours                       | Setting up positions, exploring lines, manual move entry |
| Vs engine | You play one colour, Stockfish the other | Practicing against a tunable opponent                    |
| Review    | Walking through a finished game          | Post-game analysis with annotations and explanations     |

You enter Review mode with the **Review** button on the end-of-game banner, or with the **Review game** button in the header whenever the board has moves (for example, after importing a PGN).

---

## The board view

The main view has four regions:

- **Board** — drag-and-drop with legal-move enforcement; illegal drops snap back. Selecting a piece highlights its legal destinations (unless legal-move dots are turned off in Settings).
- **Eval bar** — a vertical strip on the side of the board showing the current evaluation. During play it updates only if the live-eval setting is enabled (off by default — see [Settings](#settings)). During review it reflects the current move once the review has finished.
- **Move list** — algebraic notation, click any move to jump there. Move-list annotations (e.g. `??` for a blunder, `?!` for an inaccuracy) appear inline once a review is loaded. Best, Excellent and Good moves get no annotation.
- **Navigation controls** — first / previous / next / last / flip-board / theme-toggle. The Left, Right, Home and End keys do the same from the keyboard, in play and in review.

### Right-click highlights and arrows

Right-click a square once to highlight it. Right-click and drag from one square to another to draw an arrow. Right-clicking the same square again clears that highlight; drawing the same arrow again removes it. Highlights and arrows stay on the board as you navigate the move list and are cleared by left-clicking the board. This is the same Lichess-style convention you may already know.

### Suggested-move arrows (review only)

Whenever the played move wasn't the engine's first choice, a blue arrow shows the move the engine preferred. Knight moves are drawn as an L; other moves as a straight line.

### Grade badges (review only)

The move you are on shows a small badge on its destination square: a green check on Best, an amber `?!` on Inaccuracies, an orange `?` on Mistakes, a red `??` on Blunders, and so on. The badge matches the one in the side panel, so you can read the grade from the board itself. Sharp and Book badges are defined, but the classifier does not assign those grades yet.

---

## Playing against Stockfish

Click **New game** in the header and choose **Play vs engine**. The dialog asks for:

- **Your colour** (White, Black, or random)
- **Engine strength** — a single Elo slider from 1320 to 3190. Lower numbers play weaker. The engine always searches to depth 12, and Stockfish's `UCI_Elo` option limits its strength.

Once the game starts, drag pieces to play. The engine responds when it's its turn. The status line reads "Engine thinking..." and the board does not accept your moves until the engine has replied. If the engine fails to respond (rare, usually a Stockfish process death), the status line shows the error, which clears itself after about 6 seconds.

During a game against the engine, **Hint** shows the engine's preferred move as an arrow, searched at full strength to your analysis depth. **Take back** undoes your last move and the engine's reply. **Resign** asks you to confirm, then ends the game. While playing, F flips the board and Backspace takes back. Esc closes any open dialog.

Game-end conditions (checkmate, stalemate, threefold repetition, fifty-move rule, insufficient material) are detected automatically. A banner states the result, for example "White wins. Checkmate.", and offers three buttons:

- **Review** — runs the review pipeline on the moves you just played and switches into Review mode.
- **New game** — opens the New game dialog.
- **x** — closes the banner and keeps the position on the board for inspection.

### Live eval bar (optional)

If you turn on **Live evaluation during play** in Settings, the eval bar updates each time the position changes — useful as a coach, distracting if you want to play "blind". The toggle ships off by default.

---

## Importing a game

Three ways to bring a game in.

### From a PGN file

Click **Open PGN** in the header. Hindsight opens a native dialog (so it respects your OS file conventions). Multi-game PGNs are supported — if the file contains more than one game, you get a list to pick from. Each row shows the players, event, result and ply count. A game that fails to parse is listed but can't be picked.

### Pasting PGN text

Use the "Paste PGN" entry. The textarea parses on input and shows a live preview. If the PGN is invalid, the preview shows the parser's error message and **Load** stays disabled — fix the input, paste again. As with file import, a multi-game paste opens the game-selector list.

PGN comments, NAGs, and (currently) variations are all parsed. Variations are read but not surfaced in the UI for v1.

### Manual move entry

Just play the moves on the board in Free mode. There's no engine in the loop, so you can blitz through a game from a notation diagram without waiting for replies. When you're done, ask for a review — Hindsight reviews whatever sequence of legal moves you played.

---

## Reviewing a game

Review mode is the headline feature. Once a review starts, Hindsight runs every position through Stockfish at the configured depth, classifies each move, runs motif detectors on every move, identifies the opening, picks an explanation template per move, and stitches the result into a walkthrough.

Depending on game length and the analysis depth you chose, this takes seconds to a few minutes. While the pipeline is working, the side panel shows a progress counter ("Analyzing… N / M plies."). Results appear once the whole review finishes; there is no partial review to browse. If the analysis fails, the panel shows the error and a **Retry analysis** button.

When the review is done and Hindsight recognizes the opening, its name appears at the top of the side panel with its ECO code (e.g. `B90: Sicilian Defense: Najdorf Variation`).

### Per-move panel

For each move you'll see:

- **Classification** — the bucket the move falls into, with a glyph and a label. The grades the review assigns are Best, Excellent, Good, Inaccuracy, Mistake, Blunder and Miss. Best means the engine's first choice or any move that delivers checkmate. A move that ends the game is scored by the result: checkmate counts as a win, and stalemate or any other draw as 0.00. Sharp and Book are defined but not assigned yet.
- **Evaluation** after the move, next to the grade. Mate scores show as `M3` or `M-3`.
- **Centipawn loss**, in pawns, when the engine preferred a different move ("Engine preferred Nf3 — gives up 0.85 pawns.").
- **Explanation** — one or two sentences describing what was good or what went wrong, drawn from the template library and grounded in the actual squares / pieces / motifs detected in your game.
- **Detected motifs**, if any — hanging piece, fork, pin, skewer, back-rank weakness, double attack, or overloaded defender. Discovered attacks, discovered checks and removing the defender are not detected yet.
- **Suggested move** whenever the played move wasn't the engine's first choice — the engine's preferred move, drawn as an arrow on the board and named in the panel.

### Multi-PV alternatives

Every position is analyzed once with three principal variations (MultiPV 3). For Inaccuracy, Mistake, Blunder and Miss moves, the panel lists up to three engine moves with their evaluations, leaving out the move you played. The list is plain text; the entries are not clickable. This is where you actually learn — seeing two or three alternatives side by side is more honest than "you should have played X".

### Critical moments

The side panel lists the 5 moves where the winning chance changed the most, in either direction — the moments where the result was decided. Click any entry to jump straight to that ply. This is the fastest path through a long game when you only have ten minutes to study.

### End-of-game summary

Once the review finishes, a summary card in the side panel shows:

- **Accuracy** for each color. Each move's accuracy comes from how much winning chance it gave up (Lichess's formulas), and a side's score is the harmonic mean of its move accuracies.
- **Counts** of each grade for each color. Grades with no moves are hidden.

---

## Settings

Click **Settings** in the header. Your choices persist locally between sessions.

| Setting                     | What it controls                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Analysis depth              | Stockfish search depth used by the review pipeline (default 10, range 8–22). Higher = slower, more accurate. |
| Theme                       | App-level light or dark theme.                                                                               |
| Live evaluation during play | Whether the eval bar updates while you're playing a game (off by default).                                   |
| Board theme                 | Board palette, one of nine: classic brown, blue, green, gray, walnut, rose, ocean, midnight, or mint.        |
| Piece set                   | One of ten bundled piece sets, with a preview row.                                                           |
| Pawn promotion              | Always promote to a queen (on by default), or pick the piece so you can under-promote.                       |
| Last-move highlight         | Tints the from- and to-squares of the last move (on by default).                                             |
| Legal-move dots             | Dots on the legal destinations of a selected piece (on by default).                                          |
| Board coordinates           | The a–h and 1–8 labels on the board (on by default).                                                         |

Use **Restore defaults** to put every setting back to its default, then **Save** to keep the change (your saved games are not touched).

---

## Exporting your annotated PGN

After a review completes you can export the game with annotations as a PGN file with **Save annotated PGN**. The export embeds:

- Standard PGN headers (event, site, white, black, date, result, etc. — preserved from the source if imported).
- NAGs on flagged moves only: `?!` for an Inaccuracy, `?` for a Mistake or Miss, `??` for a Blunder. Best, Excellent and Good moves get none.
- A comment on each move with the evaluation after it (as `[%eval ...]`) and the explanation text. Detected motifs are not included.

The result is plain PGN — readable in any chess software (ChessBase, Scid, Lichess Studies, even plain text). Use this to share your review without sharing Hindsight itself.

---

## Privacy and offline behaviour

Hindsight is offline by design. Specifically:

- **No network calls at runtime.** The only network touch is the one-time `postinstall` script that downloads Stockfish from the official source. Packaged installers bundle Stockfish directly, so an installed app makes no network calls at all.
- **No telemetry, no analytics, no error reporting service.** If something crashes, nothing is sent anywhere. Use the GitHub issues if you want us to know.
- **No accounts, no cloud sync.** Saved games and settings live in a local SQLite database. If you want to sync between machines, sync the database file with whatever tool you already use (Syncthing, Dropbox, etc.).
- **Imported PGNs stay local.** Hindsight does not phone home with game contents. The review pipeline runs entirely against local Stockfish processes.

---

## Troubleshooting

### "Stockfish not found"

The fetcher script that runs after `npm install` downloads the OS-appropriate Stockfish binary into `stockfish/bin/<platform>-<arch>/`. If that step failed (no internet at install time, an antivirus quarantining the executable, a disk-full error), the dialog shows the path it expected. It has no retry button. Re-run the fetch manually, then restart the app:

```
npm run fetch-stockfish
```

If the fetch still fails, file an issue with the fetcher's output — it prints the download URL, which usually points at the culprit.

### `npm run dev` crashes immediately (Windows, dev workflow)

If you set `ELECTRON_RUN_AS_NODE=1` somewhere in your environment (a few global Node setups do this), Electron starts in plain-Node mode and the main process crashes with `TypeError: Cannot read properties of undefined (reading 'whenReady')`. Unset the variable before launching dev:

```bash
unset ELECTRON_RUN_AS_NODE
npm run dev
```

This is a Windows-machine quirk, not a Hindsight bug. Packaged installers are unaffected.

### A review hangs or evaluations look obviously wrong

Two common causes:

- **Depth too low for the position.** Tactical positions need depth to resolve. If a move looks like a blunder but the engine called it Best, raise analysis depth in Settings and re-run.
- **A leftover Stockfish process from a previous run.** Quit Hindsight, check your task manager for orphaned `stockfish` processes, kill any you find, and relaunch.

### Importing a PGN says "parse error"

The error message comes from the PGN parser and names the move or character it could not read. Most often this is non-standard punctuation in a comment or an unusual NAG that wasn't escaped properly. Trim the file to a single game, fix that spot, and re-import. If a PGN looks correct to you and Hindsight rejects it, file an issue with the PGN attached — the parser is conservative and we'd rather make it more permissive.

### Where do my saved games go?

Saved games persist in a local SQLite database, `hindsight.db`, under your user-data directory (the OS-managed app-data folder for Electron apps). Each entry stores the PGN, a name and a few header fields. Reviews are not saved, so reviewing a saved game runs Stockfish again. To wipe everything, delete that folder; Hindsight will recreate it on the next launch.
