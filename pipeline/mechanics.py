# -*- coding: utf-8 -*-
"""Holt die harten Mechanikwerte aus Spell.dbc.

Die Tooltips nennen Cooldowns nur in 12 von 3.071 Faellen und Kosten fast
nie - die DBC kennt beides fuer jeden Spell. Damit kann die Buildschmiede
endlich sagen, was ein Angriff kostet und wie oft er geht.

3.3.5a Spell.dbc, Standardlayout (durch Feld 133 = SpellIconID und
136 = Name bereits verifiziert):
   28 CastingTimeIndex -> SpellCastTimes.dbc
   29 RecoveryTime        (ms)
   30 CategoryRecoveryTime(ms)
   35 procChance
   40 DurationIndex    -> SpellDuration.dbc
   41 powerType
   42 manaCost
   46 rangeIndex       -> SpellRange.dbc
   80..82 EffectBasePoints (vorzeichenbehaftet)

Ascension-Erweiterung (DBFilesClient):
   SpellCharges.dbc + SpellChargesCategory.dbc -> ch (max), chr (Recharge s)

Ausgabe mechanics.json: pro Katalogindex ein Objekt, leere Felder weg.
"""
import io
import json
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
DBC_DIR = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
SPELL = r"C:\Users\x\Documents\AscensionDBC\patch-T\DBFilesClient\Spell.dbc"

F_CASTTIME, F_COOLDOWN, F_CATCD = 28, 29, 30
F_PROC, F_DURATION, F_POWER, F_MANA = 35, 40, 41, 42
F_RANGE, F_ICON, F_NAME = 46, 133, 136

POWER = {0: "Mana", 1: "Wut", 2: "Fokus", 3: "Energie", 4: "Glueck",
         5: "Runen", 6: "Runenmacht", -2: "Leben"}


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
    return strings[off:end].decode("utf-8", "replace")


def lookup(name, value_field, as_float=False):
    """Kleine Hilfstabellen: id -> Wert im angegebenen Feld.

    SpellRange.dbc speichert Reichweiten als Float. Als Integer gelesen
    kommt dabei das Bitmuster heraus - 5.0 wird zu 1084227584."""
    p = os.path.join(DBC_DIR, name)
    if not os.path.exists(p):
        return {}
    rc, fc, rs, data, sb = read_dbc(p)
    # Vorzeichenbehaftet lesen: SpellCastTimes fuehrt Sonderfaelle
    # als negative Werte (-1000 statt "sofort"), die als unsigned
    # zu 4.293.967 Sekunden Castzeit werden.
    fmt = "<%d%s" % (fc, "f" if as_float else "i")
    out = {}
    for i in range(rc):
        v = struct.unpack_from(fmt, data, i * rs)
        if value_field < fc:
            key = int(struct.unpack_from("<I", data, i * rs)[0])
            out[key] = v[value_field]
    return out


def main():
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    ids = json.load(io.open(os.path.join(DATA, "spellids.json"), encoding="utf-8"))

    cast_times = lookup("SpellCastTimes.dbc", 1)   # Basis-Castzeit in ms
    durations = lookup("SpellDuration.dbc", 1)     # Basisdauer in ms
    # SpellRange.dbc: 0 id, 1 minRangeHostile, ... 3 maxRangeHostile
    ranges = lookup("SpellRange.dbc", 3, as_float=True)

    # Ascension: SpellCharges.dbc (spellId, categoryId) +
    # SpellChargesCategory.dbc (id, maxCharges, rechargeMs).
    charges_by_spell = {}
    charges_path = os.path.join(DBC_DIR, "SpellCharges.dbc")
    cat_path = os.path.join(DBC_DIR, "SpellChargesCategory.dbc")
    if os.path.exists(charges_path) and os.path.exists(cat_path):
        crc, cfc, crs, cdata, _ = read_dbc(cat_path)
        charge_cats = {}
        for i in range(crc):
            cid, mx, ms = struct.unpack_from("<III", cdata, i * crs)
            charge_cats[cid] = (mx, ms)
        src, sfc, srs, sdata, _ = read_dbc(charges_path)
        for i in range(src):
            sid, catid = struct.unpack_from("<II", sdata, i * srs)
            if catid in charge_cats:
                charges_by_spell[sid] = charge_cats[catid]

    print("Hilfstabellen: casttimes=%d durations=%d ranges=%d charges=%d"
          % (len(cast_times), len(durations), len(ranges),
             len(charges_by_spell)))

    rc, fc, rs, data, sb = read_dbc(SPELL)
    print("Spell.dbc:", rc, "Eintraege,", fc, "Felder")

    # Exakt ueber die Spell-ID. Kein Namensraten mehr - "Charge" gibt es
    # als Kriegerfaehigkeit und als Jaeger-Petspell, und die Namenssuche
    # hat verlaesslich den falschen erwischt.
    by_id = {}
    for i in range(rc):
        v = struct.unpack_from("<%dI" % fc, data, i * rs)
        by_id[v[0]] = v

    print("Spells nach ID:", len(by_id))

    out = []
    hit = 0
    for idx, rec in enumerate(cat):
        v = by_id.get(ids[idx][0])
        if not v:
            out.append({})
            continue
        o = {}
        cd = max(v[F_COOLDOWN], v[F_CATCD])
        if cd:
            o["cd"] = round(cd / 1000.0, 1)
        ct = cast_times.get(v[F_CASTTIME], 0)
        if ct and ct > 0:
            o["cast"] = round(ct / 1000.0, 1)
        if v[F_MANA]:
            cost = v[F_MANA]
            # powerType ist vorzeichenbehaftet: -2 = Leben (Health Funnel).
            # Als unsigned gelesen wird daraus 4294967294 und res="?".
            power = v[F_POWER]
            if power >= 0x80000000:
                power -= 0x100000000
            # Wut und Runenmacht liegen intern in Zehnteln vor: Dancing Rune
            # Weapon steht mit 600 in der DBC und kostet im Spiel 60.
            if power in (1, 6):
                cost = cost / 10.0
                cost = int(cost) if cost == int(cost) else round(cost, 1)
            o["cost"] = cost
            o["res"] = POWER.get(power, "?")
        dur = durations.get(v[F_DURATION], 0)
        if dur and 0 < dur < 3600000:
            o["dur"] = round(dur / 1000.0, 1)
        rng = ranges.get(v[F_RANGE], 0)
        # 0 heisst Selbstzauber, alles ueber 100 ist "unbegrenzt" - beides
        # sagt dem Spieler nichts.
        if rng and 0 < rng <= 100:
            o["range"] = int(round(rng))
        # procChance steht bei den allermeisten Spells auf 101 ("immer") -
        # als Zahl anzuzeigen waere schlicht falsch.
        if 0 < v[F_PROC] < 100:
            o["proc"] = v[F_PROC]
        ch = charges_by_spell.get(v[0])
        if ch:
            mx, ms = ch
            if mx and mx > 0:
                o["ch"] = int(mx)
            if ms and ms > 0:
                o["chr"] = round(ms / 1000.0, 1)
        if o:
            hit += 1
        out.append(o)

    io.open(os.path.join(DATA, "mechanics.json"), "w", encoding="utf-8").write(
        json.dumps(out, separators=(",", ":"))
    )

    keys = {}
    for o in out:
        for k in o:
            keys[k] = keys.get(k, 0) + 1
    ohne = sum(1 for idx in range(len(cat)) if ids[idx][0] not in by_id)
    print("Katalogeintraege mit Mechanikdaten: %d von %d" % (hit, len(cat)))
    print("Spell-IDs, die die DBC nicht kennt:", ohne)
    for k in sorted(keys, key=lambda x: -keys[x]):
        print("  %-6s %5d" % (k, keys[k]))

    print("\nStichproben:")
    n = 0
    for i, o in enumerate(out):
        if o.get("cd") and n < 10:
            print("   %-24s CD %-6s Cast %-5s Kosten %s" % (
                cat[i][0][:24], o.get("cd"), o.get("cast", "-"),
                (str(o.get("cost", "-")) + " " + o.get("res", ""))))
            n += 1


if __name__ == "__main__":
    main()
