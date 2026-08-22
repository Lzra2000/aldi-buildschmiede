# -*- coding: utf-8 -*-
"""Zieht die echten Spell-IDs aus CatalogData.lua.

Bisher wurde Spell.dbc ueber den Namen befragt. Das geht schief, sobald ein
Name mehrfach vorkommt: "Charge" gibt es als Krieger-Ansturm und als
Jaeger-Petfaehigkeit, und die Heuristik hat den Pet-Spell gewaehlt -
daher "35 Fokus" fuer eine Kriegerfaehigkeit.

Die Quelle hat die ID die ganze Zeit mitgeliefert:
  Feldreihenfolge: kind, name, spellId, entryId, class, rank, description,
                   quality, castMs, minRange, maxRange, passive, level, ...

Ausgabe spellids.json: Katalogindex -> [spellId, castMs, minRange, maxRange,
passive] - nur belegte Felder, Rest 0/false.
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
SRC = os.path.join(DATA, "CatalogData.lua")

# Ein Datensatz ist eine Zeile { "Spell", "Name", 123, 456, ... }.
# Beschreibungen enthalten Kommata und Anfuehrungszeichen, deshalb wird
# nur der stabile Kopf geparst und der Rest an bekannten Positionen
# nachgezaehlt.
ROW = re.compile(r'^\s*\{\s*"(Spell|Talent)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
                 r'(nil|\d+)\s*,\s*(nil|\d+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*,')


def unescape(s):
    return s.replace('\\"', '"').replace("\\\\", "\\")


def tail_fields(line):
    """castMs, minRange, maxRange, passive, level stehen hinter der
    Beschreibung. Von hinten zaehlen ist robuster als von vorne."""
    body = line.rstrip().rstrip(",").rstrip()
    if body.endswith("}"):
        body = body[:-1]
    parts = [p.strip() for p in body.split(",")]
    return parts


def main():
    lines = io.open(SRC, encoding="utf-8").read().splitlines()
    recs = []
    for ln in lines:
        m = ROW.match(ln)
        if not m:
            continue
        kind, name, spellId, entryId, cls = m.groups()
        parts = tail_fields(ln)
        # Von hinten: ..., quality, castMs, minRange, maxRange, passive,
        #             level, desiredEligible
        cast = rmin = rmax = 0
        passive = False
        level = 0
        try:
            if len(parts) >= 7:
                level = int(parts[-2]) if parts[-2].isdigit() else 0
                passive = parts[-3] == "true"
                rmax = int(parts[-4]) if parts[-4].lstrip("-").isdigit() else 0
                rmin = int(parts[-5]) if parts[-5].lstrip("-").isdigit() else 0
                cast = int(parts[-6]) if parts[-6].lstrip("-").isdigit() else 0
        except (ValueError, IndexError):
            pass
        recs.append({
            "kind": 1 if kind == "Talent" else 0,
            "name": unescape(name),
            "spellId": int(spellId) if spellId != "nil" else 0,
            "entryId": int(entryId) if entryId != "nil" else 0,
            "cls": unescape(cls),
            "cast": cast, "rmin": rmin, "rmax": rmax,
            "passive": passive, "level": level,
        })

    print("Datensaetze in CatalogData.lua:", len(recs))
    print("davon mit spellId:", sum(1 for r in recs if r["spellId"]))

    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    print("Katalog:", len(cat))

    # Zuordnung ueber (kind, name, klasse, level) - eindeutig genug, weil
    # der Katalog aus genau dieser Quelle gebaut wurde.
    index = {}
    for r in recs:
        key = (r["kind"], r["name"].lower(), r["cls"].lower(), r["level"])
        index.setdefault(key, []).append(r)

    out = []
    hit = miss = 0
    for c in cat:
        key = (c[1], c[0].lower(), c[2].lower(), c[4])
        rows = index.get(key)
        if not rows:
            # Zweitversuch ohne Level - die Katalogstufe kann abweichen.
            rows = index.get((c[1], c[0].lower(), c[2].lower(), c[4]))
            if not rows:
                for k, v in index.items():
                    if k[0] == c[1] and k[1] == c[0].lower() and k[2] == c[2].lower():
                        rows = v
                        break
        if rows:
            r = rows[0]
            out.append([r["spellId"], r["cast"], r["rmin"], r["rmax"],
                        1 if r["passive"] else 0])
            hit += 1
        else:
            out.append([0, 0, 0, 0, 0])
            miss += 1

    io.open(os.path.join(DATA, "spellids.json"), "w", encoding="utf-8").write(
        json.dumps(out, separators=(",", ":"))
    )
    print("zugeordnet: %d, ohne Treffer: %d" % (hit, miss))
    withid = sum(1 for o in out if o[0])
    print("mit echter spellId:", withid)
    print("mit castMs:", sum(1 for o in out if o[1]))
    print("passiv:", sum(1 for o in out if o[4]))
    print("\nStichprobe:")
    for i in (0, 1, 393):
        print("  %-22s id=%-9d cast=%-5d range=%d-%d passive=%d"
              % (cat[i][0][:22], out[i][0], out[i][1], out[i][2], out[i][3], out[i][4]))


if __name__ == "__main__":
    main()
