#!/usr/bin/env bash
# Syntax checks: builder-app.js + optional luac on addon Lua
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

fail=0

echo "==> JS syntax (src/builder-app.js)"
if ! command -v node >/dev/null 2>&1; then
  echo "SKIP: node not on PATH"
else
  if node -e "new Function(require('fs').readFileSync('src/builder-app.js','utf8'))"; then
    echo "OK: builder-app.js"
  else
    echo "FAIL: builder-app.js"
    fail=1
  fi
fi

find_luac() {
  for c in luac5.1 luac; do
    if command -v "$c" >/dev/null 2>&1; then
      command -v "$c"
      return 0
    fi
  done
  return 1
}

shopt -s nullglob
lua_files=(addon/AscBuildschmiede/*.lua)
shopt -u nullglob

if ! luac_bin="$(find_luac)"; then
  echo "SKIP: luac/luac5.1 not found (addon Lua unchecked)"
elif [ "${#lua_files[@]}" -eq 0 ]; then
  echo "SKIP: no addon/AscBuildschmiede/*.lua"
else
  echo "==> luac ($luac_bin) on ${#lua_files[@]} Lua files"
  for f in "${lua_files[@]}"; do
    if "$luac_bin" -p "$f"; then
      echo "OK: $(basename "$f")"
    else
      echo "FAIL: $(basename "$f")"
      fail=1
    fi
  done
fi

if [ "$fail" -ne 0 ]; then
  exit 1
fi
echo "OK: check passed"
