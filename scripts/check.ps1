# Syntax checks: builder-app.js + optional luac on addon Lua
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$fail = 0

Write-Host "==> JS syntax (src/builder-app.js)"
$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Write-Host "SKIP: node not on PATH"
} else {
    node -e "new Function(require('fs').readFileSync('src/builder-app.js','utf8'))"
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL: builder-app.js"
        $fail = 1
    } else {
        Write-Host "OK: builder-app.js"
    }
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
$luaFiles = @(Get-ChildItem -Path "addon\AscBuildschmiede\*.lua" -ErrorAction SilentlyContinue)
if (-not $luac) {
    Write-Host "SKIP: luac/luac5.1 not found (addon Lua unchecked)"
} elseif ($luaFiles.Count -eq 0) {
    Write-Host "SKIP: no addon\AscBuildschmiede\*.lua"
} else {
    Write-Host "==> luac ($luac) on $($luaFiles.Count) Lua files"
    foreach ($f in $luaFiles) {
        & $luac -p $f.FullName
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAIL: $($f.Name)"
            $fail = 1
        } else {
            Write-Host "OK: $($f.Name)"
        }
    }
}

if ($fail -ne 0) { exit 1 }
Write-Host "OK: check passed"
