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

## ADR-005: Distribution — electron-builder with extraResources for Stockfish

**Date:** 2026-04-27
**Status:** Accepted

**Context:** Phase 12 / Task 4 ships installers for Windows / macOS / Linux. The bundled Stockfish binary (per ADR-003) needs to land somewhere the OS can `exec` it; that rules out the ASAR archive.

**Decision:** Use `electron-builder` with the binary copied via `extraResources` from `stockfish/bin` to `<resources>/stockfish/bin`. At runtime `electron/main.ts` resolves the binary root from `process.resourcesPath` when `app.isPackaged` is true, and from `app.getAppPath()` (project root) otherwise. Default targets: NSIS (Windows x64), DMG (macOS x64+arm64), AppImage (Linux x64). No code-signing or notarization in the v0.1 config — users will see the standard "unidentified developer" prompts; signing certs are deferred to a per-platform follow-up since they're paid + per-OS workflows.

**Consequences:**

- (+) Single command (`npm run dist`) builds an installer for the host OS.
- (+) Stockfish is shipped as part of the installer — users don't need a network round-trip on first launch.
- (+) Renderer + main code lives inside ASAR (faster startup, smaller footprint); only the binary lives outside.
- (–) No code signing in v0.1 → SmartScreen warning on Windows, "unidentified developer" on macOS. Acceptable for an open-source v0.1; the README will document the warning.
- (–) Cross-OS build needs the corresponding host (e.g., macOS DMG can only be built on macOS without a CI matrix). The config supports the obvious GH Actions matrix when we add it.

**Alternatives considered:**

- `electron-forge`: similar feature set; team familiarity with electron-builder + the dep is already on disk made it the lower-friction pick.
- Per-OS CI immediately (Phase 13 / Task 4): deferred until manual local builds prove the config.
- Bundle Stockfish inside ASAR: doesn't work — exec'ing files from inside the archive isn't supported.

---

## ADR-006: Ship third-party licenses and Stockfish's source with every release

**Date:** 2026-09-21
**Status:** Accepted

**Context:** ADR-003 and ADR-004 settled that bundling GPLv3 Stockfish with MIT Hindsight is fine because Hindsight runs it as a separate process. Neither covered what the installer has to carry. The fetch scripts kept only the Stockfish executable, so the installer shipped a GPLv3 binary with no license text and no way to find its source. It also shipped no copy of Hindsight's own MIT license and no attribution for the piece artwork. The piece-set notice in `src/data/pieces/LICENSE` called all twelve sets CC BY-SA 4.0. Lichess's `COPYING.md` shows none of them are: they are GPLv2+, AGPLv3+, Apache 2.0, MIT and CC BY-NC-SA 4.0, and lila lists `alpha` and `leipzig` as non-free.

**Decision:**

- The fetch scripts copy Stockfish's `Copying.txt` and `AUTHORS` from the upstream archive and write a `SOURCE.txt` naming the exact tag and archive. The existing `extraResources` rule puts them next to the binary.
- `extraResources` also ships `LICENSE`, a new `THIRD_PARTY_NOTICES.md` and the piece-set notice in the app's resources folder.
- The piece-set notice lists each set's author and license from lila's `COPYING.md`. `scripts/fetch-pieces.mjs` generates the same text.
- The release workflow attaches the source of the bundled Stockfish tag to every GitHub Release, so the source is available from the same place as the binary (GPLv3 section 6).

**Consequences:**

- (+) Every installer carries the license texts and attribution its contents require.
- (+) The source offer doesn't depend on the Stockfish project keeping its old tags online.
- (–) The Stockfish tag appears in both the fetch scripts and the release workflow and must be bumped in both.
- (–) Several bundled piece sets are non-commercial or non-free. The notice says so, but a fork that wants to sell Hindsight would have to drop those sets. Whether to keep them is an open product decision. Hindsight's MIT license is unchanged.

**Alternatives considered:**

- Relying on a link to Stockfish's GitHub instead of attaching its source: simpler, but it leaves compliance in someone else's hands.
- Showing licenses in an in-app About screen: better for users, but it's a new feature, so it's out of scope for this release.

---

## ADR-007: Build every installer in CI; ad-hoc sign on macOS

**Date:** 2026-09-21
**Status:** Accepted

**Context:** electron-builder only builds for the OS it runs on, so the DMG and AppImage targets in `package.json` had never been built. The fetch script downloads the Stockfish binary for the host architecture, so an x64 DMG built on an Apple Silicon runner would bundle an arm64 engine. With no Developer ID (ADR-005), electron-builder skips signing on macOS. That leaves Electron's executable with only its linker signature, which no longer matches the repackaged bundle. `codesign --verify` fails, and macOS reports a downloaded copy as "damaged" with no way to open it.

**Decision:**

- `.github/workflows/release.yml` builds each installer on its own runner: Windows, Apple Silicon macOS, Intel macOS and Linux. Each build names its target and arch on the command line. A `v*` tag attaches the installers and the Stockfish source to a draft release, which is published by hand. Pushes to `main` that touch the packaging run the same builds as a dry run.
- An electron-builder `afterPack` hook (`scripts/adhoc-sign-mac.cjs`) ad-hoc signs the macOS app bundle before the DMG is built, then verifies the signature.

**Consequences:**

- (+) All four installers come from the same clean, reproducible build.
- (+) A packaging break shows up on `main` before anyone cuts a tag.
- (+) On macOS, users get Gatekeeper's normal unverified-developer prompt ("Open Anyway" in System Settings) instead of "damaged".
- (–) Still not notarized. That needs a paid Apple Developer ID and remains a follow-up to ADR-005.
- (–) Intel builds depend on GitHub keeping an Intel macOS runner (`macos-26-intel`).

**Alternatives considered:**

- Cross-building the x64 DMG on Apple Silicon: needs a second Stockfish download for the other arch and per-arch `extraResources` rules. Separate runners need no changes.
- Leaving the Mac app unsigned and telling users to run `xattr -cr`: works, but it asks every Mac user to run a terminal command to get past a scary error.

---

## Note: Windows dev gotcha — `ELECTRON_RUN_AS_NODE`

If `ELECTRON_RUN_AS_NODE=1` is set in your shell environment (some Windows setups have this from earlier electron experimentation), `npm run dev` and `npx electron .` will both fail with `TypeError: Cannot read properties of undefined (reading 'whenReady')`. The fix is to `unset ELECTRON_RUN_AS_NODE` before running. We may add an `env-check` script to detect this at `npm run dev` startup if it bites repeatedly.
