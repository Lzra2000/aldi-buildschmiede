#!/usr/bin/env bash
# Run offline data pipelines in order; skip client-DBC steps when paths missing.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

py() {
  if command -v python3 >/dev/null 2>&1; then
    python3 "$@"
  elif command -v python >/dev/null 2>&1; then
    python "$@"
  else
    echo "python3/python not found on PATH" >&2
    exit 1
  fi
}

DBC="${ASCENSION_DBC:-$HOME/Documents/AscensionDBC/DBFilesClient}"
SPELL_DBC="${ASCENSION_SPELL_DBC:-$HOME/Documents/AscensionDBC/patch-T/DBFilesClient/Spell.dbc}"

ran=0
skipped=0
failed=0

need_data() {
  local n
  for n in "$@"; do
    [ -f "data/$n" ] || return 1
  done
  return 0
}

need_files() {
  local f
  for f in "$@"; do
    [ -f "$f" ] || return 1
  done
  return 0
}

run_step() {
  local name="$1" script="$2"
  local path="pipeline/$script"
  if [ ! -f "$path" ]; then
    echo "SKIP $name — missing $path"
    skipped=$((skipped + 1))
    return
  fi
  echo "==> $name ($script)"
  if py "$path"; then
    echo "OK $name"
    ran=$((ran + 1))
  else
    echo "FAIL $name"
    failed=$((failed + 1))
  fi
}

echo "DBC dir: $DBC"
echo ""

if need_data catalog.json relations.json; then
  run_step modifiers modifiers.py
else
  echo "SKIP modifiers — need data/catalog.json + relations.json"
  skipped=$((skipped + 1))
fi

if need_data catalog.json; then
  run_step scaling scaling.py
  run_step pathtags pathtags.py
else
  echo "SKIP scaling/pathtags — need data/catalog.json"
  skipped=$((skipped + 2))
fi

if need_data CatalogData.lua catalog.json; then
  run_step spellids spellids.py
else
  echo "SKIP spellids — need data/CatalogData.lua"
  skipped=$((skipped + 1))
fi

if need_data catalog.json scaling.json mechanics.json relations.json basemods.json spellids.json; then
  run_step methods methods.py
else
  echo "SKIP methods — need scaling/mechanics/basemods/spellids (+ catalog/relations)"
  skipped=$((skipped + 1))
fi

miner_ok=0
if [ -f "data/DataMinerCatalog.lua" ]; then miner_ok=1; fi
if [ "$miner_ok" -eq 0 ] && [ -n "${SEASON10_DIR:-}" ] && [ -f "$SEASON10_DIR/DataMinerCatalog.lua" ]; then
  miner_ok=1
fi
if [ "$miner_ok" -eq 0 ] && [ -f "$(dirname "$ROOT")/_tmp_Season10Builder/DataMinerCatalog.lua" ]; then
  miner_ok=1
fi
if [ "$miner_ok" -eq 0 ] && [ -f "_tmp_Season10Builder/DataMinerCatalog.lua" ]; then
  miner_ok=1
fi
if [ "$miner_ok" -eq 1 ] && need_data catalog.json spellids.json; then
  run_step spectags spectags.py
else
  echo "SKIP spectags — DataMinerCatalog.lua not found (data/ or SEASON10_DIR)"
  skipped=$((skipped + 1))
fi

if need_data CatalogData.lua catalog.json; then
  run_step desireelig desireelig.py
  run_step pathreq pathreq.py
else
  echo "SKIP desireelig/pathreq — need data/CatalogData.lua"
  skipped=$((skipped + 2))
fi

if need_data spellids.json && need_files "$DBC/SpellTagTypes.dbc" "$DBC/SpellTags.dbc"; then
  run_step tagnames tagnames.py
else
  echo "SKIP tagnames — SpellTagTypes/SpellTags.dbc not under DBC dir"
  skipped=$((skipped + 1))
fi

run_step itemicons itemicons.py

if need_data catalog.json spellids.json && need_files "$DBC/SpellSpellSuggestions.dbc"; then
  run_step spellsuggest spellsuggest.py
else
  echo "SKIP spellsuggest — SpellSpellSuggestions.dbc missing"
  skipped=$((skipped + 1))
fi

if need_data catalog.json spellids.json && need_files "$DBC/SpellStatSuggestions.dbc"; then
  run_step statsuggest statsuggest.py
else
  echo "SKIP statsuggest — SpellStatSuggestions.dbc missing"
  skipped=$((skipped + 1))
fi

sync_ran=0
before=$ran
if need_data catalog.json spellids.json && need_files "$SPELL_DBC"; then
  run_step sync_tooltips sync_tooltips.py
  if [ "$ran" -gt "$before" ]; then sync_ran=1; fi
else
  echo "SKIP sync_tooltips — Spell.dbc missing (set ASCENSION_SPELL_DBC)"
  skipped=$((skipped + 1))
fi

if [ "$sync_ran" -eq 1 ]; then
  echo "==> scaling (re-run after sync_tooltips)"
  if py pipeline/scaling.py; then
    echo "OK scaling re-run"
    ran=$((ran + 1))
    echo "==> pathtags (re-run after scaling)"
    if py pipeline/pathtags.py; then
      echo "OK pathtags re-run"
      ran=$((ran + 1))
    else
      echo "FAIL pathtags re-run"
      failed=$((failed + 1))
    fi
  else
    echo "FAIL scaling re-run"
    failed=$((failed + 1))
  fi
fi

AE_BLP="${ASCENSION_AE_BLP:-/c/Users/x/Documents/AscensionInterfaceExtract/by-archive/patch-I.MPQ/Interface/icons/inv_custom_abilityessence.blp}"
if need_data sprite.webp spriteindex.json && need_files "$AE_BLP"; then
  run_step essicons essicons.py
else
  echo "SKIP essicons — Interface-Extract missing (AE/TE BLP)"
  skipped=$((skipped + 1))
fi

echo ""
echo "pipeline-all: ran=$ran skipped=$skipped failed=$failed"
[ "$failed" -eq 0 ] || exit 1
