# -*- coding: utf-8 -*-
"""Aggressive aber ethische DBC-Probe — nur bereits extrahierte Ascension-Dateien.

Liest:
  C:\\Users\\x\\Documents\\AscensionDBC\\DBFilesClient\\*.dbc
  C:\\Users\\x\\Documents\\AscensionDBC\\patch-T\\DBFilesClient\\Spell.dbc

Schreibt/ergaenzt: pipeline/NOTES-dbc-ascension.md
Kein Client-Lua, kein Exe, keine Injection.
"""
from __future__ import print_function

import collections
import datetime
import io
import json
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
NOTES = os.path.join(HERE, "NOTES-dbc-ascension.md")
DBC = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
SPELL = r"C:\Users\x\Documents\AscensionDBC\patch-T\DBFilesClient\Spell.dbc"

# Tabellen mit Ascension-Eigenanteil oder unklarem Layout.
FOCUS = [
    "SpellAddon.dbc",
    "SpellCustomAttr.dbc",
    "SpellCharges.dbc",
    "SpellChargesCategory.dbc",
    "SpellAlternativeCost.dbc",
    "SpellAlternativePowerType.dbc",
    "SpellRank.dbc",
    "SpellAffect.dbc",
    "SpellTags.dbc",
    "SpellTagTypes.dbc",
    "SpellStatSuggestions.dbc",
    "SpellSpellSuggestions.dbc",
    "SpellDescriptionVariables.dbc",
    "Item.dbc",
    "ItemAddon.dbc",
    "ItemDisplayInfo.dbc",
    "ItemSpells.dbc",
    "ItemStat.dbc",
    "ItemClass.dbc",
    "ItemSubClass.dbc",
]


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        if magic != b"WDBC":
            raise SystemExit("not WDBC: %s %r" % (path, magic))
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


def path_for(name):
    if name == "Spell.dbc":
        return SPELL
    return os.path.join(DBC, name)


def catalog_spell_ids():
    rows = json.load(io.open(os.path.join(DATA, "spellids.json"), encoding="utf-8"))
    return [int(r[0]) for r in rows]


def header_table():
    lines = []
    lines.append("| Datei | records | fields | recordSize | stringBlock |")
    lines.append("|---|---:|---:|---:|---:|")
    names = list(FOCUS) + ["Spell.dbc"]
    for name in names:
        p = path_for(name)
        if not os.path.exists(p):
            lines.append("| `%s` | — | — | — | fehlt |" % name)
            continue
        rc, fc, rs, _d, sb = read_dbc(p)
        lines.append("| `%s` | %d | %d | %d | %d |" % (
            name, rc, fc, rs, len(sb)))
    return "\n".join(lines)


def field_hits(data, rc, fc, rs, wanted):
    """Wie oft steht ein Katalog-SpellId in Feld f?"""
    hits = [0] * fc
    wanted = set(wanted)
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        for f in range(fc):
            if row[f] in wanted:
                hits[f] += 1
    return hits


def probe_charges(wanted, cat_names):
    rc, fc, rs, data, _ = read_dbc(path_for("SpellCharges.dbc"))
    rc2, _fc2, rs2, data2, _ = read_dbc(path_for("SpellChargesCategory.dbc"))
    cats = {}
    for i in range(rc2):
        cid, mx, ms = struct.unpack_from("<III", data2, i * rs2)
        cats[cid] = (mx, ms)
    wanted_set = set(wanted)
    sid_to_idx = {sid: i for i, sid in enumerate(wanted)}
    rows = []
    for i in range(rc):
        sid, catid = struct.unpack_from("<II", data, i * rs)
        if sid not in wanted_set:
            continue
        mx, ms = cats.get(catid, (None, None))
        idx = sid_to_idx[sid]
        rows.append((idx, cat_names[idx], sid, catid, mx, ms))
    return rows, cats


def probe_spelladdon(wanted):
    rc, fc, rs, data, _ = read_dbc(path_for("SpellAddon.dbc"))
    hits = field_hits(data, rc, fc, rs, wanted)
    nz = [0] * fc
    dist14 = collections.Counter()
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        for f in range(fc):
            if row[f]:
                nz[f] += 1
        dist14[row[14]] += 1
    samples = []
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        if row[0] in set(wanted) and any(row[f] for f in range(2, 23) if f != 14):
            samples.append(row)
            if len(samples) >= 8:
                break
    return hits, nz, rc, dist14, samples


def probe_customattr(wanted):
    rc, fc, rs, data, _ = read_dbc(path_for("SpellCustomAttr.dbc"))
    hits = field_hits(data, rc, fc, rs, wanted)
    nz = [0] * fc
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        for f in range(fc):
            if row[f]:
                nz[f] += 1
    samples = []
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        if row[0] in set(wanted):
            samples.append(row)
            if len(samples) >= 8:
                break
    return hits, nz, rc, samples


def probe_statsug(wanted):
    rc, fc, rs, data, _ = read_dbc(path_for("SpellStatSuggestions.dbc"))
    wanted_set = set(wanted)
    dist = collections.Counter()
    hit = 0
    for i in range(rc):
        _rid, sid, stat, _flag = struct.unpack_from("<IIII", data, i * rs)
        if sid in wanted_set:
            hit += 1
            dist[stat] += 1
    return hit, dist, rc


def probe_tagtypes():
    rc, fc, rs, data, sb = read_dbc(path_for("SpellTagTypes.dbc"))
    types = []
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        types.append({
            "id": row[0],
            "group": row[2],
            "name": sref(sb, row[27]),
            "category": sref(sb, row[44]),
        })
    return types


def probe_spelltags(wanted):
    rc, fc, rs, data, _ = read_dbc(path_for("SpellTags.dbc"))
    wanted_set = set(wanted)
    by = collections.defaultdict(set)
    for i in range(rc):
        _rid, sid, tag = struct.unpack_from("<III", data, i * rs)
        if sid in wanted_set:
            by[sid].add(tag)
    return len(by), by


def probe_item_display(sample_ids):
    rc, fc, rs, data, _ = read_dbc(path_for("Item.dbc"))
    items = {}
    want = set(sample_ids)
    for i in range(rc):
        row = struct.unpack_from("<8I", data, i * rs)
        if row[0] in want:
            items[row[0]] = {
                "classId": row[1],
                "subclassId": row[2],
                "displayInfo": row[5],
                "invType": row[6],
            }
    rc, fc, rs, data, sb = read_dbc(path_for("ItemDisplayInfo.dbc"))
    by_disp = {}
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        by_disp[row[0]] = sref(sb, row[5])
    out = []
    for iid in sample_ids:
        meta = items.get(iid)
        if not meta:
            out.append((iid, None, None))
            continue
        icon = by_disp.get(meta["displayInfo"], "")
        out.append((iid, meta, icon))
    return out


def probe_itemclass():
    rc, fc, rs, data, sb = read_dbc(path_for("ItemClass.dbc"))
    rows = []
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        rows.append((row[0], sref(sb, row[3])))
    return rows


def write_notes(bits):
    lines = []
    lines.append("# Ascension-DBC Notes (Full Probe)")
    lines.append("")
    lines.append("Generiert von `pipeline/probe_dbc_ascension.py` am %s." % (
        datetime.date.today().isoformat()))
    lines.append("Nur bereits extrahierte DBC unter `Documents/AscensionDBC`.")
    lines.append("Kein Exe-Decompile, keine Injection, kein FrameXML im Repo.")
    lines.append("")
    lines.append("## 1. Header-Inventar")
    lines.append("")
    lines.append(bits["headers"])
    lines.append("")
    lines.append("## 2. SpellCharges (neue Mechanik-Facette)")
    lines.append("")
    lines.append("Layout gemessen:")
    lines.append("")
    lines.append("- `SpellCharges.dbc`: `spellId`, `categoryId` (414 Zeilen)")
    lines.append("- `SpellChargesCategory.dbc`: `id`, `maxCharges`, `rechargeMs`")
    lines.append("")
    lines.append("Katalog-Schnittmenge: **%d** / 3071 Spells mit Charges." % (
        len(bits["charges"])))
    lines.append("")
    lines.append("| Spell | spellId | max | Recharge |")
    lines.append("|---|---:|---:|---:|")
    for _idx, name, sid, _cat, mx, ms in sorted(bits["charges"], key=lambda r: r[0]):
        sec = round(ms / 1000.0, 1) if ms is not None else "?"
        lines.append("| %s | %d | %s | %ss |" % (name, sid, mx, sec))
    lines.append("")
    lines.append("Produkt: Felder `ch` / `chr` in `mechanics.json` "
                 "(`pipeline/mechanics.py`).")
    lines.append("")
    lines.append("## 3. SpellTagTypes / SpellTags")
    lines.append("")
    lines.append("Katalog-Spells mit ≥1 Tag: **%d** / %d." % (
        bits["tag_hit"], bits["cat_n"]))
    lines.append("")
    lines.append("Namensfelder in `SpellTagTypes` (verifiziert): "
                 "Feld 27 = Name, Feld 44 = Kategorie, Feld 2 = Gruppe.")
    lines.append("")
    lines.append("Stichprobe:")
    lines.append("")
    for t in bits["tagtypes"][:12]:
        lines.append("- `%d` %s — *%s* (group %d)" % (
            t["id"], t["name"] or "?", t["category"] or "?", t["group"]))
    lines.append("")
    lines.append("Produkt: `data/tagnames.json` → Assemble-Schlüssel `tagn`.")
    lines.append("")
    lines.append("## 4. SpellStatSuggestions (Path-Hinweis)")
    lines.append("")
    lines.append("Layout: `rowId`, `spellId`, `pathCode`, `flag(=1)`.")
    lines.append("Katalog-Treffer: **%d** / %d Tabellenzeilen." % (
        bits["statsug_hit"], bits["statsug_rc"]))
    lines.append("")
    lines.append("`pathCode` ist **nicht** Enum.PrimaryStat — Mapping "
                 "(verifiziert in `statsuggest.py`): "
                 "0 Strength, 1 Agility, 3 Intelligence, 4 Healing.")
    lines.append("Duality fehlt in der DBC. Produkt: `statsuggest.json` → `ssug`.")
    lines.append("")
    lines.append("Verteilung auf Katalog-Spells:")
    lines.append("")
    for k, n in sorted(bits["statsug_dist"].items()):
        label = {0: "Strength", 1: "Agility", 3: "Intelligence",
                 4: "Healing"}.get(k, "unbekannt")
        lines.append("- `%s` × %d — %s" % (k, n, label))
    lines.append("")
    lines.append("## 5. SpellAddon (Ascension-Eigen)")
    lines.append("")
    lines.append("5622 Zeilen, 23 Uint32-Felder, kein Stringblock.")
    lines.append("Feld 0 korreliert mit SpellId (Katalog-Hits: %d)." % (
        bits["addon_hits"][0] if bits["addon_hits"] else 0))
    lines.append("Feld 1 ist unique pro Zeile (interne Addon-ID?).")
    lines.append("")
    lines.append("Nonzero-Raten (Felder mit Signal):")
    lines.append("")
    for f, n in enumerate(bits["addon_nz"]):
        if n:
            lines.append("- f%02d: %d / %d (%.1f%%)" % (
                f, n, bits["addon_rc"], 100.0 * n / bits["addon_rc"]))
    lines.append("")
    lines.append("f14-Verteilung (Top): %s" % (
        ", ".join("%s×%d" % (k, n)
                  for k, n in bits["addon_dist14"].most_common(8))))
    lines.append("")
    lines.append("Bedeutung der Bit-/Flag-Felder **noch ungeklaert** — "
                 "keine Produktzahl ohne zweite Evidence.")
    lines.append("")
    lines.append("## 6. SpellCustomAttr")
    lines.append("")
    lines.append("58633 Zeilen, 11 Felder. Feld 0 = SpellId "
                 "(Katalog-Hits: %d)." % (
                     bits["ca_hits"][0] if bits["ca_hits"] else 0))
    lines.append("Felder 2–6 wirken wie Bitmasken (nz 18–45%). "
                 "Semantik offen; Stichprobe:")
    lines.append("")
    for row in bits["ca_samples"][:6]:
        lines.append("- `%s`" % (row,))
    lines.append("")
    lines.append("## 7. Item-Display (Gear-Paperdoll)")
    lines.append("")
    lines.append("`Item.dbc` (8 Felder): "
                 "`id, classId, subclassId, soundOverride, material, "
                 "displayInfoId, inventoryType, sheath`.")
    lines.append("`ItemDisplayInfo.dbc` Feld **5** = Inventory-Icon-Basename "
                 "(z. B. `INV_Sword_13`).")
    lines.append("")
    lines.append("`ItemClass.dbc` Feld 3 = Klassenname (Weapon, Armor, …).")
    lines.append("`ItemSubClass.dbc` Feld 10 = Subname (z. B. Dagger) — "
                 "andere Stringfelder sind Offsets in den gemeinsamen Block, "
                 "nicht blind als Name lesen.")
    lines.append("")
    lines.append("Stichprobe (Testexport-Gear):")
    lines.append("")
    lines.append("| itemId | class/sub | invType | icon |")
    lines.append("|---:|---|---:|---|")
    for iid, meta, icon in bits["item_samples"]:
        if not meta:
            lines.append("| %d | — | — | fehlt |" % iid)
            continue
        lines.append("| %d | %d/%d | %d | `%s` |" % (
            iid, meta["classId"], meta["subclassId"],
            meta["invType"], icon or "?"))
    lines.append("")
    lines.append("Produkt: `data/itemicons.json` → Assemble `iic` "
                 "(`pipeline/itemicons.py`, Default kompakt). "
                 "Nur Icon-Basename + Klassen-IDs (kein externes CDN — CSP).")
    lines.append("")
    lines.append("## 8. Was bewusst nicht Produkt wird")
    lines.append("")
    lines.append("- `Spell.dbc` EffectBasePoints → Schaden (bekannt unbrauchbar).")
    lines.append("- `SpellAddon` / `SpellCustomAttr` Flag-Semantik ohne zweite Quelle.")
    lines.append("- `SpellStatSuggestions` Wert `0` als Agility.")
    lines.append("- `ItemAddon.dbc` (48 Felder, 115 MB) — Name/Stats spaeter, "
                 "Layout noch nicht vollstaendig kartiert.")
    lines.append("- `SpellSpellSuggestions` / `SpellEnchantSuggestions` "
                 "(hunderttausende Zeilen) — Join-Heuristik offen.")
    lines.append("")
    lines.append("---")
    lines.append("Ende der Probe.")
    lines.append("")
    io.open(NOTES, "w", encoding="utf-8").write("\n".join(lines))
    print("Geschrieben:", NOTES)


def main():
    if not os.path.isdir(DBC):
        raise SystemExit("DBC-Ordner fehlt: " + DBC)
    wanted = catalog_spell_ids()
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    cat_names = [r[0] for r in cat]

    charges, _cats = probe_charges(wanted, cat_names)
    addon_hits, addon_nz, addon_rc, dist14, _asamples = probe_spelladdon(wanted)
    ca_hits, ca_nz, ca_rc, ca_samples = probe_customattr(wanted)
    statsug_hit, statsug_dist, statsug_rc = probe_statsug(wanted)
    tagtypes = probe_tagtypes()
    tag_hit, _by = probe_spelltags(wanted)
    item_samples = probe_item_display([
        1482, 17071, 34334, 8191, 14134, 8175, 19863, 17774,
    ])

    bits = {
        "headers": header_table(),
        "charges": charges,
        "addon_hits": addon_hits,
        "addon_nz": addon_nz,
        "addon_rc": addon_rc,
        "addon_dist14": dist14,
        "ca_hits": ca_hits,
        "ca_nz": ca_nz,
        "ca_rc": ca_rc,
        "ca_samples": ca_samples,
        "statsug_hit": statsug_hit,
        "statsug_dist": statsug_dist,
        "statsug_rc": statsug_rc,
        "tagtypes": tagtypes,
        "tag_hit": tag_hit,
        "cat_n": len(wanted),
        "item_samples": item_samples,
        "itemclass": probe_itemclass(),
    }
    write_notes(bits)
    print("Charges catalog:", len(charges))
    print("TagTypes:", len(tagtypes), "| tagged spells:", tag_hit)
    print("StatSug catalog hits:", statsug_hit)


if __name__ == "__main__":
    main()
