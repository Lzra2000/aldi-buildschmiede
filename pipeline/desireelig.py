# -*- coding: utf-8 -*-
"""Desire-Board-Eligibility aus CatalogData.lua.

Season10Builder / ascension.nie.one liefert pro Katalogzeile das Flag
``desiredEligible`` (letztes Feld). Es markiert, ob ein Eintrag auf der
Wildcard-Desire-Liste / Rapid-Roll erscheinen kann — unabhaengig von der
persoenlichen Desire/Undesire-Wunschliste im Addon-Export.

Bisher ungenutzt: catalog.json streicht das Feld, spellids.json auch.
2967 true / 104 false (Stand CatalogData 2026-07-27). Die false-Zeilen
sind vor allem Basiskit, Runen, Formen und einzelne Stormbringer-Eintraege
— ehrlich anzeigen statt raten.

Ausgabe: data/desireelig.json — paralleles Array [0|1] zum Katalogindex.
"""
from __future__ import print_function

import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
SRC = os.path.join(DATA, "CatalogData.lua")

ROW = re.compile(
    r'^\s*\{\s*"(Spell|Talent)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
    r'(nil|\d+)\s*,\s*(nil|\d+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*,'
)


def unescape(s):
    return s.replace('\\"', '"').replace("\\\\", "\\")


def main():
    lines = io.open(SRC, encoding="utf-8").read().splitlines()
    # Index ueber (kind, name, class, level) wie spellids.py
    by_key = {}
    n = 0
    for ln in lines:
        m = ROW.match(ln)
        if not m:
            continue
        kind, name, _sid, _eid, cls = m.groups()
        body = ln.rstrip().rstrip(",").rstrip()
        if body.endswith("}"):
            body = body[:-1]
        parts = [p.strip() for p in body.split(",")]
        if len(parts) < 2:
            continue
        desired = 1 if parts[-1] == "true" else 0
        level = int(parts[-2]) if parts[-2].lstrip("-").isdigit() else 0
        key = (1 if kind == "Talent" else 0,
               unescape(name).lower(),
               unescape(cls).lower(),
               level)
        by_key.setdefault(key, []).append(desired)
        n += 1

    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    out = []
    miss = 0
    for c in cat:
        key = (c[1], c[0].lower(), c[2].lower(), c[4])
        rows = by_key.get(key)
        if not rows:
            # Level kann abweichen — Name+Klasse+Art
            for k, v in by_key.items():
                if k[0] == c[1] and k[1] == c[0].lower() and k[2] == c[2].lower():
                    rows = v
                    break
        if rows:
            out.append(rows[0])
        else:
            out.append(1)  # fehlend: nicht verstecken
            miss += 1

    dest = os.path.join(DATA, "desireelig.json")
    io.open(dest, "w", encoding="utf-8").write(
        json.dumps(out, separators=(",", ":"))
    )
    yes = sum(1 for x in out if x)
    no = len(out) - yes
    print("CatalogData-Zeilen:", n)
    print("Katalog:", len(cat), "| desireEligible 1:", yes, "| 0:", no,
          "| unmatched:", miss)
    print("Geschrieben:", dest)
    samples = [i for i, v in enumerate(out) if not v][:8]
    for i in samples:
        print("  false:", cat[i][0], "|", cat[i][2])


if __name__ == "__main__":
    main()
