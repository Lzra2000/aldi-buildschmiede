# -*- coding: utf-8 -*-
"""Offizielle SpellTag-Namen aus SpellTagTypes.dbc.

Ergaenzt die Facetten in method-spelltags.json um lesbare Namen —
ohne Tooltip-Raten (pathtags bleibt getrennt).

    python3 pipeline/tagnames.py

Ausgabe: data/tagnames.json
  { "types": { "8": {"name":"Instant Cast","cat":"…","group":14}, … },
    "bySpell": { "<spellId>": [tagId, …], … } }  # nur Katalog-Spells
"""
from __future__ import print_function

import collections
import io
import json
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
DBC = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
TAGS = os.path.join(DBC, "SpellTags.dbc")
TYPES = os.path.join(DBC, "SpellTagTypes.dbc")


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        assert magic == b"WDBC", (path, magic)
        data = fh.read(rc * rs)
        strings = fh.read(sbs)
    return rc, fc, rs, data, strings


def sref(strings, off):
    if off <= 0 or off >= len(strings):
        return ""
    end = strings.find(b"\x00", off)
    if end < 0:
        end = len(strings)
    return strings[off:end].decode("utf-8", "replace")


def main():
    rc, fc, rs, data, sb = read_dbc(TYPES)
    types = {}
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        tid = row[0]
        types[str(tid)] = {
            "name": sref(sb, row[27]),
            "cat": sref(sb, row[44]),
            "group": row[2],
        }
    print("SpellTagTypes:", len(types))

    ids = json.load(io.open(os.path.join(DATA, "spellids.json"), encoding="utf-8"))
    wanted = set(int(r[0]) for r in ids)

    rc, fc, rs, data, _ = read_dbc(TAGS)
    by_spell = collections.defaultdict(list)
    for i in range(rc):
        _rid, sid, tag = struct.unpack_from("<III", data, i * rs)
        if sid in wanted:
            by_spell[sid].append(tag)

    by_out = {}
    for sid, tags in by_spell.items():
        by_out[str(sid)] = sorted(set(tags))

    dest = os.path.join(DATA, "tagnames.json")
    payload = {
        "source": ["SpellTagTypes.dbc", "SpellTags.dbc"],
        "types": types,
        "bySpell": by_out,
        "catalogTagged": len(by_out),
        "catalogSize": len(ids),
    }
    io.open(dest, "w", encoding="utf-8").write(
        json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    )
    print("Geschrieben:", dest)
    print("  tagged spells:", len(by_out), "/", len(ids))
    # Namen-Stichprobe
    for tid in ("8", "108", "109", "14", "15"):
        print(" ", tid, types.get(tid))


if __name__ == "__main__":
    main()
