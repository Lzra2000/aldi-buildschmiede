#!/usr/bin/env python3
"""subagentStop hook: remind parent to relaunch slow tasks on faster models."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

HOOKS_DIR = Path(__file__).resolve().parent
TRACK_SCRIPT = HOOKS_DIR / "subagent-track.py"
STALL_SECONDS = 180


def _run_track_stop(payload: dict) -> dict | None:
    try:
        proc = subprocess.run(
            [sys.executable, str(TRACK_SCRIPT), "stop"],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.stdout.strip():
            return json.loads(proc.stdout.strip())
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        pass
    return None


def _guess_work(payload: dict, subagent_type: str | None) -> str:
    prompt = (payload.get("prompt") or payload.get("task") or "").lower()
    if any(k in prompt for k in ("css", "synergien", "html", "chrome", "ui", "copy")):
        return "ui_css"
    if any(k in prompt for k in ("lua", "builder-app", "javascript", "verify", "syntax")):
        return "js_lua"
    if any(k in prompt for k in ("dbc", "scaling", "methods", "calc", "reverse", "pathreq")):
        return "calc_re"
    if subagent_type == "shell":
        return "shell"
    if subagent_type == "explore":
        return "explore"
    return "js_lua"


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        print("{}")
        return 0

    info = _run_track_stop(payload)
    if not info:
        print("{}")
        return 0

    work = _guess_work(payload, info.get("subagent_type"))
    script = HOOKS_DIR.parent / "scripts" / "agent-speed-fallback.py"

    recommended = "composer-2.5-fast"
    try:
        proc = subprocess.run(
            [
                sys.executable,
                str(script),
                "--work",
                work,
                "--from",
                "cursor-grok-4.6-high-fast",
                "--reason",
                "timeout" if info.get("failed") else "stall",
                "--json",
            ],
            capture_output=True,
            text=True,
            timeout=5,
        )
        if proc.stdout.strip():
            recommended = json.loads(proc.stdout.strip()).get("recommended_model", recommended)
    except (subprocess.SubprocessError, json.JSONDecodeError, OSError):
        pass

    elapsed = info.get("elapsed_seconds", STALL_SECONDS)
    msg = (
        f"Subagent-Fallback: Laufzeit {elapsed}s"
        + (" (Fehler/Abbruch)" if info.get("failed") else " (langsam)")
        + f". Langsamen Task interrupten, dann NEUEN Task mit model={recommended!r} "
        f"(work={work}). Regel: .cursor/rules/fast-model-fallback.mdc"
    )
    print(json.dumps({"followup_message": msg}, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
