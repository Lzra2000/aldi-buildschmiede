# -*- coding: utf-8 -*-
"""Offline Path-Hinweise aus SpellStatSuggestions.dbc.

Spiegelt die Client-Tabelle, die hinter Path-Empfehlungen steht — ohne
GetSuggestedStats und ohne erfundene Koeffizienten. Nur Katalog-Treffer.

DBC-Layout (WDBC, 4 Felder): rowId, spellId, pathCode, flag(=1).

pathCode ist NICHT Enum.PrimaryStat (1/2/3/4/6), sondern:

    0 Strength
    1 Agility
    3 Intelligence
    4 Healing   (Client: Spirit / Healing-Path)

Verifiziert an Klassenspells (Frostbolt→3, Backstab→1, Charge→0, Renew→4).
Duality (6) kommt in der DBC nicht vor — fehlende Eintraege bleiben null.

Ausgabe: data/statsuggest.json — paralleles Array ("" wenn unbekannt).
Einbettung optional als D.ssug (assemble OPTIONAL_PAYLOAD).

    python3 pipeline/statsuggest.py
"""
from __future__ import print_function

import collections
import io
import json
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
DBC = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
SUGGEST = os.path.join(DBC, "SpellStatSuggestions.dbc")

# DBC-Code → Anzeigename wie PATH| / SUGGEST| im Addon-Export.
PATH_FROM_DBC = {
    0: "Strength",
    1: "Agility",
    3: "Intelligence",
    4: "Healing",
}


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        if magic != b"WDBC":
            raise SystemExit("not WDBC: %s" % path)
        data = fh.read(rc * rs)
        strings = fh.read(sbs)
    return rc, fc, rs, data, strings


def load_suggestions():
    """spellId -> pathName (erster Treffer gewinnt)."""
    if not os.path.isfile(SUGGEST):
        raise SystemExit("fehlt: %s" % SUGGEST)
    rc, fc, rs, data, _ = read_dbc(SUGGEST)
    if fc < 4:
        raise SystemExit("SpellStatSuggestions: erwartete >=4 Felder, got %d" % fc)
    out = {}
    codes = collections.Counter()
    for i in range(rc):
        _rid, spell_id, path_code, _flag = struct.unpack_from("<iiii", data, i * rs)
        codes[path_code] += 1
        if spell_id in out:
            continue
        name = PATH_FROM_DBC.get(path_code)
        if name:
            out[spell_id] = name
    return out, codes, rc


def main():
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    ids = json.load(io.open(os.path.join(DATA, "spellids.json"), encoding="utf-8"))
    if len(cat) != len(ids):
        raise SystemExit("catalog/spellids Laengen drift")

    by_sid, codes, raw_n = load_suggestions()
    rows = []
    hit = 0
    by_path = collections.Counter()
    for i, row in enumerate(ids):
        sid = int(row[0] or 0)
        path = by_sid.get(sid, "")
        rows.append(path)
        if path:
            hit += 1
            by_path[path] += 1

    out = {
        "v": 1,
        "source": "SpellStatSuggestions.dbc",
        "dbcCodes": {str(k): PATH_FROM_DBC[k] for k in sorted(PATH_FROM_DBC)},
        "note": (
            "Path-Hinweis pro Katalogeintrag aus SpellStatSuggestions.dbc. "
            "DBC-Codes 0/1/3/4 ≠ Enum.PrimaryStat 1/2/3/4/6. "
            "Kein Duality in der Tabelle. Keine erfundenen Werte — "
            "leerer String = kein Eintrag."
        ),
        "catalogSize": len(cat),
        "tagged": hit,
        "dbcRows": raw_n,
        "dbcCodeCounts": {str(k): codes[k] for k in sorted(codes)},
        "byPath": dict(by_path),
        "path": rows,
    }

    dest = os.path.join(DATA, "statsuggest.json")
    io.open(dest, "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    )
    print("Geschrieben:", dest)
    print("  Katalog-Treffer: %d / %d" % (hit, len(cat)))
    print("  byPath:", dict(by_path))
    print("  DBC code counts:", dict(codes))


if __name__ == "__main__":
    main()
