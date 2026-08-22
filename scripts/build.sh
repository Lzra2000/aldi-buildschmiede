#!/usr/bin/env bash
# Build site artifacts: index.html + synergien.html via assemble.py
set -euo pipefail
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

echo "==> assemble (pipeline/assemble.py)"
py pipeline/assemble.py
echo "OK: index.html / synergien.html"
