# -*- coding: utf-8 -*-
"""Gegenstandsstufe- / Waffen-Bänder für Level 10–60 aus ItemStat.dbc.

Levelrun (10–59) und Endgame (Stufe 60) — gleiche ItemStat-Evidence.
Ethical RE: nur gemessene DBC-Felder, keine erfundenen Spell-Koeffizienten.

Ascension-Layout (gemessen, siehe pipeline/NOTES-ilvl.md):

  ItemStat.dbc  (~1.5M Zeilen, 39 Felder)
    Feld 1  = itemId
    Feld 2  = Charakterstufe der Skalierungszeile (1–60+)
    Feld 23 = Schaden min (float)
    Feld 24 = Schaden max (float)
    Feld 27 = Rüstung (int, Rüstungsteile)
    Feld 37 = effektive Gegenstandsstufe auf dieser Stufe

  Item.dbc
    Feld 1 = classId (2=Waffe, 4=Rüstung)
    Feld 6 = inventoryType (13/21/22 = 1H, 17 = 2H)

Produkt: data/ilvlbands.json → Assemble optional D.ilb

  {
    "src": "...",
    "levels": {
      "40": {
        "ilvl":  {"n":…, "p25":…, "p50":…, "p75":…},
        "w1h":   {"n":…, "p25":…, "p50":…, "p75":…},  # Mid-Schaden (min+max)/2
        "w2h":   {…},
        "armor": {…}
      }, …
    }
  }

Vergleich auf der Seite: Export-Waffen-DPS × Tempo ≈ Mid-Schaden;
durchschnittliche ILVL gegen ilvl.p25/p50/p75 der Charakterstufe.

Fehlen die DBCs: schreibt {} und exit 0 (assemble überspringt).
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
DBC_STAT = os.path.join(DBC_DIR, "ItemStat.dbc")

# INVTYPE: Weapon / WeaponMainhand / WeaponOffhand / 2HWeapon
INV_1H = frozenset((13, 21, 22))
INV_2H = frozenset((17,))

LEVEL_LO, LEVEL_HI = 10, 60


def f32(u):
    return struct.unpack("<f", struct.pack("<I", u & 0xFFFFFFFF))[0]


def read_dbc(path):
    with open(path, "rb") as f:
        magic = f.read(4)
        if magic != b"WDBC":
            raise SystemExit("%s: kein WDBC (%r)" % (path, magic))
        rc, fc, rs, ss = struct.unpack("<IIII", f.read(16))
        data = f.read(rc * rs)
        sb = f.read(ss) if ss else b""
    return rc, fc, rs, data, sb


def pcts(arr):
    """p25/p50/p75; None wenn zu dünn für ein ehrliches Band."""
    if len(arr) < 40:
        return None
    a = sorted(arr)

    def p(x):
        i = int(round((len(a) - 1) * x / 100.0))
        return round(a[i], 1)

    return {"n": len(a), "p25": p(25), "p50": p(50), "p75": p(75)}


def load_item_classes():
    rc, fc, rs, data, _ = read_dbc(DBC_ITEM)
    if fc < 7:
        raise SystemExit("Item.dbc: zu wenige Felder (%d)" % fc)
    weapons = {}  # itemId -> invType
    armor = set()
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        iid, cls, inv = row[0], row[1], row[6]
        if cls == 2:
            weapons[iid] = inv
        elif cls == 4:
            armor.add(iid)
    return weapons, armor


def mine_bands(weapons, armor):
    rc, fc, rs, data, _ = read_dbc(DBC_STAT)
    if fc < 38:
        raise SystemExit("ItemStat.dbc: zu wenige Felder (%d)" % fc)

    by_ilvl = {L: [] for L in range(LEVEL_LO, LEVEL_HI + 1)}
    by_1h = {L: [] for L in range(LEVEL_LO, LEVEL_HI + 1)}
    by_2h = {L: [] for L in range(LEVEL_LO, LEVEL_HI + 1)}
    by_armor = {L: [] for L in range(LEVEL_LO, LEVEL_HI + 1)}

    for i in range(rc):
        base = i * rs
        iid = struct.unpack_from("<I", data, base + 4)[0]
        lvl = struct.unpack_from("<I", data, base + 8)[0]
        if lvl < LEVEL_LO or lvl > LEVEL_HI:
            continue

        if iid in weapons:
            dmin = f32(struct.unpack_from("<I", data, base + 23 * 4)[0])
            dmax = f32(struct.unpack_from("<I", data, base + 24 * 4)[0])
            ilvl = struct.unpack_from("<I", data, base + 37 * 4)[0]
            if dmax <= 0 or dmin < 0 or dmax > 20000:
                continue
            mid = (dmin + dmax) / 2.0
            inv = weapons[iid]
            if inv in INV_1H:
                by_1h[lvl].append(mid)
            elif inv in INV_2H:
                by_2h[lvl].append(mid)
            if 1 <= ilvl <= 120:
                by_ilvl[lvl].append(ilvl)
        elif iid in armor:
            arm = struct.unpack_from("<I", data, base + 27 * 4)[0]
            ilvl = struct.unpack_from("<I", data, base + 37 * 4)[0]
            if 0 < arm < 80000:
                by_armor[lvl].append(arm)
            if 1 <= ilvl <= 120:
                by_ilvl[lvl].append(ilvl)

    levels = {}
    for L in range(LEVEL_LO, LEVEL_HI + 1):
        entry = {}
        il = pcts(by_ilvl[L])
        w1 = pcts(by_1h[L])
        w2 = pcts(by_2h[L])
        ar = pcts(by_armor[L])
        if il:
            entry["ilvl"] = il
        if w1:
            entry["w1h"] = w1
        if w2:
            entry["w2h"] = w2
        if ar:
            entry["armor"] = ar
        if entry:
            levels[str(L)] = entry
    return levels


def main():
    out_path = os.path.join(DATA, "ilvlbands.json")
    if not (os.path.isfile(DBC_ITEM) and os.path.isfile(DBC_STAT)):
        print("DBC fehlt — schreibe leeres ilvlbands.json")
        if not os.path.isdir(DATA):
            os.makedirs(DATA)
        with io.open(out_path, "w", encoding="utf-8") as f:
            f.write(u"{}\n")
        return 0

    print("Item.dbc + ItemStat.dbc lesen …")
    weapons, armor = load_item_classes()
    print("  Waffen:", len(weapons), "| Rüstung:", len(armor))
    levels = mine_bands(weapons, armor)
    payload = {
        "src": "ItemStat.dbc ∩ Item.dbc (class 2/4), Level %d–%d" % (
            LEVEL_LO, LEVEL_HI),
        "fields": {
            "itemId": 1,
            "charLevel": 2,
            "dmgMin": 23,
            "dmgMax": 24,
            "armor": 27,
            "itemLevel": 37,
        },
        "unit": {
            "w1h": "midDamage",
            "w2h": "midDamage",
            "ilvl": "itemLevel",
            "armor": "armor",
        },
        "note": (
            "w1h/w2h = (dmgMin+dmgMax)/2 aus ItemStat-Skalierungszeilen. "
            "Export-Vergleich: mid ≈ DPS × Tempo. "
            "Nur Items mit ItemStat-Zeilen; feste Klassik-Items ohne Skalierung "
            "fehlen hier — Band ist Anhalt für Levelrun und L60-Endgame, "
            "kein Raid-BiS."
        ),
        "levels": levels,
    }
    if not os.path.isdir(DATA):
        os.makedirs(DATA)
    with io.open(out_path, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, separators=(",", ":"))
        f.write(u"\n")
    kb = os.path.getsize(out_path) / 1024.0
    sample = levels.get("40") or levels.get("30") or {}
    print("geschrieben: data/ilvlbands.json (%.1f KB, %d Stufen)" % (
        kb, len(levels)))
    if sample:
        print("  Stichprobe Stufe-Band:", json.dumps(sample, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
