# -*- coding: utf-8 -*-
"""Holt die harten Mechanikwerte aus Spell.dbc.

Die Tooltips nennen Cooldowns nur in 12 von 3.071 Faellen und Kosten fast
nie - die DBC kennt beides fuer jeden Spell. Damit kann die Buildschmiede
endlich sagen, was ein Angriff kostet und wie oft er geht.

Ressourcen-TEILUNG (nicht vermischen):
  DBC  -> cost / res  (Verbrauch)
  Tooltip (scaling.py) -> gen  (Gewinn / Regen)
  DBC kennt keinen Ressourcen-Gewinn; Tooltip nennt fast nie absolute Kosten.

3.3.5a Spell.dbc, Standardlayout (durch Feld 133 = SpellIconID und
136 = Name bereits verifiziert):
   28 CastingTimeIndex -> SpellCastTimes.dbc
   29 RecoveryTime        (ms)
   30 CategoryRecoveryTime(ms)
   35 procChance
   40 DurationIndex    -> SpellDuration.dbc
   41 powerType         (vorzeichenbehaftet; -2 = Leben)
   42 manaCost          (Wut/Runenmacht: Zehntel → /10)
   44 manaCostPercentage (gemessen, noch kein Produktfeld)
   46 rangeIndex       -> SpellRange.dbc
   80..82 EffectBasePoints (vorzeichenbehaftet; unbrauchbar fuer Schaden)

Ascension-Erweiterung (DBFilesClient):
   SpellCharges.dbc + SpellChargesCategory.dbc -> ch (max), chr (Recharge s)
   Optional SpellRank.dbc: gleicher First-Rank erbt Charges, falls die
   Katalog-spellId selbst fehlt (hoehere Raenge teilen die Category).

Ausgabe mechanics.json: pro Katalogindex ein Objekt, leere Felder weg.
spellids.json-Zeile ist [spellId, castMs, minRange, maxRange, passive, entryId]
— nur Index 0 ist eine Spell-ID.
"""
import io
import json
import os
import re
import struct
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
DBC_DIR = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
SPELL = r"C:\Users\x\Documents\AscensionDBC\patch-T\DBFilesClient\Spell.dbc"

F_CASTTIME, F_COOLDOWN, F_CATCD = 28, 29, 30
F_PROC, F_DURATION, F_POWER, F_MANA = 35, 40, 41, 42
F_MANA_PCT = 44
F_RANGE, F_ICON, F_NAME = 46, 133, 136

# powerType 1 (Wut) und 6 (Runenmacht): manaCost in Zehnteln.
# Plausibilitaetsanker: Wut-Pool ist bei 100 gedeckelt.
TENTHS_POWER = (1, 6)
RAGE_POOL_CAP = 100

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


def signed_u32(v):
    if v >= 0x80000000:
        return v - 0x100000000
    return v


def load_charges():
    """spellId -> (maxCharges, rechargeMs)."""
    charges_by_spell = {}
    charges_path = os.path.join(DBC_DIR, "SpellCharges.dbc")
    cat_path = os.path.join(DBC_DIR, "SpellChargesCategory.dbc")
    if not (os.path.exists(charges_path) and os.path.exists(cat_path)):
        return charges_by_spell
    crc, _cfc, crs, cdata, _ = read_dbc(cat_path)
    charge_cats = {}
    for i in range(crc):
        cid, mx, ms = struct.unpack_from("<III", cdata, i * crs)
        charge_cats[cid] = (mx, ms)
    src, _sfc, srs, sdata, _ = read_dbc(charges_path)
    for i in range(src):
        sid, catid = struct.unpack_from("<II", sdata, i * srs)
        if catid in charge_cats:
            charges_by_spell[sid] = charge_cats[catid]
    return charges_by_spell


def load_spell_rank_groups():
    """SpellRank.dbc: spellId -> firstSpellId; firstSpellId -> [spellIds].

    Layout gemessen: rowId, firstSpellId, spellId, rank.
    """
    path = os.path.join(DBC_DIR, "SpellRank.dbc")
    by_spell = {}
    by_first = defaultdict(list)
    if not os.path.exists(path):
        return by_spell, by_first
    rc, _fc, rs, data, _ = read_dbc(path)
    for i in range(rc):
        _rid, first, spell, _rank = struct.unpack_from("<IIII", data, i * rs)
        by_spell[spell] = first
        by_first[first].append(spell)
    return by_spell, by_first


def resolve_charges(spell_id, charges_by_spell, by_spell, by_first):
    """Direct SpellCharges hit, else same First-Rank sibling."""
    hit = charges_by_spell.get(spell_id)
    if hit:
        return hit, "direct"
    first = by_spell.get(spell_id, spell_id)
    for sib in by_first.get(first, []):
        hit = charges_by_spell.get(sib)
        if hit:
            return hit, "rank"
    # Katalog-ID ist First-Rank, Charges liegen nur auf Folge-Raengen.
    for sib in by_first.get(spell_id, []):
        hit = charges_by_spell.get(sib)
        if hit:
            return hit, "rank"
    return None, None


def decode_cost(raw_mana, power):
    """DBC manaCost + powerType -> (cost, res_label) oder None."""
    if not raw_mana:
        return None
    power = signed_u32(power)
    cost = raw_mana
    if power in TENTHS_POWER:
        cost = cost / 10.0
        cost = int(cost) if cost == int(cost) else round(cost, 1)
    return cost, POWER.get(power, "?"), power


def main():
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    ids = json.load(io.open(os.path.join(DATA, "spellids.json"), encoding="utf-8"))

    cast_times = lookup("SpellCastTimes.dbc", 1)   # Basis-Castzeit in ms
    durations = lookup("SpellDuration.dbc", 1)     # Basisdauer in ms
    # SpellRange.dbc: 0 id, 1 minRangeHostile, ... 3 maxRangeHostile
    ranges = lookup("SpellRange.dbc", 3, as_float=True)

    charges_by_spell = load_charges()
    by_spell, by_first = load_spell_rank_groups()

    print("Hilfstabellen: casttimes=%d durations=%d ranges=%d charges=%d rankFirst=%d"
          % (len(cast_times), len(durations), len(ranges),
             len(charges_by_spell), len(by_first)))

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
    charge_via = {"direct": 0, "rank": 0}
    rage_over_cap = []
    tenths_anchors = []
    pct_nonzero = 0

    for idx, rec in enumerate(cat):
        spell_id = ids[idx][0]  # nur spellId — nicht castMs/entryId
        v = by_id.get(spell_id)
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
            decoded = decode_cost(v[F_MANA], v[F_POWER])
            if decoded:
                cost, res, power = decoded
                o["cost"] = cost
                o["res"] = res
                if power in TENTHS_POWER:
                    tenths_anchors.append((rec[0], v[F_MANA], cost, res))
                    if res == "Wut" and cost > RAGE_POOL_CAP:
                        rage_over_cap.append((rec[0], spell_id, v[F_MANA], cost))
        if fc > F_MANA_PCT and v[F_MANA_PCT]:
            pct_nonzero += 1
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
        ch, via = resolve_charges(spell_id, charges_by_spell, by_spell, by_first)
        if ch:
            mx, ms = ch
            if mx and mx > 0:
                o["ch"] = int(mx)
            if ms and ms > 0:
                o["chr"] = round(ms / 1000.0, 1)
            if "ch" in o or "chr" in o:
                charge_via[via] = charge_via.get(via, 0) + 1
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

    print("\nCharges (ch/chr): direct=%d rank-fallback=%d total=%d"
          % (charge_via.get("direct", 0), charge_via.get("rank", 0),
             keys.get("ch", 0)))
    print("SpellCharges-Tabelle gesamt: %d; Katalog-Schnittmenge: %d"
          % (len(charges_by_spell), keys.get("ch", 0)))
    for i, o in enumerate(out):
        if "ch" in o:
            print("   %-28s sid=%-8d ch=%s chr=%s" % (
                cat[i][0][:28], ids[i][0], o.get("ch"), o.get("chr")))

    # Zehntel-Regel: Stichproben + Cap-Check (nichts erfinden, nur messen).
    print("\nKosten Zehntel (Wut/Runenmacht): %d Eintraege" % len(tenths_anchors))
    want = ("Heroic Strike", "Mortal Strike", "Dancing Rune Weapon",
            "Frost Strike", "Whirlwind", "Sinister Strike")
    by_name = {n: (raw, cost, res) for n, raw, cost, res in tenths_anchors}
    for n in want:
        if n in by_name:
            raw, cost, res = by_name[n]
            print("   %-24s raw=%-4s -> %s %s" % (n, raw, cost, res))
    if rage_over_cap:
        print("WARNUNG: Wut-Kosten > %d nach /10 (Parserfehler?):" % RAGE_POOL_CAP)
        for row in rage_over_cap[:20]:
            print("  ", row)
    else:
        print("Wut-Cap-Check: alle Wut-Kosten nach /10 <= %d" % RAGE_POOL_CAP)

    print("manaCostPercentage (Feld 44) nonzero im Katalog: %d "
          "(kein Produktfeld - nicht raten)" % pct_nonzero)

    # Tooltip-Recharge vs DBC (nur Diagnose; DBC gewinnt bei Diff).
    tip_rx = re.compile(
        r"(?:Max\s+(\d+)\s+charges?[^\d]{0,48}?(\d+(?:\.\d+)?)\s*sec)"
        r"|(?:(\d+)\s+Charges?,\s*(\d+(?:\.\d+)?)\s*sec)",
        re.I,
    )
    print("\nCharges Tooltip vs DBC (DBC = Quelle):")
    for i, o in enumerate(out):
        if "ch" not in o:
            continue
        mo = tip_rx.search(cat[i][5] or "")
        if not mo:
            print("   %-28s tip=- dbc ch=%s chr=%s" % (
                cat[i][0][:28], o.get("ch"), o.get("chr")))
            continue
        g = mo.groups()
        if g[0]:
            tch, tchr = int(g[0]), float(g[1])
        else:
            tch, tchr = int(g[2]), float(g[3])
        ok = tch == o.get("ch") and abs(tchr - (o.get("chr") or 0)) < 0.05
        print("   %-28s tip=%s/%s dbc=%s/%s %s" % (
            cat[i][0][:28], tch, tchr, o.get("ch"), o.get("chr"),
            "OK" if ok else "DIFF->DBC"))

    print("\nStichproben CD/Kosten:")
    n = 0
    for i, o in enumerate(out):
        if o.get("cd") and n < 10:
            print("   %-24s CD %-6s Cast %-5s Kosten %s" % (
                cat[i][0][:24], o.get("cd"), o.get("cast", "-"),
                (str(o.get("cost", "-")) + " " + o.get("res", ""))))
            n += 1


if __name__ == "__main__":
    main()
