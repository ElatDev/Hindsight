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
$TargetLicense = Join-Path $TargetDir 'Copying.txt'

if ((Test-Path $TargetBin) -and (Test-Path $TargetLicense)) {
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

  # Stockfish is GPLv3. Its license text, author list and a pointer to the
  # matching source travel with the binary so the installer ships them too.
  foreach ($Doc in 'Copying.txt', 'AUTHORS') {
    $SrcDoc = Get-ChildItem -Path $TmpRoot -Recurse -Depth 1 -Filter $Doc | Select-Object -First 1
    if (-not $SrcDoc) {
      throw "Could not locate $Doc inside extracted archive."
    }
    Copy-Item -Path $SrcDoc.FullName -Destination (Join-Path $TargetDir $Doc) -Force
  }
  Set-Content -Path (Join-Path $TargetDir 'SOURCE.txt') -Encoding ascii -Value @(
    "Stockfish $Version is free software, licensed under the GNU General",
    'Public License version 3 (see Copying.txt). Hindsight runs it as a',
    'separate program and talks to it over UCI.',
    '',
    'Source code for this build:',
    "  https://github.com/official-stockfish/Stockfish/tree/$Version",
    'The release archive this binary came from, which also contains the source:',
    "  $Url"
  )
  Write-Host "Installed Stockfish to $TargetBin"
} finally {
  Remove-Item -Path $TmpRoot -Recurse -Force -ErrorAction SilentlyContinue
}
