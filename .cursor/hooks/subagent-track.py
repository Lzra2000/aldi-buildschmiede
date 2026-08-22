#!/usr/bin/env python3
"""Track subagent start times for stall detection (hook helper)."""

from __future__ import annotations

import json
import sys
import time
from pathlib import Path

TRACK_FILE = Path(__file__).resolve().parent / ".agent-track.json"
STALL_SECONDS = 180


def _read_track() -> dict:
    if not TRACK_FILE.exists():
        return {}
    try:
        return json.loads(TRACK_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _write_track(data: dict) -> None:
    TRACK_FILE.parent.mkdir(parents=True, exist_ok=True)
    TRACK_FILE.write_text(json.dumps(data, indent=2), encoding="utf-8")


def on_start(payload: dict) -> None:
    agent_id = (
        payload.get("agent_id")
        or payload.get("subagent_id")
        or payload.get("id")
        or payload.get("conversation_id")
        or "unknown"
    )
    data = _read_track()
    data[str(agent_id)] = {
        "started_at": time.time(),
        "subagent_type": payload.get("subagent_type") or payload.get("type"),
    }
    _write_track(data)


def on_stop(payload: dict) -> dict | None:
    agent_id = (
        payload.get("agent_id")
        or payload.get("subagent_id")
        or payload.get("id")
        or payload.get("conversation_id")
        or "unknown"
    )
    data = _read_track()
    entry = data.pop(str(agent_id), None)
    _write_track(data)

    if not entry:
        return None

    elapsed = time.time() - float(entry.get("started_at", time.time()))
    status = (payload.get("status") or payload.get("result") or "").lower()
    failed = status in {"failed", "error", "timeout", "cancelled", "interrupted"}

    if elapsed >= STALL_SECONDS or failed:
        return {
            "elapsed_seconds": round(elapsed, 1),
            "subagent_type": entry.get("subagent_type"),
            "failed": failed,
        }
    return None


def main() -> int:
    if len(sys.argv) < 2:
        return 1
    mode = sys.argv[1]
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {}

    if mode == "start":
        on_start(payload)
        return 0
    if mode == "stop":
        info = on_stop(payload)
        if info:
            print(json.dumps(info))
        return 0
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
