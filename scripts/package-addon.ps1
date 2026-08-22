# package-addon.ps1 — luac check, AscBuildschmiede.zip, optional live sync
# Usage:
#   .\scripts\package-addon.ps1
#   .\scripts\package-addon.ps1 -Live
#   .\scripts\package-addon.ps1 -NoLive

[CmdletBinding()]
param(
    [switch]$Live,
    [switch]$NoLive
)

$ErrorActionPreference = "Stop"

$RepoRoot = Split-Path -Parent $PSScriptRoot
$AddonSrc = Join-Path $RepoRoot "addon\AscBuildschmiede"
$ZipOut = Join-Path $RepoRoot "AscBuildschmiede.zip"
$LiveDefault = "C:\Ascension\Launcher\resources\ascension-live\Interface\AddOns\AscBuildschmiede"

function Resolve-Luac {
    $candidates = @(
        "luac5.1",
        "luac"
    )
    foreach ($name in $candidates) {
        $cmd = Get-Command $name -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    $paths = @(
        "${env:ProgramFiles(x86)}\Lua\5.1\luac.exe",
        "${env:ProgramFiles}\Lua\5.1\luac.exe",
        "$env:LOCALAPPDATA\Programs\Lua\bin\luac.exe"
    )
    foreach ($p in $paths) {
        if (Test-Path $p) { return $p }
    }
    throw "luac5.1 / luac not found. Install Lua 5.1 (luac) and retry."
}

if (-not (Test-Path $AddonSrc)) {
    throw "Addon source missing: $AddonSrc"
}

$luac = Resolve-Luac
Write-Host "Using luac: $luac"

$luaFiles = Get-ChildItem -Path $AddonSrc -Filter "*.lua" -File | Sort-Object Name
if ($luaFiles.Count -eq 0) {
    throw "No .lua files under $AddonSrc"
}

foreach ($f in $luaFiles) {
    Write-Host "luac -p $($f.Name)"
    & $luac -p $f.FullName
    if ($LASTEXITCODE -ne 0) {
        throw "Syntax check failed: $($f.FullName)"
    }
}
Write-Host "All Lua files OK ($($luaFiles.Count))."

# Zip layout must be AscBuildschmiede/* (folder at zip root)
$staging = Join-Path ([System.IO.Path]::GetTempPath()) ("AscBuildschmiede-pack-" + [guid]::NewGuid().ToString("n"))
$stageAddon = Join-Path $staging "AscBuildschmiede"
try {
    New-Item -ItemType Directory -Path $stageAddon -Force | Out-Null
    Copy-Item -Path (Join-Path $AddonSrc "*") -Destination $stageAddon -Recurse -Force

    if (Test-Path $ZipOut) {
        Remove-Item -LiteralPath $ZipOut -Force
    }
    Compress-Archive -Path $stageAddon -DestinationPath $ZipOut -CompressionLevel Optimal
    Write-Host "Wrote $ZipOut"
} finally {
    if (Test-Path $staging) {
        Remove-Item -LiteralPath $staging -Recurse -Force
    }
}

$doLive = $false
if ($Live) { $doLive = $true }
elseif ($NoLive) { $doLive = $false }
elseif ($env:ASC_BUILDSCHMIEDE_LIVE -eq "1") { $doLive = $true }
elseif (Test-Path (Split-Path $LiveDefault -Parent)) { $doLive = $true }

if ($doLive) {
    $livePath = if ($env:ASC_BUILDSCHMIEDE_LIVE_PATH) { $env:ASC_BUILDSCHMIEDE_LIVE_PATH } else { $LiveDefault }
    $liveParent = Split-Path $livePath -Parent
    if (-not (Test-Path $liveParent)) {
        Write-Warning "Live AddOns parent missing, skip sync: $liveParent"
    } else {
        if (Test-Path $livePath) {
            Remove-Item -LiteralPath $livePath -Recurse -Force
        }
        New-Item -ItemType Directory -Path $livePath -Force | Out-Null
        Copy-Item -Path (Join-Path $AddonSrc "*") -Destination $livePath -Recurse -Force
        Write-Host "Synced live AddOn -> $livePath"
    }
} else {
    Write-Host "Live sync skipped (pass -Live or set ASC_BUILDSCHMIEDE_LIVE=1)."
}

Write-Host "Done."
