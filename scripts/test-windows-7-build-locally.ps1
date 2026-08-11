#
# ATTENTION: AI-generated (by Claude Fable 5 on 'max' reasoning)
#

# Local mirror of .github/workflows/build-windows-7.yml
#
# Prerequisites (one-time):
#   rustup toolchain install nightly-2026-06-28 --component rust-src
#   bun --version   (any recent bun)
#
# Run from the repository root:
#   powershell -ExecutionPolicy Bypass -File scripts/build-windows-7.ps1
#
# Unlike CI, this reuses the cargo target directory, so incremental
# rebuilds take a fraction of the cold CI time.

$ErrorActionPreference = "Stop"

$env:RUSTUP_TOOLCHAIN = "nightly-2026-06-28"
$env:VITE_BUILD_TARGET = "chrome109"
$Win7Target = "x86_64-win7-windows-msvc"

# --- Verify the Rust Win7 build contract -----------------------------------
$targets = rustc --print target-list
if ($targets -notcontains $Win7Target) {
  throw "Toolchain $env:RUSTUP_TOOLCHAIN does not know target $Win7Target"
}
$rustSrc = rustup component list --toolchain $env:RUSTUP_TOOLCHAIN |
  Select-String -Pattern '^rust-src.*\(installed\)$'
if ($null -eq $rustSrc) {
  throw "rust-src is not installed; run: rustup component add rust-src --toolchain $env:RUSTUP_TOOLCHAIN"
}

# --- Prepare the Win7-target txiki sidecar ----------------------------------
$sourceSidecar = "src-tauri/binaries/txiki-server-x86_64-pc-windows-msvc.exe"
$targetSidecar = "src-tauri/binaries/txiki-server-$Win7Target.exe"

# Lenient: the upstream txiki build imports Win8+ APIs; tracked separately.
bun ./scripts/check-windows-7-pe.ts --lenient $sourceSidecar
Copy-Item -LiteralPath $sourceSidecar -Destination $targetSidecar

# --- Frontend ----------------------------------------------------------------
bun install --frozen-lockfile
bun run build:frontend

# --- Exclude Win8+-only plugins (restored automatically afterwards) ----------
$notificationCapability = "src-tauri/capabilities/plugin-notification.json"
$capabilityBackup = "$env:TEMP/plugin-notification.json.bak"
Copy-Item -LiteralPath $notificationCapability -Destination $capabilityBackup

try {
  Remove-Item -LiteralPath $notificationCapability

  # --- Compile ----------------------------------------------------------------
  $env:TAURI_CONFIG = Get-Content -LiteralPath "src-tauri/tauri.conf.json" -Raw

  cargo build `
    --manifest-path src-tauri/Cargo.toml `
    --bins `
    --no-default-features `
    --features tauri/custom-protocol `
    --target $Win7Target `
    --release `
    --locked `
    -Z build-std
  if ($LASTEXITCODE -ne 0) { throw "cargo build failed" }
}
finally {
  # Restore the capability file so the working tree stays clean
  Copy-Item -LiteralPath $capabilityBackup -Destination $notificationCapability
  Remove-Item -LiteralPath $capabilityBackup
}

# --- Verify the produced binaries ---------------------------------------------
$tauriConfig = Get-Content -LiteralPath "src-tauri/tauri.conf.json" -Raw | ConvertFrom-Json
$productName = $tauriConfig.productName
$appBinary = "src-tauri/target/$Win7Target/release/$productName.exe"

if (-not (Test-Path -LiteralPath $appBinary -PathType Leaf)) {
  throw "Expected Win7-target binary not found: $appBinary"
}

# App binary must be strictly Win7-clean; sidecar is lenient for now.
bun ./scripts/check-windows-7-pe.ts $appBinary
bun ./scripts/check-windows-7-pe.ts --lenient "src-tauri/target/$Win7Target/release/txiki-server.exe"

Write-Host ""
Write-Host "Win7 build OK: $appBinary" -ForegroundColor Green
Write-Host "Copy it together with txiki-server.exe and portable.txt to test on Windows 7."
