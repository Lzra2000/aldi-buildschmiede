"""Ergaenzt die Icon-Zuordnung aus der Client-DBC.

Die DataMiner-Daten decken nur ~51% des Katalogs ab. Spell.dbc kennt zu
jedem Spell eine SpellIconID, und SpellIcon.dbc loest die auf einen
Icon-Pfad auf. Damit kommen wir deutlich weiter.

3.3.5a Spell.dbc: Feld 0 = ID, 133 = SpellIconID, 136 = Name (enUS).
"""
import io
import json
import os
import struct

DBC_SPELL = r"C:\Users\x\Documents\AscensionDBC\patch-T\DBFilesClient\Spell.dbc"
DBC_ICON = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient\SpellIcon.dbc"
BS = chr(92)


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        assert magic == b"WDBC", magic
        data = fh.read(rc * rs)
        strings = fh.read(sbs)
    return rc, fc, rs, data, strings


def sref(strings, off):
    if off <= 0 or off >= len(strings):
        return ""
    end = strings.find(b"\x00", off)
    return strings[off:end].decode("utf-8", "replace")


def basename(path):
    for sep in (BS, "/"):
        path = path.replace(sep, "\n")
    return path.split("\n")[-1]


def main():
    if not os.path.exists(DBC_ICON):
        print("SpellIcon.dbc fehlt:", DBC_ICON)
        return
    rc, fc, rs, data, sb = read_dbc(DBC_ICON)
    icon_by_id = {}
    for i in range(rc):
        v = struct.unpack_from("<%dI" % fc, data, i * rs)
        icon_by_id[v[0]] = basename(sref(sb, v[1])).lower()
    print("SpellIcon-Eintraege:", len(icon_by_id))

    rc, fc, rs, data, sb = read_dbc(DBC_SPELL)
    print("Spell.dbc:", rc, "Eintraege,", fc, "Felder")
    by_name = {}
    for i in range(rc):
        v = struct.unpack_from("<%dI" % fc, data, i * rs)
        name = sref(sb, v[136])
        if not name:
            continue
        ic = icon_by_id.get(v[133])
        if ic and name not in by_name:
            by_name[name] = ic
    print("Namen mit Icon aus DBC:", len(by_name))

    # Mit der DataMiner-Zuordnung zusammenfuehren, DataMiner hat Vorrang
    existing = json.load(io.open("iconmap.json", encoding="utf-8"))
    added = 0
    for name, ic in by_name.items():
        if name not in existing:
            existing[name] = ic
            added += 1
    io.open("iconmap.json", "w", encoding="utf-8").write(
        json.dumps(existing, ensure_ascii=False, separators=(",", ":"))
    )
    print("Neu dazugekommen:", added, "| gesamt:", len(existing))


if __name__ == "__main__":
    main()
