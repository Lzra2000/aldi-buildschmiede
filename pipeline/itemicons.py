# -*- coding: utf-8 -*-
"""itemId -> iconName aus Item.dbc + ItemDisplayInfo.dbc.

3.3.5a (Ascension-Layout verifiziert):
  Item.dbc            Feld 5 = DisplayInfoID
  ItemDisplayInfo.dbc Feld 5 = inventoryIcon[0]  (z.B. INV_Sword_04)

Default (einbettbar als D.iic, assemble-Limit 512 KB):
  Nur ItemIds aus data/testexport*.txt (GEAR|…|itemId, WEAPON|…|itemId)
  plus SEED_IDS. Ausgabe: data/itemicons.json als flaches Dict
    {"1482":"inv_sword_13", …}

Vollscan (Forschung, nicht einbetten):
  python3 pipeline/itemicons.py --all
  schreibt data/itemicons-all.json (itemicons.json bleibt kompakt).

Fehlen die DBCs: schreibt data/itemicons.json = {} und exit 0
(assemble ueberspringt fehlende Optional-Dateien ohnehin).

BLP→WebP-Sprite fuer ~18k Item-Icons ist absichtlich nicht gebaut —
zu gross fuer die Einbettung; die Seite kann spaeter per iconName
auf Interface-Icons zeigen oder ein schlankes Subset-Sprite bauen.
"""
from __future__ import print_function

import io
import json
import os
import re
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")

DBC_DIR = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
DBC_ITEM = os.path.join(DBC_DIR, "Item.dbc")
DBC_DISPLAY = os.path.join(DBC_DIR, "ItemDisplayInfo.dbc")
ICON_ROOT = r"C:\Users\x\Documents\AscensionInterfaceExtract\by-archive"

EMBED_SOFT_MAX_KB = 400

# Bekannte Probe-/Seed-Ids (WotLK-Klassiker + fruehere Testexporte).
SEED_IDS = (
    25, 35, 36, 37, 38, 39, 40, 117, 6948, 19019, 49623,
    1482, 17071, 34334, 8191, 8192, 8193, 8194, 8197, 8198,
    8175, 8176, 14134, 21933, 9538, 19863, 7971, 17774,
)
PROBE_IDS = (25, 1482, 8191, 14134, 17071, 19019, 34334)


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        if magic != b"WDBC":
            raise SystemExit("kein WDBC: %s (%r)" % (path, magic))
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


def icon_basename(name):
    if not name:
        return ""
    for sep in ("\\", "/"):
        if sep in name:
            name = name.split(sep)[-1]
    if name.lower().endswith(".blp"):
        name = name[:-4]
    return name.lower()


def write_json(path, obj):
    raw = json.dumps(obj, ensure_ascii=False, separators=(",", ":"),
                     sort_keys=True)
    io.open(path, "w", encoding="utf-8").write(raw)
    return len(raw.encode("utf-8")) / 1024.0


def collect_export_item_ids():
    """ItemIds aus Addon-Testexporten + Seed. Katalog fuehrt keine ItemIds."""
    ids = set(SEED_IDS)
    if not os.path.isdir(DATA):
        return ids
    for name in os.listdir(DATA):
        if not name.startswith("testexport") or not name.endswith(".txt"):
            continue
        text = io.open(os.path.join(DATA, name), encoding="utf-8").read()
        for line in text.splitlines():
            if line.startswith("GEAR|"):
                parts = line.split("|")
                # GEAR|Slot|Name|ilvl|quality|subtype|itemId|…
                if len(parts) >= 7 and re.match(r"^\d+$", parts[6]):
                    ids.add(int(parts[6]))
            elif line.startswith("WEAPON|"):
                parts = line.split("|")
                # WEAPON|tag|name|ilvl|speed|lo-hi|dps|loc|sub|itemId|…
                for p in parts[9:]:
                    if re.match(r"^\d+$", p):
                        ids.add(int(p))
                        break
    ids.discard(0)
    return ids


def load_item_display(wanted):
    """itemId -> displayInfoId; wanted=None = alle Zeilen."""
    rc, fc, rs, data, _ = read_dbc(DBC_ITEM)
    if fc < 6:
        raise SystemExit("Item.dbc: zu wenige Felder (%d), erwartet >= 6" % fc)
    want = None if wanted is None else set(wanted)
    out = {}
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        iid = row[0]
        if want is not None and iid not in want:
            continue
        did = row[5]
        if did and did != 0xFFFFFFFF:
            out[iid] = did
    return out, rc


def load_icons_for(display_ids):
    rc, fc, rs, data, sb = read_dbc(DBC_DISPLAY)
    if fc < 6:
        raise SystemExit(
            "ItemDisplayInfo.dbc: zu wenige Felder (%d), erwartet >= 6" % fc)
    want = set(display_ids)
    out = {}
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        if row[0] not in want:
            continue
        icon = icon_basename(sref(sb, row[5]))
        if icon:
            out[row[0]] = icon
    return out


def index_blp_names():
    """icon basename (klein) -> True, wenn BLP unter Interface/Icons liegt."""
    found = set()
    if not os.path.isdir(ICON_ROOT):
        return found
    for root, _dirs, files in os.walk(ICON_ROOT):
        if "icon" not in root.lower():
            continue
        for fn in files:
            if fn.lower().endswith(".blp"):
                found.add(fn[:-4].lower())
    return found


def write_empty(reason):
    dest = os.path.join(DATA, "itemicons.json")
    write_json(dest, {})
    print(reason)
    print("Geschrieben: %s = {}" % dest)
    return 0


def main(argv=None):
    argv = list(argv or sys.argv[1:])
    full = "--all" in argv
    check_blp = "--blp" in argv or full

    if not os.path.exists(DBC_ITEM) or not os.path.exists(DBC_DISPLAY):
        return write_empty(
            "DBC fehlt (Item.dbc / ItemDisplayInfo.dbc unter %s) — leere Map."
            % DBC_DIR)

    if full:
        print("Vollscan: alle ItemIds mit DisplayInfo-Icon "
              "-> data/itemicons-all.json")
        wanted = None
        dest = os.path.join(DATA, "itemicons-all.json")
    else:
        wanted = collect_export_item_ids()
        print("Kompakt: %d ItemIds (Testexporte + Seed)" % len(wanted))
        dest = os.path.join(DATA, "itemicons.json")

    item_disp, n_item = load_item_display(wanted)
    print("Item.dbc Zeilen:", n_item, "| Treffer:", len(item_disp))

    icons = load_icons_for(item_disp.values())
    print("DisplayInfo-Icons:", len(icons))

    by_item = {}
    miss = []
    for iid, did in item_disp.items():
        icon = icons.get(did)
        if not icon:
            miss.append(iid)
            continue
        by_item[str(iid)] = icon

    if miss:
        print("Ohne Icon:", len(miss), "Beispiel:", miss[:10])

    print("Probe:")
    for iid in PROBE_IDS:
        print(" ", iid, by_item.get(str(iid), "—"))

    if check_blp:
        blps = index_blp_names()
        if not blps:
            print("BLP-Index leer/fehlt:", ICON_ROOT)
        else:
            have = sum(1 for ic in set(by_item.values()) if ic in blps)
            uniq = len(set(by_item.values()))
            print("BLP-Treffer: %d / %d eindeutige Icons (von %d BLP-Dateien)"
                  % (have, uniq, len(blps)))

    kb = write_json(dest, by_item)
    print("Geschrieben:", dest, "| %d Eintraege | %.2f KB"
          % (len(by_item), kb))

    # Kompakte Einbettungsdatei immer pflegen, auch nach --all.
    if full:
        compact_ids = collect_export_item_ids()
        compact = {str(i): by_item[str(i)]
                   for i in compact_ids if str(i) in by_item}
        cdest = os.path.join(DATA, "itemicons.json")
        ckb = write_json(cdest, compact)
        print("Kompakt parallel:", cdest, "| %d | %.2f KB"
              % (len(compact), ckb))
    elif kb > EMBED_SOFT_MAX_KB:
        print("Hinweis: ueber Soft-Limit %d KB — assemble skippt iic (>512 KB)."
              % EMBED_SOFT_MAX_KB)

    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
