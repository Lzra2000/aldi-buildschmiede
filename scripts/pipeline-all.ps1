# Run offline data pipelines in order; skip client-DBC steps when paths missing.
# Does NOT invent coefficients. BLP/icons only via existing itemicons paths.
$ErrorActionPreference = "Continue"
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
if ($env:ASCENSION_DBC) {
    $DBC = $env:ASCENSION_DBC
} else {
    $DBC = "C:\Users\x\Documents\AscensionDBC\DBFilesClient"
}
if ($env:ASCENSION_SPELL_DBC) {
    $SPELL_DBC = $env:ASCENSION_SPELL_DBC
} else {
    $SPELL_DBC = "C:\Users\x\Documents\AscensionDBC\patch-T\DBFilesClient\Spell.dbc"
}

$script:Ran = 0
$script:Skipped = 0
$script:Failed = 0

function Invoke-PipeStep {
    param(
        [Parameter(Mandatory = $true)][string]$Name,
        [Parameter(Mandatory = $true)][string]$Script,
        [string[]]$NeedData = @(),
        [string[]]$NeedFiles = @(),
        [string]$SkipReason = ""
    )
    $path = Join-Path "pipeline" $Script
    if (-not (Test-Path -LiteralPath $path)) {
        Write-Host "SKIP $Name - missing $path"
        $script:Skipped++
        return
    }
    foreach ($n in $NeedData) {
        $dp = Join-Path "data" $n
        if (-not (Test-Path -LiteralPath $dp)) {
            Write-Host "SKIP $Name - need data/$n"
            $script:Skipped++
            return
        }
    }
    foreach ($f in $NeedFiles) {
        if (-not (Test-Path -LiteralPath $f)) {
            if ($SkipReason) {
                Write-Host "SKIP $Name - $SkipReason"
            } else {
                Write-Host "SKIP $Name - missing $f"
            }
            $script:Skipped++
            return
        }
    }
    Write-Host "==> $Name ($Script)"
    & $py $path
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL $Name (exit $LASTEXITCODE)"
        $script:Failed++
    } else {
        Write-Host "OK $Name"
        $script:Ran++
    }
}

Write-Host "Python: $py"
Write-Host "DBC dir: $DBC"
Write-Host ""

Invoke-PipeStep -Name "modifiers" -Script "modifiers.py" -NeedData @("catalog.json", "relations.json")
Invoke-PipeStep -Name "scaling" -Script "scaling.py" -NeedData @("catalog.json")
Invoke-PipeStep -Name "pathtags" -Script "pathtags.py" -NeedData @("catalog.json")
Invoke-PipeStep -Name "spellids" -Script "spellids.py" -NeedData @("CatalogData.lua", "catalog.json")
Invoke-PipeStep -Name "methods" -Script "methods.py" -NeedData @(
    "catalog.json", "scaling.json", "mechanics.json",
    "relations.json", "basemods.json", "spellids.json"
)

$minerOk = $false
$minerCandidates = New-Object System.Collections.Generic.List[string]
[void]$minerCandidates.Add("data\DataMinerCatalog.lua")
if ($env:SEASON10_DIR) {
    [void]$minerCandidates.Add((Join-Path $env:SEASON10_DIR "DataMinerCatalog.lua"))
}
[void]$minerCandidates.Add((Join-Path (Split-Path $Root -Parent) "_tmp_Season10Builder\DataMinerCatalog.lua"))
[void]$minerCandidates.Add("_tmp_Season10Builder\DataMinerCatalog.lua")
foreach ($m in $minerCandidates) {
    if (Test-Path -LiteralPath $m) {
        $minerOk = $true
        break
    }
}
if ($minerOk) {
    Invoke-PipeStep -Name "spectags" -Script "spectags.py" -NeedData @("catalog.json", "spellids.json")
} else {
    Write-Host "SKIP spectags - DataMinerCatalog.lua not found (data/ or SEASON10_DIR)"
    $script:Skipped++
}

Invoke-PipeStep -Name "desireelig" -Script "desireelig.py" -NeedData @("CatalogData.lua", "catalog.json")
Invoke-PipeStep -Name "pathreq" -Script "pathreq.py" -NeedData @("catalog.json", "CatalogData.lua")

$tagTypes = Join-Path $DBC "SpellTagTypes.dbc"
$tagSpell = Join-Path $DBC "SpellTags.dbc"
Invoke-PipeStep -Name "tagnames" -Script "tagnames.py" `
    -NeedData @("spellids.json") `
    -NeedFiles @($tagTypes, $tagSpell) `
    -SkipReason "SpellTagTypes/SpellTags.dbc not under DBC dir"

# itemicons.py writes {} and exits 0 if DBC missing
Invoke-PipeStep -Name "itemicons" -Script "itemicons.py"

# AE/TE essence icons (patch sprite.webp extra{} — no full mksprite rebuild)
Invoke-PipeStep -Name "essicons" -Script "essicons.py" -NeedData @("sprite.webp", "spriteindex.json")

$ssugSp = Join-Path $DBC "SpellSpellSuggestions.dbc"
Invoke-PipeStep -Name "spellsuggest" -Script "spellsuggest.py" `
    -NeedData @("catalog.json", "spellids.json") `
    -NeedFiles @($ssugSp) `
    -SkipReason "SpellSpellSuggestions.dbc missing"

$ssug = Join-Path $DBC "SpellStatSuggestions.dbc"
Invoke-PipeStep -Name "statsuggest" -Script "statsuggest.py" `
    -NeedData @("catalog.json", "spellids.json") `
    -NeedFiles @($ssug) `
    -SkipReason "SpellStatSuggestions.dbc missing"

$beforeRan = $script:Ran
Invoke-PipeStep -Name "sync_tooltips" -Script "sync_tooltips.py" `
    -NeedData @("catalog.json", "spellids.json") `
    -NeedFiles @($SPELL_DBC) `
    -SkipReason "Spell.dbc missing (set ASCENSION_SPELL_DBC)"
$syncRan = ($script:Ran -gt $beforeRan)

if ($syncRan) {
    Write-Host "==> scaling (re-run after sync_tooltips)"
    & $py pipeline/scaling.py
    if ($LASTEXITCODE -ne 0) {
        Write-Host "FAIL scaling re-run"
        $script:Failed++
    } else {
        Write-Host "OK scaling re-run"
        $script:Ran++
        Write-Host "==> pathtags (re-run after scaling)"
        & $py pipeline/pathtags.py
        if ($LASTEXITCODE -ne 0) {
            Write-Host "FAIL pathtags re-run"
            $script:Failed++
        } else {
            Write-Host "OK pathtags re-run"
            $script:Ran++
        }
    }
}

$extractIcons = "C:\Users\x\Documents\AscensionInterfaceExtract\by-archive"
Invoke-PipeStep -Name "essicons" -Script "essicons.py" `
    -NeedData @("sprite.webp", "spriteindex.json") `
    -NeedFiles @($extractIcons) `
    -SkipReason "Interface-Extract missing (AE/TE BLP)"

Write-Host ""
Write-Host ("pipeline-all: ran={0} skipped={1} failed={2}" -f $script:Ran, $script:Skipped, $script:Failed)
if ($script:Failed -gt 0) { exit 1 }
