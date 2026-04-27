# DECISIONS

> Architecture Decision Records (ADRs). Append-only — each entry captures a decision at a point in time, the alternatives considered, and the reasoning. If a decision is later superseded, add a new ADR that supersedes it (don't edit the old one).

Format:

```
## ADR-NNN: Short title
**Date:** YYYY-MM-DD
**Status:** Accepted / Superseded by ADR-MMM / Deprecated
**Context:** …
**Decision:** …
**Consequences:** …
**Alternatives considered:** …
```

---

## ADR-001: Stack — Electron + TypeScript + React + chess.js (no Python)

**Date:** 2026-04-27
**Status:** Accepted

**Context:** The original spec recommended Electron + Python + `python-chess`, with TypeScript/React on the frontend. We need a desktop app that's cross-platform, runs Stockfish locally as a subprocess, has a polished chess UI, works fully offline, and is maintainable by a single developer.

**Decision:** Drop Python entirely. Use TypeScript end-to-end:

- Electron main process spawns native Stockfish via `child_process` and handles UCI directly in TS.
- `chess.js` covers FEN parsing, PGN parsing, move generation, legal-move validation, and game-end detection.
- ECO opening database loaded as a JSON file from disk.

**Consequences:**

- (+) Single language and runtime — no IPC bridge between Node and Python, no second test stack, no Python runtime in the installer.
- (+) Faster onboarding for contributors familiar with the JS/TS ecosystem.
- (+) Smaller distribution size.
- (–) `python-chess` has slightly nicer ergonomics for some board introspection (e.g., square attackers, piece maps). We will replicate what we need as small TS utilities in `src/chess/`. Estimated cost: maybe 150–300 lines of utility code over the project's lifetime.

**Alternatives considered:**

- Electron + Python + python-chess (the original spec recommendation): rejected for the IPC + dual-runtime overhead.
- Tauri + Rust: rejected because Rust is not installed locally and adds toolchain/learning overhead. Tauri's lighter footprint isn't worth the complexity for a single-dev project.
- Pure web app + Stockfish.js (WASM): rejected because we'd lose easy native subprocess control (slower analysis, harder threading), native file dialogs, and easy local SQLite persistence.

---

## ADR-002: Chess logic library — `chess.js`

**Date:** 2026-04-27
**Status:** Accepted

**Context:** With Python out (ADR-001), we need a TS chess library for FEN/PGN parsing, move generation, and legal-move validation.

**Decision:** Use [`chess.js`](https://github.com/jhlywa/chess.js). Mature (10+ years), widely used (powers Lichess utilities, react-chessboard, etc.), MIT-licensed, ~70KB minified, no runtime deps.

**Consequences:**

- (+) Battle-tested move generation; we don't reimplement chess rules.
- (+) Plays well with `react-chessboard` (Phase 3).
- (–) Doesn't include opening database — we bring our own (ECO from Lichess, ADR-pending, Phase 9).
- (–) Tactical motif detection is _not_ in scope of chess.js — we write those ourselves in `src/chess/motifs/` (Phase 7). This was the case in any chess library though.

**Alternatives considered:**

- `chessops` (Lichess's TS chess library): more powerful but heavier API. `chess.js` is simpler and the gap doesn't matter for our needs.
- Roll our own: rejected, no reason to reinvent.

---

## ADR-003: Stockfish bundling — fetch at install, never commit

**Date:** 2026-04-27
**Status:** Accepted

**Context:** Stockfish binaries are 30–60 MB per OS, compiled per-platform, and updated independently. They're GPL v3 (license-compatible with our MIT app via dynamic invocation as a subprocess, not linkage).

**Decision:** A `scripts/fetch-stockfish.{ps1,sh}` script downloads the OS-appropriate binary at install time (`postinstall` in `package.json`). Binaries land in `stockfish/bin/{platform}-{arch}/stockfish[.exe]`, which is gitignored. For distribution builds, `electron-builder` bundles the matching binary into the installer.

**Consequences:**

- (+) Repo stays small (no committed binaries).
- (+) Easy to upgrade Stockfish — change a version variable, re-run install.
- (+) GPL/MIT separation is clean: we ship a binary alongside our MIT-licensed app, communicating via UCI. No linkage.
- (–) Install requires a network round-trip the first time (acceptable; one-time cost; can be cached).

**Alternatives considered:**

- Commit binaries: bloats repo by 100+ MB cumulatively across OSes; updates create huge diffs.
- Require user to install Stockfish themselves: too much friction for the "just download Hindsight and play" experience.
- Ship Stockfish.js (WASM): rejected by ADR-001.

---

## ADR-004: License — MIT

**Date:** 2026-04-27
**Status:** Accepted

**Context:** We need an open-source license. The product is intended to be freely usable and modifiable; we want low friction for contributors and forks.

**Decision:** MIT license.

**Consequences:**

- (+) Maximum permissiveness — anyone can use, modify, redistribute, even commercially.
- (+) Compatible with the GPL-licensed Stockfish binary we ship alongside (since we invoke it as a subprocess, not link to it).
- (–) No copyleft — a fork can take Hindsight closed-source. We're okay with that for v1.

**Alternatives considered:**

- GPL v3: would force derivatives to remain open. Stricter than we want; some downstream uses (e.g., bundling into a closed-source app) would be blocked.
- Apache 2.0: similar permissiveness to MIT, plus explicit patent grant. Slightly more text. MIT is simpler and matches the spec.

---

## Note: Windows dev gotcha — `ELECTRON_RUN_AS_NODE`

If `ELECTRON_RUN_AS_NODE=1` is set in your shell environment (some Windows setups have this from earlier electron experimentation), `npm run dev` and `npx electron .` will both fail with `TypeError: Cannot read properties of undefined (reading 'whenReady')`. The fix is to `unset ELECTRON_RUN_AS_NODE` before running. We may add an `env-check` script to detect this at `npm run dev` startup if it bites repeatedly.
