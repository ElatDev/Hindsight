# Contributing to Hindsight

Thanks for considering a contribution. Hindsight is small enough that one person can hold the whole thing in their head, and we'd like to keep it that way — focused on a single product (offline chess game review) and pleasant to extend.

This guide covers:

1. [What we'd love help with](#what-wed-love-help-with)
2. [Getting set up locally](#getting-set-up-locally)
3. [Project layout](#project-layout)
4. [Adding an explanation template](#adding-an-explanation-template)
5. [Adding a tactical motif detector](#adding-a-tactical-motif-detector)
6. [Updating the opening database](#updating-the-opening-database)
7. [Translations](#translations)
8. [Code style and tests](#code-style-and-tests)
9. [Commit conventions](#commit-conventions)
10. [Submitting a pull request](#submitting-a-pull-request)
11. [Reporting bugs](#reporting-bugs)

---

## What we'd love help with

In rough order of "easiest to land cleanly" to "more involved":

- **New explanation templates.** The library has a hundred-plus snippets but every one we add makes the review feel less repetitive. No TypeScript required for the template text itself — the DSL is small and friendly.
- **Bug reports with PGNs attached.** A single weird game that breaks the parser or makes the review say something silly is gold.
- **Additional tactical motif detectors.** New motif → richer explanations. The interface is small and self-contained.
- **Translations of the explanation library.** All user-facing text lives in templates; localising means swapping the template strings, not the engine.
- **Performance improvements** to the review pipeline.

If you have an idea that doesn't fit any of these categories, open an issue first to talk it through — we want to keep Hindsight focused, and a "discuss first" conversation saves you implementation effort if the answer is "this isn't a direction we want to go".

---

## Getting set up locally

You will need:

- **Node 20+** and **npm 10+**
- **git**
- An internet connection on first install (for the Stockfish fetch)

```bash
git clone https://github.com/ElatDev/Hindsight.git
cd Hindsight
npm install
npm run dev
```

`npm install` runs `scripts/fetch-stockfish.mjs` as a `postinstall` step, which downloads the OS-appropriate Stockfish binary into `stockfish/bin/<platform>-<arch>/`. The binary is gitignored — never commit it. If the fetch fails (offline, antivirus, etc.), re-run with `npm run fetch-stockfish`.

### Windows note

If `npm run dev` crashes immediately on Windows with `Cannot find module 'electron'`, unset the `ELECTRON_RUN_AS_NODE` env var first:

```bash
unset ELECTRON_RUN_AS_NODE
npm run dev
```

Some global Node setups set this and it puts Electron into plain-Node mode, breaking the main process. Documented in `DECISIONS.md` for the same reason.

### Useful scripts

| Script                    | What it does                                             |
| ------------------------- | -------------------------------------------------------- |
| `npm run dev`             | Vite + Electron in dev mode with HMR                     |
| `npm run build`           | Type-check and produce a production bundle               |
| `npm run lint`            | ESLint over the whole tree                               |
| `npm run typecheck`       | `tsc -b --noEmit`                                        |
| `npm test`                | Vitest in watch mode                                     |
| `npm run test:run`        | Vitest single-run (CI flavour)                           |
| `npm run format`          | Prettier write across `*.{ts,tsx,json,md,css,html}`      |
| `npm run format:check`    | Prettier check (no write)                                |
| `npm run fetch-stockfish` | Re-run the Stockfish download                            |
| `npm run build-eco`       | Rebuild `src/data/eco.json` from the Lichess ECO TSVs    |
| `npm run dist`            | Production build + electron-builder installers           |
| `npm run dist:dir`        | Production build + unpacked output (faster, for testing) |

A pre-commit hook runs `eslint --fix` and `prettier --write` on staged files via husky + lint-staged. Don't bypass it with `--no-verify`; if it complains, fix the issue.

---

## Project layout

```
electron/
  main.ts                main process: lifecycle, BrowserWindow, IPC
  preload.ts             contextBridge — typed in `shared/ipc.ts`
  engine/                Stockfish UCI wrapper, analyze / bestMove
  storage/               SQLite layer (saved games + analysis cache)

src/
  App.tsx                renderer entry point
  chess/
    game.ts              chess.js wrapper
    pgnSplit.ts          multi-game PGN splitter + previews
    classify.ts          centipawn-loss thresholds + bucketing
    accuracy.ts          Lichess-style accuracy formula
    alternatives.ts      multi-PV second-pass orchestration
    critical.ts          top-N evaluation-swing ranking
    analysis.ts          per-move review orchestration
    review.ts            renderer-side review entry point
    pgnExport.ts         annotated PGN serialiser
    openings.ts          ECO trie + identifyOpening()
    motifs/              tactical-motif detectors (one per file)
    positional/          pawn structure, king safety, piece activity, ...
    templates/
      dsl.ts             template parser + renderer
      registry.ts        in-memory id -> parsed template store
      selector.ts        criteria + specificity-based picking
      library.ts         the 100+ shipped templates

  ui/                    React components (Board, Review, ...)
  data/                  bundled data (eco.json, ...)

shared/                  types used by both processes (IPC contracts)
scripts/
  fetch-stockfish.mjs    OS-aware Stockfish downloader (postinstall)
  build-eco.mjs          ECO TSV -> JSON build step
```

Anything novel — a Node-only API, a third-party library — should appear in `DECISIONS.md` as an ADR with the rationale. Keep ADRs append-only.

---

## Adding an explanation template

This is the easiest contribution and the one that makes Hindsight feel polished. Templates are short hand-written snippets that the review UI surfaces beneath each move.

### The DSL

The template DSL is intentionally tiny. The full grammar is in `src/chess/templates/dsl.ts`; here is what you'll use day-to-day:

```
{name}            required variable; throws if absent from context
{name?fallback}   variable with literal fallback when missing/empty
{?flag}…{/}       conditional block; rendered when `flag` is truthy
{?flag}…{:}…{/}   conditional with else branch
{?!flag}…{/}      negated conditional; rendered when `flag` is falsy
\{ \} \\          escape literal braces / backslashes
```

A few concrete examples drawn from the existing library:

```
{san} is the engine's top choice — clean and principled.
{san}{?isCapture} captures the {captured}{/}. The engine's first choice.
{san} — engine top pick{?isCheck}, with check{/}.
```

Truthiness rules for conditionals: `null`, `undefined`, `false`, `0`, `''`, and empty arrays are falsy; everything else is truthy. We do not coerce strings like `"0"` — pass a real boolean if you mean a flag.

### Available context variables

Templates assume a stable set of variables the orchestration layer supplies at render time:

| Group    | Variables                                                                                                                                                                                                 |
| -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Identity | `mover`, `opponent`, `san`, `piece`, `from`, `to`, `captured`                                                                                                                                             |
| Flags    | `isCapture`, `isCheck`                                                                                                                                                                                    |
| Eval     | `cpLoss`, `evalBefore`, `evalAfter`, `bestSan`, `bestPiece`, `bestTo`                                                                                                                                     |
| Phase    | `phase`                                                                                                                                                                                                   |
| Mate     | `wasMating`, `nowBeingMated`, `mateIn`, `mateInAfter`                                                                                                                                                     |
| Motifs   | `forkTargets`, `pinnedPiece`, `pinTo`, `skeweredPiece`, `skeweredBy`, `hangingPiece`, `hangingSquare`, `attackerPiece`, `defendedPiece`, `defendedSquare`, `backRankPiece`, `threatSan`, `attackedSquare` |
| Opening  | `opening`, `ecoCode`                                                                                                                                                                                      |

Reference any of these by name. If you reference a variable that doesn't exist, the template fails at parse or render time — which is what you want; typos are caught early.

### Picking criteria

Every template has criteria that decide when the selector is allowed to pick it. Tighter criteria win over looser ones — a (motif + classification) template outranks a classification-only one, which outranks a wildcard. Criteria fields:

- `classifications` — list of `Classification` values (`Sharp`, `Best`, `Excellent`, `Good`, `Inaccuracy`, `Mistake`, `Blunder`, `Miss`, `Book`)
- `motifs` — list of motif tags. The selector requires at least one of these to be present at the position.
- `excludeMotifs` — list of motif tags. The selector requires none of these to be present.
- `phases` — list of game phases (`Opening`, `Middlegame`, `Endgame`).

Motif tags are stable strings. The current set:

```
hanging  fork  pin  skewer
discoveredAttack  discoveredCheck
doubleAttack  backRank  overloaded  removingDefender
```

### Where to put it

Add your entry to `TEMPLATES` in `src/chess/templates/library.ts`. Use a dotted-id with a logical prefix: `<bucket>.<context>.<n>`. Examples that already exist: `best.general.1`, `best.with-capture`, `blunder.hangs.queen`. Pick a number suffix one higher than the last `<bucket>.<context>` entry.

```ts
'inaccuracy.opening.1': {
  source: '{san} drifts a bit in the opening. {bestSan} kept things sharper.',
  criteria: { classifications: [Inaccuracy], phases: [Opening] },
},
```

### Test it

Two test layers automatically cover new templates:

- `src/chess/templates/__tests__/library.test.ts` — every template parses and renders without errors over a representative sample of contexts.
- `src/chess/templates/__tests__/selector.test.ts` — exercises selection rules; if your template adds a new combination of criteria, add a small test case demonstrating it gets picked when expected.

Run `npm run test:run` before committing.

---

## Adding a tactical motif detector

A motif detector takes a position and returns the salient tactical features the player faced. Detectors live in `src/chess/motifs/` — one file per motif.

### The shape of a detector

Look at `src/chess/motifs/hanging.ts` for the simplest reference. A detector typically:

1. Receives a `Game` (the chess.js wrapper) and inspects the board / legal moves.
2. Returns a list of typed records describing instances of the motif (e.g. `HangingPiece[]`).
3. Optionally exposes a `findMotifFor(game, color)` convenience filtered to one side.

Keep it deterministic and pure: no shared state, no IO. That keeps tests easy and lets the analysis pipeline run motif detection in any order.

### Wiring a new motif into the pipeline

1. Add the motif name to `MOTIF_TAGS` in `src/chess/templates/selector.ts`. **Do not rename existing tags** — templates encode them in their criteria and renaming breaks every template that referenced the old name.
2. Surface the detected data through whatever the orchestration layer (analysis / review) expects. Look at how an existing motif (e.g. `fork`) plumbs through `src/chess/analysis.ts` to see the pattern.
3. Add render-context variables for the detected data in the relevant orchestration spot, so templates can reference them.

### Test it

Add `src/chess/motifs/__tests__/<name>.test.ts` with at least:

- A "yes, this is the motif" case (a position the detector should flag, plus the expected payload).
- A "no, this isn't the motif" case (a similar-looking position that shouldn't trip the detector).
- An edge case (kings excluded, defended-but-attacker-cheaper, etc.).

The motif detectors are the heart of the review pipeline alongside template selection. Tests here are not optional.

---

## Updating the opening database

Hindsight bundles the Lichess ECO data as `src/data/eco.json`, generated from upstream TSVs by `scripts/build-eco.mjs`.

To pull a fresh ECO snapshot:

1. Update the source TSVs the build script reads (path / source documented at the top of `build-eco.mjs`).
2. Run `npm run build-eco`.
3. Inspect the diff in `src/data/eco.json` — if it's enormous and unrelated to the change you intended, the source likely shifted format; talk to a maintainer before committing.
4. Run `npm run test:run` — the openings tests cover a handful of well-known lines and will catch a corrupt build.

The ECO build is the one place we vendor third-party data. License-wise, Lichess ECO data is permissive (CC0 at time of writing); double-check before bumping the source.

---

## Translations

All user-facing review text lives in templates. To translate the explanation library:

1. Decide on a locale identifier (e.g. `es-ES`, `de-DE`).
2. Copy `src/chess/templates/library.ts` to a per-locale variant, or — better — open an issue and we'll work out a structure that doesn't duplicate the criteria. Translations of UI chrome (button labels, menu items) are out of scope for v0.1 but a natural follow-up.

Keep translated templates pinned to the same template id as the English source so the selector's specificity rules continue to work unchanged.

---

## Code style and tests

- **TypeScript everywhere** in renderer and main. Avoid `any`; if you genuinely need it, leave a `// TODO: type this` note.
- **Tests for tactical detection and template selection** — these are the heart of the product. Other modules can have pragmatic test coverage.
- **No `--no-verify`.** The pre-commit hook is the bar; if it fails, fix the underlying issue.
- **Comments explain _why_.** Names already say _what_. Reserve comments for hidden constraints, subtle invariants, workarounds, or behaviour that would surprise a future reader.

When in doubt about style, run `npm run format` and let Prettier settle it.

---

## Commit conventions

We use **conventional commit** prefixes:

- `feat:` — new user-facing capability
- `fix:` — bug fix
- `refactor:` — internal change with no behaviour change
- `test:` — tests only
- `docs:` — documentation only
- `chore:` — tooling, config, dependency bumps

Title ≤ 70 characters; body explains _what changed_ and, briefly, _why_.

```
feat: add fork detector and templates for fork-driven blunders

- src/chess/motifs/fork.ts: detect a single piece attacking 2+ enemies
  of equal/greater value
- src/chess/motifs/__tests__/fork.test.ts: positive + negative cases
- src/chess/templates/library.ts: 6 new entries under blunder.fork.*
```

Avoid co-author trailers and AI-attribution footers. The commit log is for humans describing what humans did.

---

## Submitting a pull request

1. **Fork** the repository on GitHub.
2. **Branch** from `main`. Use a topic name (`feat/fork-detector`, `docs/user-guide-typo`).
3. **Run the full check** before pushing:
   ```bash
   npm run lint
   npm run typecheck
   npm run test:run
   ```
4. **Open the PR** against `main`. The PR description should:
   - Summarise what changed and why (one paragraph).
   - List user-facing changes if any (a bullet list is plenty).
   - Note any follow-ups left for later.
5. **Iterate.** A maintainer will review; don't be alarmed by suggestions — Hindsight has a high bar for the templates and motif modules in particular because they are the parts users feel.

PRs touching the analysis pipeline (`src/chess/analysis.ts`, `src/chess/review.ts`, `electron/engine/`) need a regression run on at least one full game before merging — the easiest way is to import a sample PGN end-to-end and confirm the review loads without errors.

---

## Reporting bugs

Open an issue on [GitHub](https://github.com/ElatDev/Hindsight/issues) with:

- **What you expected.** One sentence is fine.
- **What happened instead.** Including the exact error text if any.
- **A minimal reproduction.** For review bugs, the PGN that triggers the issue is essential — Hindsight is local-only, so we can't see it any other way.
- **Your OS and version, Node version, and Hindsight version (or commit hash if running from source).**

For security issues — e.g. a way to make the engine subprocess execute attacker-supplied input from a PGN — please disclose privately rather than via a public issue. The README has the contact information.

Thanks for reading this far. Now go ship a template.
