# -*- coding: utf-8 -*-
"""Talentbaum / Spec-Tab aus dem oeffentlichen DataMiner-Katalog.

Season10Builder liefert in DataMinerCatalog.lua neben den Katalogfeldern
drei Extra-Spalten (Tab, Icon, Quelle). Feld 15 ist der Spec-/Schul-Tab
(Holy, Feral, Arms, …) — bei uns bisher ungenutzt.

Zuordnung gegen unseren Katalog:
  1. (Name, Klasse) — eindeutig bei Klassenfaehigkeiten
  2. spellId aus spellids.json — Fallback bei Namensabweichungen

Classless-Eintraege bleiben meist leer (DataMiner kennt kaum Wildcard-
Sonderfaehigkeiten). Keine erfundenen Tabs.

Quelle (eine davon):
  data/DataMinerCatalog.lua
  $SEASON10_DIR/DataMinerCatalog.lua
  ../_tmp_Season10Builder/DataMinerCatalog.lua

Ausgabe: data/spectags.json — paralleles Array, "" wenn unbekannt.
"""
from __future__ import print_function

import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")

ROW = re.compile(
    r'^\s*\{\s*"(Spell|Talent)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
    r'(nil|\d+)\s*,\s*(nil|\d+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*,'
)


def unescape(s):
    return s.replace('\\"', '"').replace("\\\\", "\\")


def tail_fields(line):
    body = line.rstrip().rstrip(",").rstrip()
    if body.endswith("}"):
        body = body[:-1]
    return [p.strip() for p in body.split(",")]


def find_miner():
    env = os.environ.get("SEASON10_DIR", "").strip()
    candidates = [
        os.path.join(DATA, "DataMinerCatalog.lua"),
        os.path.join(env, "DataMinerCatalog.lua") if env else "",
        os.path.join(os.path.dirname(ROOT), "_tmp_Season10Builder",
                     "DataMinerCatalog.lua"),
        os.path.join(ROOT, "_tmp_Season10Builder", "DataMinerCatalog.lua"),
    ]
    for p in candidates:
        if p and os.path.isfile(p):
            return p
    return None


def load_miner(path):
    """name+class -> tree, spellId -> tree (first wins)."""
    by_nc = {}
    by_sid = {}
    n = 0
    for ln in io.open(path, encoding="utf-8").read().splitlines():
        m = ROW.match(ln)
        if not m:
            continue
        parts = tail_fields(ln)
        if len(parts) < 3:
            continue
        # ..., desiredEligible, tree, icon, source
        tree = parts[-3].strip().strip('"')
        if not tree or tree in ("nil", "None"):
            continue
        name = unescape(m.group(2))
        cls = unescape(m.group(5))
        sid = int(m.group(3)) if m.group(3) != "nil" else 0
        key = (name.lower(), cls.lower())
        if key not in by_nc:
            by_nc[key] = tree
        if sid and sid not in by_sid:
            by_sid[sid] = tree
        n += 1
    return by_nc, by_sid, n


def main():
    src = find_miner()
    if not src:
        print("DataMinerCatalog.lua nicht gefunden.", file=sys.stderr)
        print("Lege die Datei nach data/ oder setze SEASON10_DIR.",
              file=sys.stderr)
        sys.exit(1)

    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    sid_rows = json.load(io.open(os.path.join(DATA, "spellids.json"),
                                 encoding="utf-8"))
    by_nc, by_sid, mined = load_miner(src)
    print("DataMiner:", src)
    print("  Zeilen mit Tab:", mined,
          "| name+class:", len(by_nc), "| spellId:", len(by_sid))

    out = []
    how = {"name+class": 0, "spellId": 0, "miss": 0}
    trees = {}
    for i, c in enumerate(cat):
        tree = by_nc.get((c[0].lower(), c[2].lower()))
        if tree:
            how["name+class"] += 1
        else:
            sid = sid_rows[i][0] if i < len(sid_rows) else 0
            tree = by_sid.get(sid) if sid else None
            if tree:
                how["spellId"] += 1
            else:
                how["miss"] += 1
                tree = ""
        out.append(tree)
        if tree:
            trees[tree] = trees.get(tree, 0) + 1

    dest = os.path.join(DATA, "spectags.json")
    io.open(dest, "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    )
    hit = how["name+class"] + how["spellId"]
    print("zugeordnet: %d / %d (%.1f%%)" % (hit, len(cat), 100.0 * hit / len(cat)))
    print("  via name+class:", how["name+class"],
          "| via spellId:", how["spellId"], "| ohne Tab:", how["miss"])
    print("Tabs:")
    for t in sorted(trees, key=lambda k: (-trees[k], k)):
        print("  %-16s %4d" % (t, trees[t]))
    print("geschrieben:", dest)


if __name__ == "__main__":
    main()
