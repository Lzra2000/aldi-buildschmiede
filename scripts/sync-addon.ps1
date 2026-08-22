# luac-check addon Lua, sync to live Ascension AddOns, rebuild AscBuildschmiede.zip
param(
    [string]$LiveAddOns = "",
    [switch]$SkipLive,
    [switch]$SkipZip
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

if (-not $LiveAddOns) {
    if ($env:ASCENSION_ADDONS) {
        $LiveAddOns = $env:ASCENSION_ADDONS
    } else {
        $LiveAddOns = "C:\Ascension\Launcher\resources\ascension-live\Interface\AddOns"
    }
}

$AddonSrc = Join-Path $Root "addon\AscBuildschmiede"
if (-not (Test-Path -LiteralPath $AddonSrc)) {
    throw "Missing addon source: $AddonSrc"
}

function Get-Luac {
    foreach ($c in @("luac5.1", "luac")) {
        $cmd = Get-Command $c -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    $candidates = @(
        "${env:ProgramFiles(x86)}\Lua\5.1\luac.exe",
        "${env:ProgramFiles}\Lua\5.1\luac.exe",
        "$env:LOCALAPPDATA\Programs\Lua\bin\luac.exe"
    )
    foreach ($p in $candidates) {
        if ($p -and (Test-Path -LiteralPath $p)) { return $p }
    }
    return $null
}

$luac = Get-Luac
$luaFiles = @(Get-ChildItem -Path (Join-Path $AddonSrc "*.lua"))
if (-not $luac) {
    throw "luac/luac5.1 not found - install Lua 5.1 or put luac on PATH"
}
Write-Host "==> luac -p ($luac)"
foreach ($f in $luaFiles) {
    & $luac -p $f.FullName
    if ($LASTEXITCODE -ne 0) { throw "luac failed: $($f.Name)" }
    Write-Host "OK: $($f.Name)"
}

if (-not $SkipLive) {
    $dest = Join-Path $LiveAddOns "AscBuildschmiede"
    $parent = Split-Path -Parent $dest
    if (-not (Test-Path -LiteralPath $parent)) {
        Write-Host "SKIP live sync - AddOns parent missing: $parent"
        Write-Host "  (set -LiveAddOns or ASCENSION_ADDONS, or pass -SkipLive)"
    } else {
        Write-Host "==> live sync -> $dest"
        if (Test-Path -LiteralPath $dest) {
            Remove-Item -LiteralPath $dest -Recurse -Force
        }
        New-Item -ItemType Directory -Path $dest -Force | Out-Null
        Copy-Item -Path (Join-Path $AddonSrc "*") -Destination $dest -Recurse -Force
        Write-Host "OK: live AddOns updated"
    }
}

if (-not $SkipZip) {
    $zipPath = Join-Path $Root "AscBuildschmiede.zip"
    Write-Host "==> rebuild $zipPath"
    if (Test-Path -LiteralPath $zipPath) {
        Remove-Item -LiteralPath $zipPath -Force
    }
    # Layout must be AscBuildschmiede/... at zip root
    $staging = Join-Path ([System.IO.Path]::GetTempPath()) ("bs-zip-" + [guid]::NewGuid().ToString("n"))
    $stageAddon = Join-Path $staging "AscBuildschmiede"
    try {
        New-Item -ItemType Directory -Path $stageAddon -Force | Out-Null
        Copy-Item -Path (Join-Path $AddonSrc "*") -Destination $stageAddon -Recurse -Force
        $zipCmd = Get-Command zip -ErrorAction SilentlyContinue
        if ($zipCmd) {
            Push-Location $staging
            try {
                & zip -r -q $zipPath "AscBuildschmiede"
                if ($LASTEXITCODE -ne 0) { throw "zip failed" }
            } finally {
                Pop-Location
            }
        } else {
            Compress-Archive -Path $stageAddon -DestinationPath $zipPath -Force
        }
    } finally {
        if (Test-Path -LiteralPath $staging) {
            Remove-Item -LiteralPath $staging -Recurse -Force
        }
    }
    if (-not (Test-Path -LiteralPath $zipPath)) {
        throw "Zip was not created: $zipPath"
    }
    $kb = [math]::Round((Get-Item $zipPath).Length / 1KB, 1)
    Write-Host "OK: AscBuildschmiede.zip ($kb KB)"
}

Write-Host "OK: sync-addon done"
