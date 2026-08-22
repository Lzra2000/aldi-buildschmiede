# -*- coding: utf-8 -*-
"""Waffen-Evidence aus Item.dbc + ItemAddon.dbc + ItemStat.dbc.

Nur gemessene Felder — kein Tempo/DPS aus der DBC erfinden (Tempo kommt
aus dem Addon-WEAPON-Export). SP/AP-Koeffizienten gibt es hier nicht.

Evidence (Ascension DBFilesClient, 2026-08):

  Item.dbc       classId==2 = Waffe; id, class, subclass, invType
  ItemAddon.dbc  f0=itemId, f2=Name, f36=Qualitaet (0-7), f47=ItemLevel
                 (f38 ist ein anderes Skalar — nicht als ilvl ausgeben)
  ItemStat.dbc   Primaerzeile f0=itemId: f23/f24 float = Schaden min/max
                 wenn >0. Stufenbaender: f1=itemId, f2=Stufe, f23/f24 dmg.

Ausgabe data/weapons.json (kompakt, nur Seed-/Export-Ids die Waffen sind):

  {
    "647": {
      "n": "Cutlass",
      "q": 1,
      "ilvl": 15,
      "dmg": [13, 18],
      "b": {"10": [13, 18], "35": [65, 90], "59": [123, 171]}
    }
  }

Fehlende Keys weglassen. Fehlen die DBCs: {} und exit 0.

  python3 pipeline/weapons.py
"""
from __future__ import print_function

import io
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")

DBC_DIR = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
DBC_ITEM = os.path.join(DBC_DIR, "Item.dbc")
DBC_ADDON = os.path.join(DBC_DIR, "ItemAddon.dbc")
DBC_STAT = os.path.join(DBC_DIR, "ItemStat.dbc")

sys.path.insert(0, HERE)
from itemicons import collect_export_item_ids  # noqa: E402

LEVEL_LO, LEVEL_HI = 10, 59

# Inventory-Typen die echte Waffen-Slots sind (3.3.5a).
WEAPON_INV = frozenset({13, 14, 15, 17, 21, 22, 25, 26})


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        if magic != b"WDBC":
            raise SystemExit("not WDBC: %s" % path)
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


def f32(u):
    return struct.unpack("<f", struct.pack("<I", u & 0xFFFFFFFF))[0]


def write_json(path, obj):
    io.open(path, "w", encoding="utf-8").write(
        json.dumps(obj, ensure_ascii=False, separators=(",", ":")))


def wanted_ids():
    """Gleiche Id-Menge wie itemicons.py (Testexporte + Seed + Levelrun)."""
    return collect_export_item_ids()


def load_weapon_ids(wanted):
    """itemId -> (subclass, invType) fuer classId==2 und Waffen-invType."""
    rc, fc, rs, data, _ = read_dbc(DBC_ITEM)
    if fc < 7:
        raise SystemExit("Item.dbc: zu wenige Felder (%d)" % fc)
    want = set(wanted)
    out = {}
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        iid = row[0]
        if iid not in want:
            continue
        if int(row[1]) != 2:  # ITEM_CLASS_WEAPON
            continue
        inv = int(row[6])
        if inv not in WEAPON_INV:
            continue
        out[iid] = (int(row[2]), inv)
    return out


def load_addon_meta(weapon_ids):
    """itemId -> {n, q, ilvl} aus ItemAddon — nur gesetzte Felder."""
    rc, fc, rs, data, strings = read_dbc(DBC_ADDON)
    if fc < 48:
        raise SystemExit("ItemAddon.dbc: zu wenige Felder (%d)" % fc)
    want = set(weapon_ids)
    out = {}
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        iid = row[0]
        if iid not in want:
            continue
        name = sref(strings, row[2]).strip()
        if not name or name.startswith("[MISSING"):
            name = ""
        q = int(row[36])
        ilvl = int(row[47])
        ent = {}
        if name:
            ent["n"] = name
        if 0 <= q <= 7:
            ent["q"] = q
        # ItemLevel: f47, plausibel 1-300 (Ascension kann vom Klassiker abweichen)
        if 1 <= ilvl <= 300:
            ent["ilvl"] = ilvl
        if ent:
            out[iid] = ent
    return out


def load_stat_damage(weapon_ids):
    """Primaer-dmg + Stufenbaender 10-59 aus ItemStat.dbc."""
    rc, fc, rs, data, _ = read_dbc(DBC_STAT)
    if fc < 25:
        raise SystemExit("ItemStat.dbc: zu wenige Felder (%d)" % fc)
    want = set(weapon_ids)
    base = {}
    bands = {iid: {} for iid in want}

    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        lo = f32(row[23])
        hi = f32(row[24])
        if not (lo > 0 and hi >= lo and lo < 100000 and hi < 100000):
            continue
        dmg = [int(round(lo)), int(round(hi))]

        iid0 = row[0]
        if iid0 in want and iid0 not in base:
            base[iid0] = dmg

        iid1 = row[1]
        lvl = row[2]
        if iid1 in want and iid1 != row[0] and LEVEL_LO <= lvl <= LEVEL_HI:
            bands[iid1][str(lvl)] = dmg

    return base, bands


def build():
    if not (os.path.exists(DBC_ITEM) and os.path.exists(DBC_ADDON)
            and os.path.exists(DBC_STAT)):
        dest = os.path.join(DATA, "weapons.json")
        write_json(dest, {})
        print("DBC fehlt unter %s — data/weapons.json = {}" % DBC_DIR)
        return 0

    want = wanted_ids()
    weapons = load_weapon_ids(want)
    print("Wanted Ids:", len(want), "| Waffen (class 2 + inv):", len(weapons))
    if not weapons:
        dest = os.path.join(DATA, "weapons.json")
        write_json(dest, {})
        print("Keine Waffen-Ids — leere Map.")
        return 0

    addon = load_addon_meta(weapons)
    base, bands = load_stat_damage(weapons)

    out = {}
    for iid in sorted(weapons.keys()):
        ent = {}
        meta = addon.get(iid) or {}
        ent.update(meta)
        if iid in base:
            ent["dmg"] = base[iid]
        b = bands.get(iid) or {}
        if b:
            ent["b"] = {k: b[k] for k in sorted(b.keys(), key=int)}
        if ent:
            out[str(iid)] = ent

    dest = os.path.join(DATA, "weapons.json")
    write_json(dest, out)
    with_dmg = sum(1 for v in out.values() if "dmg" in v)
    with_bands = sum(1 for v in out.values() if "b" in v)
    with_ilvl = sum(1 for v in out.values() if "ilvl" in v)
    kb = os.path.getsize(dest) / 1024.0
    print("Geschrieben: %s (%.1f KB, %d Items)" % (dest, kb, len(out)))
    print("  mit ilvl:", with_ilvl, "| mit Basis-dmg:", with_dmg,
          "| mit Baendern 10-59:", with_bands)
    return 0


if __name__ == "__main__":
    raise SystemExit(build())
