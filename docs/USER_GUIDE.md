# Hindsight User Guide

> A walkthrough of the app, end-to-end. If you just want to install Hindsight and try it, the [Quickstart in README.md](../README.md#quickstart) is faster.

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
- **Reviews are reproducible.** Run the same game at the same depth and you will get the same evaluations. The only randomness is which template variant is picked when several apply.
- **Reviews are bounded by Stockfish.** Hindsight is as strong as the Stockfish build it ships with at the depth you choose. Higher depth = more accurate but slower.

---

## First run

The first time the dev workflow runs `npm install`, the `postinstall` script downloads a Stockfish binary into `stockfish/bin/<platform>-<arch>/` (it is gitignored — never committed). When you launch a packaged installer, the Stockfish binary is bundled with the app, so there is no first-run download.

If Stockfish cannot be found at startup, Hindsight surfaces an "engine missing" dialog with a retry button rather than crashing. See [Troubleshooting](#troubleshooting) below for what to do.

When the app first opens you land on an empty board in **Free** mode — a sandbox where any legal move is allowed for either side. From there you can:

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

You enter Review mode either at the end of a game (the end-of-game banner asks "Review this game?") or after importing a PGN.

---

## The board view

The main view has four regions:

- **Board** — drag-and-drop with legal-move enforcement; illegal drops snap back. Selecting a piece highlights its legal destinations.
- **Eval bar** — a vertical strip on the side of the board showing the current evaluation. During play it updates only if the live-eval setting is enabled (off by default — see [Settings](#settings)). During review it always reflects the current move.
- **Move list** — algebraic notation, click any move to jump there. Move-list annotations (e.g. `??` for a blunder, `!` for excellent) appear inline once a review is loaded.
- **Navigation controls** — first / previous / next / last / flip-board / theme-toggle.

### Right-click highlights and arrows

Right-click a square once to highlight it. Right-click and drag from one square to another to draw an arrow. Right-clicking the same square again clears that highlight; right-click the destination of an arrow to clear that arrow. Highlights and arrows persist as you navigate the move list (they're attached to the position, not the move) and are cleared by left-clicking the board. This is the same Lichess-style convention you may already know.

### Suggested-move arrows (review only)

When the engine flagged a move as Inaccuracy, Mistake, Blunder, or Miss, an L-shaped knight-style arrow shows the move the engine preferred — drawn as it would be played, not in a straight line. Click an alternative in the side panel to switch the arrow to that line.

### Grade badges (review only)

Each move that has been classified shows a small badge on the destination square: a green check on Best, a blue spark on Sharp, an orange `?!` on Inaccuracies, a red `??` on Blunders, and so on. The badge mirrors the move-list annotation so you can read the grade from the board itself, without flipping back to the side panel.

---

## Playing against Stockfish

Click "New game vs engine" from the menu. The dialog asks for:

- **Your colour** (White, Black, or random)
- **Engine strength** — either a UCI Elo or a skill level. Lower numbers play weaker; higher numbers approach Stockfish's full strength at the analysis depth.

Once the game starts, drag pieces to play. The engine responds when it's its turn. A spinner indicates "engine thinking"; legal moves are blocked for you until the engine has replied. If the engine fails to respond (rare, usually a Stockfish process death), Hindsight shows a friendly retry dialog rather than freezing.

Game-end conditions (checkmate, stalemate, threefold repetition, fifty-move rule, insufficient material) are detected automatically. A banner offers two actions:

- **Review this game** — runs the review pipeline on the moves you just played and switches into Review mode.
- **Dismiss** — keeps the position on the board for inspection.

### Live eval bar (optional)

If you turn on **Live evaluation during play** in Settings, the eval bar updates each time the position changes — useful as a coach, distracting if you want to play "blind". The toggle ships off by default.

---

## Importing a game

Three ways to bring a game in.

### From a PGN file

Use the file-picker entry point. Hindsight opens a native dialog (so it respects your OS file conventions). Multi-game PGNs are supported — if the file contains more than one game, you get a list to pick from with each game's headers (event, white/black, date, result) shown for context.

### Pasting PGN text

Use the "Paste PGN" entry. The textarea parses on input and shows a preview. If the PGN is invalid, you get a clear error message with the offending region called out — fix the input, paste again. As with file import, a multi-game paste opens the game-selector list.

PGN comments, NAGs, and (currently) variations are all parsed. Variations are read but not surfaced in the UI for v1.

### Manual move entry

Just play the moves on the board in Free mode. There's no engine in the loop, so you can blitz through a game from a notation diagram without waiting for replies. When you're done, ask for a review — Hindsight reviews whatever sequence of legal moves you played.

---

## Reviewing a game

Review mode is the headline feature. Once a review starts, Hindsight runs every position through Stockfish at the configured depth, classifies each move, runs motif detectors on flagged moves, identifies the opening, picks an explanation template per move, and stitches the result into a walkthrough.

Depending on game length and the analysis depth you chose, this takes seconds to a few minutes. A progress indicator runs while the pipeline is working — feel free to navigate the partially-reviewed move list while it finishes.

### Per-move panel

For each move you'll see:

- **Classification** — the bucket the move falls into (Sharp, Best, Excellent, Good, Inaccuracy, Mistake, Blunder, Miss, Book), with a glyph and a label.
- **Centipawn loss** for non-mate cases, in pawn-equivalent units. Mate-in-N positions skip the cp loss field and show the mate distance instead.
- **Explanation** — one or two sentences describing what was good or what went wrong, drawn from the template library and grounded in the actual squares / pieces / motifs detected in your game.
- **Detected motifs**, if any — fork, pin, skewer, discovered attack, discovered check, double attack, hanging piece, back-rank weakness, overloaded piece, or removing the defender.
- **Suggested move** for flagged moves — the engine's preferred continuation, drawn as a knight-style arrow on the board and listed in the panel.

### Multi-PV alternatives

For Inaccuracy-or-worse moves the panel includes the engine's top-3 lines. Click any line to overlay it on the board; click the played move to return. This is where you actually learn — seeing two or three alternatives side by side is more honest than "you should have played X".

### Critical moments

A side panel lists the 5 biggest evaluation swings of the game ranked by absolute eval delta — the moments where the result was decided. Click any entry to jump straight to that ply. This is the fastest path through a long game when you only have ten minutes to study.

### End-of-game summary

At the end of the move list, a summary card shows:

- **Accuracy** for each colour, computed by the Lichess-style harmonic-mean formula over centipawn losses.
- **Counts** of blunders, mistakes, and inaccuracies for each colour.
- **The opening** identified by ECO code (e.g. `B90: Sicilian Defense, Najdorf Variation`).

---

## Settings

Open Settings from the menu. Your choices persist locally between sessions.

| Setting                     | What it controls                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------- |
| Analysis depth              | Stockfish search depth used by the review pipeline. Higher = slower, more accurate. |
| Theme                       | App-level light or dark theme.                                                      |
| Live evaluation during play | Whether the eval bar updates while you're playing a game (off by default).          |
| Board theme                 | Board palette: classic brown, blue, green, or gray.                                 |
| Piece set                   | Choice persisted; bundled piece sets ship in a follow-up release.                   |

Use **Restore defaults** to reset every setting (your saved games and reviews are not touched).

---

## Exporting your annotated PGN

After a review completes you can export the game with annotations as a PGN file. The export embeds:

- Standard PGN headers (event, site, white, black, date, result, etc. — preserved from the source if imported).
- Move-by-move NAGs for the classifications (`!!`, `!`, `?!`, `?`, `??`, ...).
- Comments containing the explanation text and detected motifs.

The result is plain PGN — readable in any chess software (ChessBase, Scid, Lichess Studies, even plain text). Use this to share your review without sharing Hindsight itself.

---

## Privacy and offline behaviour

Hindsight is offline by design. Specifically:

- **No network calls at runtime.** The only network touch is the one-time `postinstall` script that downloads Stockfish from the official source. Packaged installers bundle Stockfish directly, so an installed app makes no network calls at all.
- **No telemetry, no analytics, no error reporting service.** If something crashes, nothing is sent anywhere. Use the GitHub issues if you want us to know.
- **No accounts, no cloud sync.** Saved reviews live in a local SQLite database. If you want to sync between machines, sync the database file with whatever tool you already use (Syncthing, Dropbox, etc.).
- **Imported PGNs stay local.** Hindsight does not phone home with game contents. The review pipeline runs entirely against the local Stockfish process.

---

## Troubleshooting

### "Stockfish is missing" on startup

The fetcher script that runs after `npm install` downloads the OS-appropriate Stockfish binary into `stockfish/bin/<platform>-<arch>/`. If that step failed (no internet at install time, an antivirus quarantining the executable, a disk-full error), the dialog will offer a retry. You can also re-run the fetch manually:

```
npm run fetch-stockfish
```

If retry still fails, file an issue with the fetcher's stderr — the error message names the URL and the destination path, which usually points at the culprit.

### Hindsight launches into a black window or crashes immediately (Windows, dev workflow)

If you set `ELECTRON_RUN_AS_NODE=1` somewhere in your environment (a few global Node setups do this), Electron starts in plain-Node mode and `require('electron')` returns undefined, which crashes the main process. Unset the variable before launching dev:

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

The error message names the offending token and approximate position. Most often this is non-standard punctuation in a comment or an unusual NAG that wasn't escaped properly. Trim the file to a single game, fix the offending region, and re-import. If a PGN looks correct to you and Hindsight rejects it, file an issue with the PGN attached — the parser is conservative and we'd rather make it more permissive.

### Where do my saved reviews go?

Reviews persist in a local SQLite database under your user-data directory (the OS-managed app-data folder for Electron apps). The location is logged at startup in the dev console. To wipe everything, delete that folder; Hindsight will recreate it on the next launch.
