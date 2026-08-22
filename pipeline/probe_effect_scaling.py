# -*- coding: utf-8 -*-
"""RE-Probe: Spell.dbc Effect-Felder vs. Tooltip-Schaden + SpellAddon/CustomAttr.

Nur Messung. Schreibt keine Produkt-JSON. Ausgabe: stdout + Anhaenge fuer NOTES.
Kein erfundener SP/AP-Koeffizient.
"""
from __future__ import print_function

import collections
import io
import json
import os
import re
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
DBC = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
SPELL = r"C:\Users\x\Documents\AscensionDBC\patch-T\DBFilesClient\Spell.dbc"

# 3.3.5a Spell.dbc Effect-Block (Ascension = 234 Felder, Layout wie Classic)
F_EFFECT = 71
F_DIESIDES = 74
F_REAL_PER_LEVEL = 77   # float[3]
F_BASEPOINTS = 80       # int32[3]
F_MECHANIC = 83
F_IMPL_A = 86
F_IMPL_B = 89
F_RADIUS = 92
F_AURA = 95
F_AMPLITUDE = 98
F_MULTIPLE = 101        # float[3] → $e
F_CHAIN = 104
F_ITEMTYPE = 107
F_MISC = 110
F_MISCB = 113
F_TRIGGER = 116
F_COMBO = 119           # float[3] → $b
F_CLASSMASK = 122       # 9 uints (3×3)
# Nach Name/Desc-Block (Ascension 234 Felder, Classic-Layout):
F_DMG_MULTIPLIER = 166  # float[3] — Trinity DmgMultiplier
F_SCHOOL_MASK = 48      # oft SchoolMask
F_DMG_CLASS = 47        # oft DmgClass (0 none, 1 magic, 2 melee, 3 ranged)

EFF_SCHOOL_DAMAGE = 2
EFF_APPLY_AURA = 6
EFF_HEALTH_LEECH = 62
EFF_HEAL = 10
EFF_WEAPON_DAMAGE = 31
EFF_WEAPON_PERCENT = 58
EFF_NORMALIZED_WEAPON = 121
EFF_TRIGGERED_WEAPON = 146  # TriggerMissile / weapon variants vary

RX_USES = re.compile(r"This uses .+ modifiers", re.I)


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        assert magic == b"WDBC", (path, magic)
        data = fh.read(rc * rs)
        strings = fh.read(sbs)
    return rc, fc, rs, data, strings


def u32(v):
    return v & 0xFFFFFFFF


def i32(v):
    v = u32(v)
    return v - 0x100000000 if v >= 0x80000000 else v


def f32_bits(v):
    return struct.unpack("<f", struct.pack("<I", u32(v)))[0]


def load_spell_by_id():
    rc, fc, rs, data, sb = read_dbc(SPELL)
    by = {}
    for i in range(rc):
        row = struct.unpack_from("<%dI" % fc, data, i * rs)
        by[row[0]] = row
    return by, fc, sb


def effect_damage_range(row, e):
    """Anzeige-Range wie Client $s: base+1 .. base+max(sides,1)."""
    eff = row[F_EFFECT + e]
    if eff not in (EFF_SCHOOL_DAMAGE, EFF_HEAL, EFF_HEALTH_LEECH,
                   EFF_WEAPON_DAMAGE, EFF_WEAPON_PERCENT, EFF_NORMALIZED_WEAPON):
        return None, eff
    base = i32(row[F_BASEPOINTS + e])
    sides = i32(row[F_DIESIDES + e])
    lo = base + 1
    hi = base + max(sides, 1)
    return (lo, hi), eff


def main():
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    ids = json.load(io.open(os.path.join(DATA, "spellids.json"), encoding="utf-8"))
    scal = json.load(io.open(os.path.join(DATA, "scaling.json"), encoding="utf-8"))
    rel = json.load(io.open(os.path.join(DATA, "relations.json"), encoding="utf-8"))

    by, fc, _sb = load_spell_by_id()
    print("Spell.dbc fields:", fc, "records keyed:", len(by))

    # --- 1) EffectBasePoints vs Tooltip flat ---
    same = diff = only_tip = only_dbc = 0
    uses_same = uses_diff = uses_only_tip = uses_only_dbc = 0
    plain_same = plain_diff = plain_only_tip = plain_only_dbc = 0
    ratios = []
    examples_diff = []
    examples_uses = []

    for i in range(len(cat)):
        tip = (cat[i][5] or "")
        is_uses = bool(RX_USES.search(tip))
        flat = (scal[i] or {}).get("flat")
        row = by.get(ids[i][0])
        dmg = None
        if row:
            for e in range(3):
                rng, eff = effect_damage_range(row, e)
                if rng and rng[0] > 0 and eff in (
                        EFF_SCHOOL_DAMAGE, EFF_HEAL, EFF_HEALTH_LEECH):
                    # Prefer school damage over heal for "dmg" compare
                    if eff == EFF_SCHOOL_DAMAGE or dmg is None:
                        dmg = rng
                    if eff == EFF_SCHOOL_DAMAGE:
                        break
        if flat and dmg:
            if flat[0] == dmg[0] and flat[1] == dmg[1]:
                same += 1
                if is_uses:
                    uses_same += 1
                else:
                    plain_same += 1
            else:
                diff += 1
                if is_uses:
                    uses_diff += 1
                else:
                    plain_diff += 1
                if dmg[0] > 0:
                    ratios.append(float(flat[0]) / float(dmg[0]))
                if len(examples_diff) < 6:
                    examples_diff.append((cat[i][0], flat, dmg, is_uses))
                if is_uses and len(examples_uses) < 6:
                    examples_uses.append((cat[i][0], flat, dmg, tip[:80]))
        elif flat and not dmg:
            only_tip += 1
            if is_uses:
                uses_only_tip += 1
            else:
                plain_only_tip += 1
        elif dmg and not flat:
            only_dbc += 1
            if is_uses:
                uses_only_dbc += 1
            else:
                plain_only_dbc += 1

    print("\n=== EffectBasePoints vs scaling.flat ===")
    print("gesamt: same=%d diff=%d tip-only=%d dbc-only=%d" % (
        same, diff, only_tip, only_dbc))
    print("ohne 'uses modifiers': same=%d diff=%d tip-only=%d dbc-only=%d" % (
        plain_same, plain_diff, plain_only_tip, plain_only_dbc))
    print("mit  'uses modifiers': same=%d diff=%d tip-only=%d dbc-only=%d" % (
        uses_same, uses_diff, uses_only_tip, uses_only_dbc))
    if ratios:
        ratios.sort()
        print("flat/dbc ratio: min=%.3f median=%.3f max=%.3f n=%d" % (
            ratios[0], ratios[len(ratios) // 2], ratios[-1], len(ratios)))
        # bucket orders of magnitude
        buckets = collections.Counter()
        for r in ratios:
            if r < 0.5:
                buckets["<0.5"] += 1
            elif r < 2:
                buckets["0.5-2"] += 1
            elif r < 10:
                buckets["2-10"] += 1
            elif r < 50:
                buckets["10-50"] += 1
            else:
                buckets[">=50"] += 1
        print("ratio buckets:", dict(buckets))
    print("diff examples:")
    for n, f, d, u in examples_diff:
        print("  %-28s tip=%s dbc=%s uses=%s" % (n[:28], f, d, u))
    print("uses-diff examples:")
    for n, f, d, t in examples_uses:
        print("  %-28s tip=%s dbc=%s | %s" % (n[:28], f, d, t))

    # --- 2) Float effect fields: any SP/AP-like values? ---
    print("\n=== Float fields near effects (catalog damage spells) ===")
    # For spells with known tip SP% or AP%, do any float fields equal that %?
    sp_hits = ap_hits = w_hits = 0
    sp_match_field = collections.Counter()
    ap_match_field = collections.Counter()
    float_fields = list(range(F_REAL_PER_LEVEL, F_REAL_PER_LEVEL + 3))
    float_fields += list(range(F_MULTIPLE, F_MULTIPLE + 3))
    float_fields += list(range(F_COMBO, F_COMBO + 3))
    # Probe DmgMultiplier and neighbours as floats
    for base in (160, 163, 166, 169, 172, 175, 178):
        if base + 2 < fc:
            float_fields += list(range(base, base + 3))

    # Also scan ALL float-looking fields 71..220 for exact match to sp/ap
    scan_fields = [f for f in range(71, min(220, fc)) if f not in (
        F_BASEPOINTS, F_BASEPOINTS + 1, F_BASEPOINTS + 2,
        F_DIESIDES, F_DIESIDES + 1, F_DIESIDES + 2,
        F_EFFECT, F_EFFECT + 1, F_EFFECT + 2,
    )]

    for i in range(len(cat)):
        s = scal[i] or {}
        row = by.get(ids[i][0])
        if not row:
            continue
        targets = []
        if s.get("sp"):
            targets.append(("sp", float(s["sp"]), sp_match_field))
            sp_hits += 1
        if s.get("ap"):
            targets.append(("ap", float(s["ap"]), ap_match_field))
            ap_hits += 1
        if s.get("w"):
            targets.append(("w", float(s["w"]), None))
            w_hits += 1
        for kind, val, counter in targets:
            # Match as percent number OR as fraction
            want = {val, val / 100.0, val / 1000.0}
            for f in scan_fields:
                fv = f32_bits(row[f])
                if fv != fv:  # NaN
                    continue
                for w in want:
                    if abs(fv - w) < 1e-4 and abs(fv) > 1e-6:
                        if counter is not None:
                            counter[f] += 1
                        break

    print("catalog with tip sp%%=%d ap%%=%d w%%=%d" % (sp_hits, ap_hits, w_hits))
    print("Spell.dbc float fields matching tip SP%% (field->count):",
          dict(sp_match_field.most_common(12)) or "(none)")
    print("Spell.dbc float fields matching tip AP%% (field->count):",
          dict(ap_match_field.most_common(12)) or "(none)")

    # Nonzero rates for classic float coeff candidates
    nz = collections.Counter()
    nz_dmg = collections.Counter()  # among school-damage effects
    for i in range(len(cat)):
        row = by.get(ids[i][0])
        if not row:
            continue
        has_dmg = any(row[F_EFFECT + e] == EFF_SCHOOL_DAMAGE for e in range(3))
        for f in float_fields:
            fv = f32_bits(row[f])
            if fv == fv and abs(fv) > 1e-8:
                nz[f] += 1
                if has_dmg:
                    nz_dmg[f] += 1
    print("nonzero float candidates (catalog):")
    for f, n in sorted(nz.items()):
        print("  f%03d nz=%4d (dmg-eff subset %4d) sample values:" % (
            f, n, nz_dmg[f]), end=" ")
        vals = []
        for i in range(len(cat)):
            row = by.get(ids[i][0])
            if not row:
                continue
            fv = f32_bits(row[f])
            if abs(fv) > 1e-8 and fv == fv:
                vals.append(round(fv, 4))
                if len(vals) >= 5:
                    break
        print(vals)

    # EffectRealPointsPerLevel / Multiple / Combo / DmgMultiplier on damage spells
    print("\n=== Field usability summary (catalog) ===")
    counts = {
        "eff2_school_dmg": 0,
        "eff_weapon_pct": 0,
        "eff_weapon_dmg": 0,
        "eff_heal": 0,
        "realPerLvl_nz": 0,
        "multiple_nz": 0,
        "combo_nz": 0,
        "dmgMult_ne1": 0,
        "basepts_pos_on_dmg": 0,
    }
    for i in range(len(cat)):
        row = by.get(ids[i][0])
        if not row:
            continue
        for e in range(3):
            eff = row[F_EFFECT + e]
            if eff == EFF_SCHOOL_DAMAGE:
                counts["eff2_school_dmg"] += 1
                if i32(row[F_BASEPOINTS + e]) + 1 > 0:
                    counts["basepts_pos_on_dmg"] += 1
            elif eff == EFF_WEAPON_PERCENT:
                counts["eff_weapon_pct"] += 1
            elif eff == EFF_WEAPON_DAMAGE:
                counts["eff_weapon_dmg"] += 1
            elif eff == EFF_HEAL:
                counts["eff_heal"] += 1
            rpl = f32_bits(row[F_REAL_PER_LEVEL + e])
            if abs(rpl) > 1e-8:
                counts["realPerLvl_nz"] += 1
            mult = f32_bits(row[F_MULTIPLE + e])
            if abs(mult) > 1e-8:
                counts["multiple_nz"] += 1
            comb = f32_bits(row[F_COMBO + e])
            if abs(comb) > 1e-8:
                counts["combo_nz"] += 1
            if F_DMG_MULTIPLIER + e < fc:
                dm = f32_bits(row[F_DMG_MULTIPLIER + e])
                if abs(dm - 1.0) > 1e-4 and abs(dm) > 1e-8:
                    counts["dmgMult_ne1"] += 1
    for k, v in counts.items():
        print("  %s: %d" % (k, v))

    # Weapon %: EffectBasePoints for EFFECT_WEAPON_PERCENT_DAMAGE is often the %
    print("\n=== Weapon-percent effect vs tip w ===")
    w_same = w_diff = w_tip_only = w_dbc_only = 0
    w_ex = []
    for i in range(len(cat)):
        tip_w = (scal[i] or {}).get("w")
        row = by.get(ids[i][0])
        dbc_w = None
        if row:
            for e in range(3):
                if row[F_EFFECT + e] == EFF_WEAPON_PERCENT:
                    # Classic: display = basePoints+1 as percent
                    dbc_w = i32(row[F_BASEPOINTS + e]) + 1
                    break
        if tip_w is not None and dbc_w is not None:
            if abs(float(tip_w) - float(dbc_w)) < 0.01:
                w_same += 1
            else:
                w_diff += 1
                if len(w_ex) < 8:
                    w_ex.append((cat[i][0], tip_w, dbc_w))
        elif tip_w is not None:
            w_tip_only += 1
        elif dbc_w is not None:
            w_dbc_only += 1
    print("w same=%d diff=%d tip-only=%d dbc-only=%d" % (
        w_same, w_diff, w_tip_only, w_dbc_only))
    for n, t, d in w_ex:
        print("  %-28s tip_w=%s dbc_w=%s" % (n[:28], t, d))

    # --- 3) SpellAddon / SpellCustomAttr vs scaling presence ---
    print("\n=== SpellAddon vs scaling flags ===")
    addon_path = os.path.join(DBC, "SpellAddon.dbc")
    arc, afc, ars, adata, _ = read_dbc(addon_path)
    addon_by = {}
    for i in range(arc):
        row = struct.unpack_from("<%dI" % afc, adata, i * ars)
        addon_by[row[0]] = row
    print("SpellAddon rows=%d fields=%d catalog hits=%d" % (
        arc, afc, sum(1 for i in range(len(cat)) if ids[i][0] in addon_by)))

    # Correlate addon fields with has_sp / has_ap / has_w / has_flat / uses
    def scale_bucket(i):
        s = scal[i] or {}
        flags = []
        if s.get("sp") or s.get("spb"):
            flags.append("sp")
        if s.get("ap") or s.get("apb"):
            flags.append("ap")
        if s.get("w"):
            flags.append("w")
        if s.get("flat"):
            flags.append("flat")
        if RX_USES.search(cat[i][5] or ""):
            flags.append("uses")
        return flags

    # For each addon field 2..22, compare nonzero rate in bucket vs not
    buckets = ["sp", "ap", "w", "flat", "uses"]
    for bname in buckets:
        in_b = []
        out_b = []
        for i in range(len(cat)):
            sid = ids[i][0]
            row = addon_by.get(sid)
            if not row:
                continue
            if bname in scale_bucket(i):
                in_b.append(row)
            else:
                out_b.append(row)
        if not in_b:
            continue
        print("\n  bucket=%s n_in=%d n_out=%d (addon-present only)" % (
            bname, len(in_b), len(out_b)))
        for f in range(2, afc):
            zin = sum(1 for r in in_b if r[f]) / float(len(in_b))
            zout = (sum(1 for r in out_b if r[f]) / float(len(out_b))) if out_b else 0.0
            if zin < 0.02 and zout < 0.02:
                continue
            delta = zin - zout
            if abs(delta) >= 0.15 or (zin > 0.3 and abs(delta) >= 0.08):
                print("    f%02d in=%.1f%% out=%.1f%% delta=%+.1fpp" % (
                    f, 100 * zin, 100 * zout, 100 * delta))

    # Exact value match: does any addon uint equal tip sp/ap/w?
    exact = collections.Counter()
    for i in range(len(cat)):
        row = addon_by.get(ids[i][0])
        if not row:
            continue
        s = scal[i] or {}
        for key in ("sp", "ap", "w"):
            if key not in s:
                continue
            val = int(round(float(s[key])))
            for f in range(2, afc):
                if row[f] == val or row[f] == val * 100:
                    exact[(key, f)] += 1
    print("\n  addon exact match tip%%->field:", dict(exact) or "(none)")

    print("\n=== SpellCustomAttr vs scaling flags ===")
    ca_path = os.path.join(DBC, "SpellCustomAttr.dbc")
    crc, cfc, crs, cdata, _ = read_dbc(ca_path)
    ca_by = {}
    for i in range(crc):
        row = struct.unpack_from("<%dI" % cfc, cdata, i * crs)
        ca_by[row[0]] = row
    print("CustomAttr rows=%d fields=%d catalog hits=%d" % (
        crc, cfc, sum(1 for i in range(len(cat)) if ids[i][0] in ca_by)))

    for bname in buckets:
        in_b = []
        out_b = []
        for i in range(len(cat)):
            sid = ids[i][0]
            row = ca_by.get(sid)
            if not row:
                continue
            if bname in scale_bucket(i):
                in_b.append(row)
            else:
                out_b.append(row)
        if not in_b:
            continue
        print("\n  bucket=%s n_in=%d n_out=%d" % (bname, len(in_b), len(out_b)))
        for f in range(1, cfc):
            zin = sum(1 for r in in_b if r[f]) / float(len(in_b))
            zout = (sum(1 for r in out_b if r[f]) / float(len(out_b))) if out_b else 0.0
            if zin < 0.02 and zout < 0.02:
                continue
            delta = zin - zout
            if abs(delta) >= 0.12:
                print("    f%02d in=%.1f%% out=%.1f%% delta=%+.1fpp" % (
                    f, 100 * zin, 100 * zout, 100 * delta))
                # show top bit values for in-bucket
                bits = collections.Counter(r[f] for r in in_b if r[f])
                print("      top values:", bits.most_common(5))

    ca_exact = collections.Counter()
    for i in range(len(cat)):
        row = ca_by.get(ids[i][0])
        if not row:
            continue
        s = scal[i] or {}
        for key in ("sp", "ap", "w"):
            if key not in s:
                continue
            val = int(round(float(s[key])))
            for f in range(1, cfc):
                if row[f] == val or row[f] == val * 100:
                    ca_exact[(key, f)] += 1
    print("\n  customattr exact match tip%%->field:", dict(ca_exact) or "(none)")

    # Bit-overlap: any CustomAttr bit exclusive to SP spells?
    print("\n=== CustomAttr bits unique to tip-SP spells (weak signal only) ===")
    sp_rows = []
    other = []
    for i in range(len(cat)):
        row = ca_by.get(ids[i][0])
        if not row:
            continue
        s = scal[i] or {}
        if s.get("sp") or s.get("spb"):
            sp_rows.append(row)
        else:
            other.append(row)
    print("sp/spb with CustomAttr:", len(sp_rows))
    if sp_rows:
        for f in range(1, cfc):
            # bits set in ANY sp row
            or_sp = 0
            for r in sp_rows:
                or_sp |= r[f]
            or_ot = 0
            for r in other:
                or_ot |= r[f]
            unique = or_sp & ~or_ot
            if unique:
                print("  f%02d bits only in SP set: 0x%X (sp n=%d)" % (
                    f, unique, len(sp_rows)))

    # relations base for school variants — base EffectBasePoints vs variant tip
    print("\n=== School variants: tip flat vs BASE spell EffectBasePoints ===")
    # rel[i][0] = base index if variant
    match_base = miss_base = no_base_dmg = 0
    ex = []
    for i in range(len(cat)):
        base_i = rel[i][0] if rel[i] else None
        if base_i is None:
            continue
        flat = (scal[i] or {}).get("flat")
        if not flat:
            continue
        brow = by.get(ids[base_i][0])
        if not brow:
            continue
        bdmg = None
        for e in range(3):
            rng, eff = effect_damage_range(brow, e)
            if rng and eff == EFF_SCHOOL_DAMAGE and rng[0] > 0:
                bdmg = rng
                break
        if not bdmg:
            no_base_dmg += 1
            continue
        if flat[0] == bdmg[0] and flat[1] == bdmg[1]:
            match_base += 1
        else:
            miss_base += 1
            if len(ex) < 6:
                ex.append((cat[i][0], cat[base_i][0], flat, bdmg))
    print("variant tip flat == base DBC dmg: match=%d miss=%d no_base_dmg=%d" % (
        match_base, miss_base, no_base_dmg))
    for vn, bn, f, d in ex:
        print("  %s (base %s): tip %s base-dbc %s" % (vn, bn, f, d))

    print("\nDONE")


if __name__ == "__main__":
    main()
