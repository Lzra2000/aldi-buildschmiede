# -*- coding: utf-8 -*-
"""Prototype: Ascension SpellTag structural fingerprints for builds.

Novel method (Buildschmiede has none of this yet):
  SpellTags.dbc + SpellTagTypes.dbc give Ascension's official ability
  taxonomy (schools, CC, roles, power types, target types, ...).
  The site currently invents path tags from tooltip text only
  (pipeline/pathtags.py). This prototype maps catalog spellIds onto
  those client tags and scores builds for structural coverage.

Does NOT write into assemble.py / builder-app.js — research prototype.
Prints rankings + samples. Optional JSON: data/method-spelltags.json

Requires: C:\\Users\\x\\Documents\\AscensionDBC\\DBFilesClient\\
"""
from __future__ import print_function

import collections
import io
import json
import os
import struct
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
DBC = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
SPELLTAGS = os.path.join(DBC, "SpellTags.dbc")
TAGTYPES = os.path.join(DBC, "SpellTagTypes.dbc")

# Scoring facets for level-run builds (10-59). Tag ids from SpellTagTypes.
FACETS = [
    # key, label, tag_ids (any match counts as covered)
    ("mobility", "Mobility", {2}),
    ("interrupt", "Interrupt", {46}),
    ("hard_cc", "Hard CC", {862, 28, 57, 56, 26, 29, 30, 41, 43}),
    ("soft_cc", "Soft CC", {863, 36, 37, 32, 33, 23, 38}),
    ("defensive", "Defensive", {159}),
    ("direct_heal", "Direct Heal", {7, 9}),
    ("hot", "HoT", {6}),
    ("absorb", "Absorb", {10}),
    ("dot", "DoT", {5}),
    ("aoe", "AoE", {109}),
    ("cleave", "Cleave", {110}),
    ("single", "Single Target", {108}),
    ("melee", "Melee", {14, 859}),
    ("magic", "Magic Spell", {15, 858}),
    ("ranged", "Ranged", {16, 860}),
    ("dispel", "Dispel", {69, 70, 71, 72, 75, 76}),
    ("raid_buff", "Raid/Party Buff", {3, 120, 121}),
    ("taunt", "Taunt", {44}),
]

SCHOOL_TAGS = {
    17: "Physical", 18: "Fire", 19: "Frost", 20: "Nature",
    21: "Holy", 22: "Shadow", 126: "Arcane",
}

ROLE_TAGS = {122: "Tank", 123: "DPS", 124: "Healer", 125: "Hybrid"}


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        if magic != b"WDBC":
            raise SystemExit("not WDBC: %s" % path)
        records = fh.read(rc * rs)
        strings = fh.read(sbs)
    return rc, fc, rs, records, strings


def cstr(strings, off):
    if off <= 0 or off >= len(strings):
        return ""
    end = strings.find(b"\x00", off)
    if end < 0:
        end = len(strings)
    return strings[off:end].decode("utf-8", "replace")


def load_tag_types():
    rc, fc, rs, records, strings = read_dbc(TAGTYPES)
    types = {}
    for i in range(rc):
        row = struct.unpack_from("<" + "I" * (rs // 4), records, i * rs)
        tid = row[0]
        name = cstr(strings, row[27]) if len(row) > 27 else ""
        cat = cstr(strings, row[44]) if len(row) > 44 else ""
        types[tid] = {"id": tid, "name": name, "category": cat, "group": row[2]}
    return types


def load_spell_tags(wanted_spells):
    """spellId -> set(tagTypeId), only for wanted spells."""
    rc, fc, rs, records, _ = read_dbc(SPELLTAGS)
    out = collections.defaultdict(set)
    wanted = set(wanted_spells)
    for i in range(rc):
        _rid, spell_id, tag_type = struct.unpack_from("<III", records, i * rs)
        if spell_id in wanted:
            out[spell_id].add(tag_type)
    return out


def catalog_spell_ids():
    ids = json.load(io.open(os.path.join(DATA, "spellids.json"), encoding="utf-8"))
    # spellids.json: [spellId, castMs, minRange, maxRange, passive, entryId]
    spell_ids = []
    for row in ids:
        sid = row[0] if isinstance(row, list) else 0
        spell_ids.append(int(sid or 0))
    return spell_ids


def parse_export_names(path):
    """Collect ability/talent names from a Buildschmiede export (best-effort)."""
    names = []
    if not os.path.exists(path):
        return names
    for ln in io.open(path, encoding="utf-8"):
        ln = ln.strip()
        if ln.startswith("ABI|") or ln.startswith("TAL|"):
            body = ln.split("|", 1)[1]
            for part in body.split(";"):
                part = part.strip()
                if not part:
                    continue
                # Name[#spellId][@entryId] or Name:rank#...
                base = part.split("#", 1)[0]
                base = base.split(":", 1)[0]
                names.append(base.strip())
    return names


def build_name_index(cat):
    idx = {}
    for i, row in enumerate(cat):
        idx.setdefault(row[0].lower(), []).append(i)
    return idx


def resolve_names(names, name_index):
    found = []
    miss = []
    for n in names:
        hits = name_index.get(n.lower())
        if hits:
            found.append(hits[0])
        else:
            miss.append(n)
    return found, miss


def facet_coverage(tag_sets):
    """tag_sets: list of set(tagId) for each ability in the build."""
    union = set()
    for ts in tag_sets:
        union |= ts
    covered = {}
    for key, label, want in FACETS:
        covered[key] = {
            "label": label,
            "ok": bool(union & want),
            "hits": sorted(union & want),
        }
    schools = sorted(SCHOOL_TAGS[t] for t in union if t in SCHOOL_TAGS)
    roles = sorted(ROLE_TAGS[t] for t in union if t in ROLE_TAGS)
    return covered, schools, roles, union


def score_build(covered):
    """Level-run priority weights: gaps in mobility/interrupt/soft CC hurt more."""
    weights = {
        "mobility": 12, "interrupt": 14, "hard_cc": 8, "soft_cc": 10,
        "defensive": 9, "direct_heal": 7, "hot": 4, "absorb": 5,
        "dot": 3, "aoe": 6, "cleave": 4, "single": 2,
        "melee": 1, "magic": 1, "ranged": 1, "dispel": 6,
        "raid_buff": 5, "taunt": 3,
    }
    total = 0
    max_total = 0
    gaps = []
    for key, _label, _want in FACETS:
        w = weights.get(key, 1)
        max_total += w
        if covered[key]["ok"]:
            total += w
        else:
            gaps.append((w, key, covered[key]["label"]))
    gaps.sort(reverse=True)
    return total, max_total, gaps


def rank_fillers(catalog, spell_ids, spell_tags, gap_keys, have_indices, limit=12):
    """Catalog entries that best fill the biggest gaps, not already in build."""
    have = set(have_indices)
    gap_tag_sets = {k: next(want for key, _l, want in FACETS if key == k) for k in gap_keys}
    scored = []
    for i, row in enumerate(catalog):
        if i in have:
            continue
        sid = spell_ids[i] if i < len(spell_ids) else 0
        if not sid:
            continue
        tags = spell_tags.get(sid) or set()
        if not tags:
            continue
        fill = 0
        filled = []
        for gk in gap_keys:
            if tags & gap_tag_sets[gk]:
                fill += 1
                filled.append(gk)
        if fill:
            # Prefer lower level for leveling runs, and Spells over deep talents.
            lvl = row[4] or 0
            kind = row[1]  # 0 spell, 1 talent
            bonus = (10 - min(lvl, 60) / 6.0) + (2 if kind == 0 else 0)
            scored.append((fill * 10 + bonus, fill, i, filled, sid, tags))
    scored.sort(reverse=True)
    return scored[:limit]


def print_build_report(title, indices, catalog, spell_ids, spell_tags, miss=None):
    print()
    print("=" * 72)
    print(title)
    print("=" * 72)
    tag_sets = []
    tagged = 0
    for i in indices:
        sid = spell_ids[i] if i < len(spell_ids) else 0
        tags = spell_tags.get(sid) or set()
        tag_sets.append(tags)
        if tags:
            tagged += 1
        name = catalog[i][0]
        kind = "TAL" if catalog[i][1] else "ABI"
        print("  [%s] %-32s spellId=%-7s tags=%d" % (kind, name[:32], sid, len(tags)))

    covered, schools, roles, union = facet_coverage(tag_sets)
    total, max_total, gaps = score_build(covered)
    print()
    print("Coverage score: %d / %d (%.0f%%)  |  tagged %d/%d entries  |  %d unique tags" % (
        total, max_total, 100.0 * total / max_total if max_total else 0,
        tagged, len(indices), len(union)))
    print("Schools:", ", ".join(schools) or "(none tagged)")
    print("Roles:  ", ", ".join(roles) or "(none tagged)")
    print()
    print("Facets:")
    for key, label, _ in FACETS:
        mark = "OK " if covered[key]["ok"] else "GAP"
        print("  [%s] %-16s %s" % (mark, label, covered[key]["hits"] or ""))
    if gaps:
        print()
        print("Top gaps (by weight):")
        for w, key, label in gaps[:6]:
            print("  -%2d  %s (%s)" % (w, label, key))
        fillers = rank_fillers(
            catalog, spell_ids, spell_tags,
            [g[1] for g in gaps[:4]], indices, limit=10)
        print()
        print("Suggested fillers for those gaps:")
        for sc, fill, i, filled, sid, tags in fillers:
            row = catalog[i]
            print("  %+5.1f  fill=%d  L%-2s %-28s [%s]  covers=%s" % (
                sc, fill, row[4], row[0][:28],
                "TAL" if row[1] else "ABI",
                ",".join(filled)))
    if miss:
        print()
        print("Export names not in catalog:", ", ".join(miss[:12]))


def sample_archetypes(catalog, name_index):
    """Hand-picked name clusters for demo rankings (no invented numbers)."""
    sets = {
        "Frost caster core": [
            "Frostbolt", "Ice Lance", "Cone of Cold", "Frost Nova",
            "Blink", "Counterspell", "Ice Barrier", "Cold Snap",
        ],
        "Bear leveling core": [
            "Bear Form", "Mangle", "Swipe", "Maul", "Growl",
            "Frenzied Regeneration", "Barkskin", "Demoralizing Roar",
        ],
        "Enhancement-ish": [
            "Stormstrike", "Lava Lash", "Lightning Bolt", "Earth Shock",
            "Windfury Weapon", "Shamanistic Rage", "Flame Shock",
        ],
    }
    out = {}
    for title, names in sets.items():
        found, miss = resolve_names(names, name_index)
        out[title] = (found, miss)
    return out


def write_json(path, payload):
    io.open(path, "w", encoding="utf-8").write(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n"
    )


def main():
    if not os.path.exists(SPELLTAGS) or not os.path.exists(TAGTYPES):
        print("DBC missing under", DBC, file=sys.stderr)
        return 1

    catalog = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    spell_ids = catalog_spell_ids()
    if len(spell_ids) != len(catalog):
        print("WARN: spellids len %d != catalog %d" % (len(spell_ids), len(catalog)))

    print("Loading SpellTagTypes...")
    types = load_tag_types()
    print("  %d tag types" % len(types))

    wanted = [s for s in spell_ids if s]
    print("Loading SpellTags for %d catalog spellIds..." % len(wanted))
    spell_tags = load_spell_tags(wanted)
    print("  %d catalog spells have >=1 tag" % len(spell_tags))

    # Global tag frequency on catalog
    freq = collections.Counter()
    for tags in spell_tags.values():
        for t in tags:
            freq[t] += 1
    print()
    print("Top SpellTags on catalog (name | count):")
    for tid, n in freq.most_common(20):
        meta = types.get(tid, {})
        print("  %5d  %-36s  %4d" % (tid, (meta.get("name") or "?")[:36], n))

    name_index = build_name_index(catalog)

    # Archetype demos
    for title, (found, miss) in sample_archetypes(catalog, name_index).items():
        print_build_report(
            "Archetype: " + title, found, catalog, spell_ids, spell_tags, miss)

    # Test export if present
    export = os.path.join(DATA, "testexport-charakter.txt")
    names = parse_export_names(export)
    if names:
        found, miss = resolve_names(names, name_index)
        print_build_report(
            "Testexport: " + os.path.basename(export),
            found, catalog, spell_ids, spell_tags, miss)

    # Compact JSON for later website consumption (not wired into assemble yet)
    # Per catalog index: sorted list of facet keys hit + school names.
    # Level-run weights (same as score_build) — website can reuse without
    # inventing numbers; only structural tag presence is scored.
    FACET_WEIGHTS = {
        "mobility": 12, "interrupt": 14, "hard_cc": 8, "soft_cc": 10,
        "defensive": 9, "direct_heal": 7, "hot": 4, "absorb": 5,
        "dot": 3, "aoe": 6, "cleave": 4, "single": 2,
        "melee": 1, "magic": 1, "ranged": 1, "dispel": 6,
        "raid_buff": 5, "taunt": 3,
    }

    per_entry = []
    facet_lookup = [(key, want) for key, _l, want in FACETS]
    for i, sid in enumerate(spell_ids):
        tags = spell_tags.get(sid) or set()
        facets = [key for key, want in facet_lookup if tags & want]
        schools = [SCHOOL_TAGS[t] for t in sorted(tags) if t in SCHOOL_TAGS]
        roles = [ROLE_TAGS[t] for t in sorted(tags) if t in ROLE_TAGS]
        per_entry.append({
            "i": i,
            "spellId": sid,
            "facets": facets,
            "schools": schools,
            "roles": roles,
            "tagCount": len(tags),
        } if tags else None)

    tagged_n = sum(1 for e in per_entry if e)
    out_path = os.path.join(DATA, "method-spelltags.json")
    write_json(out_path, {
        "method": "spelltags-structural-fingerprint",
        "source": ["SpellTags.dbc", "SpellTagTypes.dbc"],
        "catalogSize": len(catalog),
        "taggedEntries": tagged_n,
        "facets": [
            {
                "key": k,
                "label": l,
                "tagIds": sorted(t),
                "weight": FACET_WEIGHTS.get(k, 1),
            }
            for k, l, t in FACETS
        ],
        "schools": [{"tagId": tid, "name": name}
                    for tid, name in sorted(SCHOOL_TAGS.items())],
        "roles": [{"tagId": tid, "name": name}
                  for tid, name in sorted(ROLE_TAGS.items())],
        "entries": [e for e in per_entry if e],
    })
    print()
    print("Wrote", out_path, "(%d tagged entries)" % tagged_n)
    return 0


if __name__ == "__main__":
    sys.exit(main() or 0)
