#!/usr/bin/env bash
# Fetch the OS-appropriate Stockfish binary into stockfish/bin/<platform>-<arch>/.
# Invoked from `npm install` via the Node dispatcher in scripts/fetch-stockfish.mjs.
# Idempotent: skips download if the target binary is already present.
#
# Env overrides:
#   STOCKFISH_VERSION  GitHub release tag (default: sf_17)
#   STOCKFISH_VARIANT  Build variant suffix, e.g. avx2, bmi2 (default: plain x86-64)
#   SKIP_STOCKFISH_DOWNLOAD=1  Skip the fetch entirely.

set -euo pipefail

if [[ "${SKIP_STOCKFISH_DOWNLOAD:-}" == "1" ]]; then
  echo "SKIP_STOCKFISH_DOWNLOAD=1 set — skipping Stockfish fetch."
  exit 0
fi

VERSION="${STOCKFISH_VERSION:-sf_17}"
VARIANT="${STOCKFISH_VARIANT:-}"

uname_s="$(uname -s)"
uname_m="$(uname -m)"

case "$uname_s" in
  Darwin) os_token=macos ;;
  Linux)  os_token=ubuntu ;;
  *)
    echo "Unsupported OS for fetch-stockfish.sh: $uname_s" >&2
    echo "Use scripts/fetch-stockfish.ps1 on Windows." >&2
    exit 1
    ;;
esac

case "$uname_m" in
  x86_64|amd64) arch_token=x86-64; node_arch=x64 ;;
  arm64|aarch64) arch_token=arm64; node_arch=arm64 ;;
  *)
    echo "Unsupported CPU architecture: $uname_m" >&2
    exit 1
    ;;
esac

# Map to the Stockfish release asset name.
if [[ "$os_token" == "macos" && "$arch_token" == "arm64" ]]; then
  asset_base="stockfish-macos-m1-apple-silicon"
  node_platform="darwin"
elif [[ "$os_token" == "macos" ]]; then
  asset_base="stockfish-macos-x86-64"
  node_platform="darwin"
elif [[ "$os_token" == "ubuntu" && "$arch_token" == "x86-64" ]]; then
  asset_base="stockfish-ubuntu-x86-64"
  node_platform="linux"
else
  echo "No published Stockfish build for $os_token/$arch_token." >&2
  exit 1
fi

if [[ -n "$VARIANT" ]]; then
  asset_base="${asset_base}-${VARIANT}"
fi

asset="${asset_base}.tar"
url="https://github.com/official-stockfish/Stockfish/releases/download/${VERSION}/${asset}"

target_dir="stockfish/bin/${node_platform}-${node_arch}"
target_bin="${target_dir}/stockfish"

if [[ -x "$target_bin" ]]; then
  echo "Stockfish already present at $target_bin — skipping fetch."
  exit 0
fi

mkdir -p "$target_dir"
tmp="$(mktemp -d 2>/dev/null || mktemp -d -t stockfish)"
trap 'rm -rf "$tmp"' EXIT

echo "Downloading $url"
if command -v curl >/dev/null 2>&1; then
  curl -fL --retry 3 -o "$tmp/stockfish.tar" "$url"
elif command -v wget >/dev/null 2>&1; then
  wget -O "$tmp/stockfish.tar" "$url"
else
  echo "Neither curl nor wget is available; cannot download Stockfish." >&2
  exit 1
fi

echo "Extracting"
tar -xf "$tmp/stockfish.tar" -C "$tmp"

# The release tarball ships the binary inside a top-level `stockfish/` directory.
# The binary may be named `stockfish` or `stockfish-<asset_base>`; locate it.
src_bin="$(find "$tmp" -type f \( -name 'stockfish' -o -name "${asset_base}" -o -name 'stockfish-*' \) ! -name '*.txt' ! -name '*.md' | head -n1)"

if [[ -z "$src_bin" || ! -f "$src_bin" ]]; then
  echo "Could not locate stockfish binary inside extracted archive." >&2
  exit 1
fi

cp "$src_bin" "$target_bin"
chmod +x "$target_bin"

echo "Installed Stockfish to $target_bin"
