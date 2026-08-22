#!/usr/bin/env python3
"""subagentStart hook: record start time for stall detection."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

TRACK_SCRIPT = Path(__file__).resolve().parent / "subagent-track.py"


def main() -> int:
    try:
        payload = json.load(sys.stdin)
    except json.JSONDecodeError:
        payload = {}

    try:
        subprocess.run(
            [sys.executable, str(TRACK_SCRIPT), "start"],
            input=json.dumps(payload),
            capture_output=True,
            text=True,
            timeout=5,
        )
    except (subprocess.SubprocessError, OSError):
        pass

    print("{}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
