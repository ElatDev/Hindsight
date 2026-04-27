#!/usr/bin/env pwsh
# Fetch the Windows Stockfish binary into stockfish/bin/win32-<arch>/stockfish.exe.
# Invoked from `npm install` via the Node dispatcher in scripts/fetch-stockfish.mjs.
# Idempotent: skips download if the target binary is already present.
#
# Env overrides:
#   STOCKFISH_VERSION         GitHub release tag (default: sf_17)
#   STOCKFISH_VARIANT         Build variant suffix, e.g. avx2, bmi2 (default: plain x86-64)
#   SKIP_STOCKFISH_DOWNLOAD=1 Skip the fetch entirely.

$ErrorActionPreference = 'Stop'

if ($env:SKIP_STOCKFISH_DOWNLOAD -eq '1') {
  Write-Host 'SKIP_STOCKFISH_DOWNLOAD=1 set - skipping Stockfish fetch.'
  exit 0
}

$Version = if ($env:STOCKFISH_VERSION) { $env:STOCKFISH_VERSION } else { 'sf_17' }
$Variant = $env:STOCKFISH_VARIANT

$AssetBase = 'stockfish-windows-x86-64'
if ($Variant) {
  $AssetBase = "$AssetBase-$Variant"
}

$Asset = "$AssetBase.zip"
$Url = "https://github.com/official-stockfish/Stockfish/releases/download/$Version/$Asset"

$NodeArch = if ([System.Environment]::Is64BitOperatingSystem) { 'x64' } else { 'ia32' }
$TargetDir = Join-Path 'stockfish/bin' "win32-$NodeArch"
$TargetBin = Join-Path $TargetDir 'stockfish.exe'

if (Test-Path $TargetBin) {
  Write-Host "Stockfish already present at $TargetBin - skipping fetch."
  exit 0
}

New-Item -ItemType Directory -Path $TargetDir -Force | Out-Null

$TmpRoot = Join-Path ([System.IO.Path]::GetTempPath()) ([System.Guid]::NewGuid().ToString())
New-Item -ItemType Directory -Path $TmpRoot -Force | Out-Null

try {
  $TmpZip = Join-Path $TmpRoot 'stockfish.zip'

  Write-Host "Downloading $Url"
  $oldProgress = $ProgressPreference
  $ProgressPreference = 'SilentlyContinue'
  try {
    Invoke-WebRequest -Uri $Url -OutFile $TmpZip -UseBasicParsing
  } finally {
    $ProgressPreference = $oldProgress
  }

  Write-Host 'Extracting'
  Expand-Archive -Path $TmpZip -DestinationPath $TmpRoot -Force

  $SrcBin = Get-ChildItem -Path $TmpRoot -Recurse -Filter 'stockfish*.exe' | Select-Object -First 1
  if (-not $SrcBin) {
    throw "Could not locate stockfish.exe inside extracted archive."
  }

  Copy-Item -Path $SrcBin.FullName -Destination $TargetBin -Force
  Write-Host "Installed Stockfish to $TargetBin"
} finally {
  Remove-Item -Path $TmpRoot -Recurse -Force -ErrorAction SilentlyContinue
}
