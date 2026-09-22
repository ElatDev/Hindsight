/**
 * electron-builder afterPack hook: ad-hoc sign the macOS app bundle.
 *
 * There is no Apple Developer ID yet (DECISIONS.md ADR-005), so
 * electron-builder skips code signing. That leaves Electron's executable
 * with only its linker signature, which no longer matches the renamed,
 * repackaged bundle. `codesign --verify` rejects it, and macOS reports a
 * downloaded copy as "damaged", with no way to open it. An ad-hoc signature
 * over the whole bundle makes it valid, so Gatekeeper shows its usual
 * unverified-developer prompt instead, which the user can get past from
 * System Settings.
 *
 * Runs before the DMG is built. A real signing identity, once configured,
 * signs after this hook and replaces the ad-hoc signature.
 */
const { execFileSync } = require('node:child_process');
const path = require('node:path');

exports.default = async function adhocSignMac(context) {
  if (context.electronPlatformName !== 'darwin') return;
  const app = path.join(
    context.appOutDir,
    `${context.packager.appInfo.productFilename}.app`,
  );
  execFileSync('codesign', ['--force', '--deep', '--sign', '-', app], {
    stdio: 'inherit',
  });
  execFileSync('codesign', ['--verify', '--deep', '--strict', app], {
    stdio: 'inherit',
  });
};
