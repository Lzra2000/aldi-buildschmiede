#!/usr/bin/env python3
"""Empfiehlt ein schnelleres Task-Modell bei Stall — nur erlaubte Cursor-Modelle."""

from __future__ import annotations

import argparse
import json
import sys

ALLOWED = frozenset(
    {
        "cursor-grok-4.6-high-fast",
        "composer-2.5-fast",
        "cursor-grok-4.5-high-fast",
        "claude-opus-5-thinking-high",
        "gpt-5.6-sol-medium",
        "inherit",
    }
)

WORK_TYPES = {
    "ui_css": "UI / CSS / Copy / Encoding / Organize",
    "js_lua": "JS / Lua Bugfix / Verify",
    "calc_re": "Calc / RE / Path-Scoring / Methods",
    "explore": "Explore / read-only search",
    "shell": "Shell / Git read-only",
    "docs": "Docs / NOTES",
}

# Erststart immer grok-4.6; Fallback-Stufen pro Arbeitstyp
FALLBACK_CHAIN: dict[str, list[str]] = {
    "ui_css": ["composer-2.5-fast"],
    "js_lua": ["composer-2.5-fast", "cursor-grok-4.5-high-fast"],
    "calc_re": ["cursor-grok-4.5-high-fast"],
    "explore": ["composer-2.5-fast"],
    "shell": ["composer-2.5-fast"],
    "docs": ["composer-2.5-fast"],
}

DEFAULT_START = "cursor-grok-4.6-high-fast"
STALL_SECONDS = 180  # ~3 min — exported for hooks


def pick_fallback(work: str, current: str) -> str:
    chain = FALLBACK_CHAIN.get(work, ["composer-2.5-fast"])
    for model in chain:
        if model != current:
            return model
    return chain[-1] if chain else "composer-2.5-fast"


def build_advice(work: str, current: str, reason: str) -> dict:
    nxt = pick_fallback(work, current)
    return {
        "work": work,
        "work_label": WORK_TYPES.get(work, work),
        "current_model": current,
        "recommended_model": nxt,
        "reason": reason,
        "action": "interrupt_slow_task_then_launch_new_task",
        "do_not": ["resume_slow_agent", "claude-opus-5-thinking-high_for_speed"],
        "stall_threshold_seconds": STALL_SECONDS,
        "parent_steps": [
            "Langsamen Background-Task interrupten (kein paralleles Schreiben).",
            f"Neuen Task mit model={nxt!r} starten — gleicher Prompt + Kontext.",
            "Lane-Disziplin einhalten; Multitask + Debug im Hintergrund weiter.",
        ],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description="Task-Modell-Fallback für langsame Subagents")
    parser.add_argument("--work", choices=sorted(WORK_TYPES), help="Arbeitstyp der Lane")
    parser.add_argument("--from", dest="current", default=DEFAULT_START, help="Aktuelles Modell")
    parser.add_argument(
        "--reason",
        default="stall",
        choices=("stall", "interrupt", "timeout", "no_progress"),
        help="Warum neu gestartet wird",
    )
    parser.add_argument("--list-work", action="store_true", help="Arbeitstypen anzeigen")
    parser.add_argument("--json", action="store_true", help="Nur JSON ausgeben")
    args = parser.parse_args()

    if args.list_work:
        for key, label in sorted(WORK_TYPES.items()):
            chain = FALLBACK_CHAIN.get(key, [])
            print(f"{key:10} {label:40} fallback: {', '.join(chain) or '—'}")
        return 0

    if not args.work:
        parser.error("--work ist erforderlich (oder --list-work)")

    if args.current not in ALLOWED:
        print(f"Warnung: {args.current!r} nicht in erlaubter Liste", file=sys.stderr)

    advice = build_advice(args.work, args.current, args.reason)

    if args.json:
        print(json.dumps(advice, indent=2, ensure_ascii=False))
    else:
        print(f"Arbeit:     {advice['work_label']} ({advice['work']})")
        print(f"Aktuell:    {advice['current_model']}")
        print(f"Grund:      {advice['reason']}")
        print(f"-> Neu-Task: {advice['recommended_model']}")
        print()
        for i, step in enumerate(advice["parent_steps"], 1):
            print(f"  {i}. {step}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
