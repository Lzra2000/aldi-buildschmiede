#!/usr/bin/env bash
# package-addon.sh — luac check, AscBuildschmiede.zip, optional live sync
# Usage:
#   ./scripts/package-addon.sh
#   ./scripts/package-addon.sh --live
#   ./scripts/package-addon.sh --no-live

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADDON_SRC="$REPO_ROOT/addon/AscBuildschmiede"
ZIP_OUT="$REPO_ROOT/AscBuildschmiede.zip"
LIVE_DEFAULT="/c/Ascension/Launcher/resources/ascension-live/Interface/AddOns/AscBuildschmiede"
# Also accept Windows path via env when run under Git Bash / WSL mounts

DO_LIVE=""
NO_LIVE=""
for arg in "$@"; do
  case "$arg" in
    --live|-live) DO_LIVE=1 ;;
    --no-live|-no-live) NO_LIVE=1 ;;
    -h|--help)
      echo "Usage: $0 [--live|--no-live]"
      exit 0
      ;;
    *)
      echo "Unknown arg: $arg" >&2
      exit 1
      ;;
  esac
done

resolve_luac() {
  if command -v luac5.1 >/dev/null 2>&1; then
    command -v luac5.1
    return
  fi
  if command -v luac >/dev/null 2>&1; then
    command -v luac
    return
  fi
  echo "luac5.1 / luac not found" >&2
  exit 1
}

if [[ ! -d "$ADDON_SRC" ]]; then
  echo "Addon source missing: $ADDON_SRC" >&2
  exit 1
fi

LUAC="$(resolve_luac)"
echo "Using luac: $LUAC"

shopt -s nullglob
lua_files=("$ADDON_SRC"/*.lua)
if [[ ${#lua_files[@]} -eq 0 ]]; then
  echo "No .lua files under $ADDON_SRC" >&2
  exit 1
fi

for f in "${lua_files[@]}"; do
  echo "luac -p $(basename "$f")"
  "$LUAC" -p "$f"
done
echo "All Lua files OK (${#lua_files[@]})."

STAGING="$(mktemp -d)"
cleanup() { rm -rf "$STAGING"; }
trap cleanup EXIT

mkdir -p "$STAGING/AscBuildschmiede"
cp -a "$ADDON_SRC"/. "$STAGING/AscBuildschmiede/"

rm -f "$ZIP_OUT"
(
  cd "$STAGING"
  if command -v zip >/dev/null 2>&1; then
    zip -r -q "$ZIP_OUT" AscBuildschmiede
  else
    # Fallback: Python stdlib
    python3 - "$ZIP_OUT" <<'PY'
import sys, zipfile, os
out = sys.argv[1]
root = "AscBuildschmiede"
with zipfile.ZipFile(out, "w", zipfile.ZIP_DEFLATED) as zf:
    for dirpath, _, files in os.walk(root):
        for name in files:
            path = os.path.join(dirpath, name)
            zf.write(path, path.replace("\\", "/"))
print("Wrote", out)
PY
  fi
)
echo "Wrote $ZIP_OUT"

if [[ -n "$NO_LIVE" ]]; then
  echo "Live sync skipped (--no-live)."
elif [[ -n "$DO_LIVE" || "${ASC_BUILDSCHMIEDE_LIVE:-}" == "1" ]]; then
  LIVE_PATH="${ASC_BUILDSCHMIEDE_LIVE_PATH:-$LIVE_DEFAULT}"
  # Windows default when running in Git Bash
  if [[ ! -d "$(dirname "$LIVE_PATH")" && -d "/c/Ascension/Launcher/resources/ascension-live/Interface/AddOns" ]]; then
    LIVE_PATH="/c/Ascension/Launcher/resources/ascension-live/Interface/AddOns/AscBuildschmiede"
  fi
  LIVE_PARENT="$(dirname "$LIVE_PATH")"
  if [[ ! -d "$LIVE_PARENT" ]]; then
    echo "Live AddOns parent missing, skip sync: $LIVE_PARENT" >&2
  else
    rm -rf "$LIVE_PATH"
    mkdir -p "$LIVE_PATH"
    cp -a "$ADDON_SRC"/. "$LIVE_PATH/"
    echo "Synced live AddOn → $LIVE_PATH"
  fi
elif [[ -d "/c/Ascension/Launcher/resources/ascension-live/Interface/AddOns" ]]; then
  LIVE_PATH="/c/Ascension/Launcher/resources/ascension-live/Interface/AddOns/AscBuildschmiede"
  rm -rf "$LIVE_PATH"
  mkdir -p "$LIVE_PATH"
  cp -a "$ADDON_SRC"/. "$LIVE_PATH/"
  echo "Synced live AddOn → $LIVE_PATH"
else
  echo "Live sync skipped (pass --live or set ASC_BUILDSCHMIEDE_LIVE=1)."
fi

echo "Done."
