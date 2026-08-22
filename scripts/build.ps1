# Build site artifacts: index.html + synergien.html via assemble.py
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Get-Python {
    foreach ($c in @("python3", "python")) {
        $cmd = Get-Command $c -ErrorAction SilentlyContinue
        if ($cmd) { return $cmd.Source }
    }
    throw "python3/python not found on PATH"
}

$py = Get-Python
Write-Host "==> assemble ($py pipeline/assemble.py)"
& $py pipeline/assemble.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
Write-Host "OK: index.html / synergien.html"
