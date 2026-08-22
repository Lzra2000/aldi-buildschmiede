# -*- coding: utf-8 -*-
"""Kompakte Darkmoon-Log-Meta aus oeffentlichen Ascension-Logs-APIs.

Kein Client, keine Spell-Koeffizienten, keine erfundenen Tooltip-Zahlen.
Rankings sind Selektion (wer loggt, Top-Parses) — kein Levelrun-Durchschnitt.

    python3 pipeline/logmeta.py              # Live, hoeflich, wenige GETs
    python3 pipeline/logmeta.py --from-cache # aus _tmp_ascensionlogs/

schreibt data/logmeta.json (assemble OPTIONAL_PAYLOAD → D.lmeta).

Quellen und Felder: pipeline/NOTES-ascensionlogs.md
"""
from __future__ import print_function

import collections
import io
import json
import os
import sys
import time
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
CACHE = os.path.join(ROOT, "_tmp_ascensionlogs")

BASE = "https://darkmoon.ascensionlogs.gg"
UA = (
    "BuildschmiedeLogmeta/1.0 "
    "(+https://lzra2000.github.io/aldi-buildschmiede/; "
    "guild tool; polite read-only remine)"
)
PAUSE = 1.5

# Logs-spec / primary_stat → Builder-Path-Key (scorePaths).
# Healing-Board: spec Healing, primary_stat spirit (= Addon-Path 4).
# Duality: primary_stat id 6 (Addon C_PrimaryStat).
SPEC_TO_PATH = {
    "intelligence": "int",
    "duality": "dua",
    "strength": "str",
    "agility": "agi",
    "healing": "heal",
    "hero": "unk",
    "talents": "unk",
}
PRIM_TO_PATH = {
    "intellect": "int",
    "duality": "dua",
    "strength": "str",
    "agility": "agi",
    "spirit": "heal",
}
TANK_SUFFIX = " tank"

# Zwei L60-Inspects (2026-08-22), nur Namen — kein BiS, kein Seed-Build.
# Effort: Duality (id 6). Blix-Inspect: Strength (id 1); Rankings-Zeilen
# von Blix wechseln Duality/Strength — Path ist nicht fest.
INSPECT_NOTE = (
    "Oeffentliche Armory-Inspects, L60. Kein BiS, kein Generator-Seed. "
    "Nur Beleg, dass entryId + Path im Inspect stehen."
)
INSPECTS = [
    {
        "name": "Effort",
        "path": "dua",
        "primId": 6,
        "hybrid": ["Volt Spike", "Consecrated Weapon"],
    },
    {
        "name": "Blix",
        "path": "str",
        "primId": 1,
        "hybrid": [],
    },
]
MELEE_OVERLAP = [
    "Aspect of the Beast", "Battle Charge", "Battle Stance", "Blade Flurry",
    "Blood Boil", "Cleave", "Icy Touch", "Improved Icy Talons",
    "Plague Strike", "Slice and Dice", "Unbreakable Armor",
    "Unholy Presence", "Voidborne",
]


def _get(url, dest_name, from_cache):
    dest = os.path.join(CACHE, dest_name)
    if from_cache and os.path.isfile(dest) and os.path.getsize(dest) > 20:
        raw = io.open(dest, encoding="utf-8").read()
        if raw[:1] in "{[":
            return json.loads(raw)
    os.makedirs(CACHE, exist_ok=True)
    req = urllib.request.Request(url, headers={
        "User-Agent": UA,
        "Accept": "application/json",
        "Referer": BASE + "/rankings",
    })
    print("GET", url)
    try:
        with urllib.request.urlopen(req, timeout=90) as resp:
            raw = resp.read()
            io.open(dest, "wb").write(raw)
            time.sleep(PAUSE)
            return json.loads(raw.decode("utf-8"))
    except urllib.error.HTTPError as e:
        print("  HTTP", e.code, url)
        time.sleep(PAUSE)
        return None
    except Exception as e:
        print("  ERR", type(e).__name__, e)
        time.sleep(PAUSE)
        return None


def _norm_spec(spec):
    s = (spec or "").strip().lower()
    tank = s.endswith(TANK_SUFFIX)
    if tank:
        s = s[: -len(TANK_SUFFIX)].strip()
    key = SPEC_TO_PATH.get(s, "unk")
    return key, tank


def _walk_phase(data):
    rows = []
    for _bid, block in ((data or {}).get("rankings") or {}).items():
        boss = ((block.get("boss") or {}).get("name")) or ""
        loc = ((block.get("boss") or {}).get("location")) or ""
        for diff, lst in (block.get("rankingsByDifficulty") or {}).items():
            for r in lst or []:
                spec = r.get("spec") or ""
                prim = (r.get("primary_stat") or "") or ""
                key, tank = _norm_spec(spec)
                if prim:
                    pk = PRIM_TO_PATH.get(str(prim).lower())
                    if pk:
                        key = pk
                rows.append({
                    "boss": boss,
                    "loc": loc,
                    "diff": diff,
                    "cid": r.get("character_id"),
                    "spec": spec,
                    "prim": prim or None,
                    "path": key,
                    "tank": tank,
                    "dps": r.get("avg_dps"),
                    "hps": r.get("avg_hps"),
                })
    return rows


def _path_counts(rows, unique_chars=False):
    if unique_chars:
        by = {}
        for r in rows:
            cid = r.get("cid")
            if cid is None:
                continue
            by.setdefault(cid, collections.Counter())[r["path"]] += 1
        c = collections.Counter()
        for cid, ctr in by.items():
            c[ctr.most_common(1)[0][0]] += 1
        n = len(by)
    else:
        c = collections.Counter(r["path"] for r in rows)
        n = len(rows)
    order = ("int", "dua", "str", "agi", "heal", "unk")
    out = []
    for k in order:
        v = int(c.get(k) or 0)
        if not v:
            continue
        pct = int(round(100.0 * v / n)) if n else 0
        out.append({"k": k, "n": v, "pct": pct})
    return out, n


def _wb_specs(wb):
    specs = collections.Counter()
    roles = collections.Counter()
    for boss in (wb or {}).get("bosses") or []:
        for role in ("dps", "tank", "healing", "supportDps", "supportHealing"):
            for r in boss.get(role) or []:
                specs[r.get("spec") or "?"] += 1
                roles[role] += 1
    return dict(specs), dict(roles)


def build(from_cache=False):
    active = _get(BASE + "/api/phases/active", "api_phases_active.json", from_cache)
    phase = (active or {}).get("phase") or {}
    pn = phase.get("phase_number")
    if pn is None:
        pn = 3
    pname = phase.get("name") or "Phase 2 - Molten Core / Onyxia"

    dps = _get(
        BASE + "/api/encounters/phase-rankings?phase=%s" % pn,
        "api_enc_phase_rank.json", from_cache,
    )
    hps = _get(
        BASE + "/api/encounters/phase-rankings?phase=%s&metric=avg_hps" % pn,
        "api_enc_phase_hps.json", from_cache,
    )
    wb = _get(BASE + "/api/home/world-bosses", "api_home_wb.json", from_cache)
    mplus = _get(
        BASE + "/api/mythic-plus/class-presence",
        "api_mplus_presence.json", from_cache,
    )
    home_mplus = _get(
        BASE + "/api/home/mythic-plus",
        "api_home_mplus.json", from_cache,
    )

    dps_rows = _walk_phase(dps)
    hps_rows = _walk_phase(hps)
    dps_paths, dps_n = _path_counts(dps_rows)
    dps_chars, dps_cn = _path_counts(dps_rows, unique_chars=True)
    hps_paths, hps_n = _path_counts(hps_rows)

    locs = collections.Counter(r["loc"] for r in dps_rows if r.get("loc"))
    diffs = collections.Counter(r["diff"] for r in dps_rows if r.get("diff"))
    prims = collections.Counter(
        str(r["prim"]).lower() for r in dps_rows if r.get("prim")
    )
    hps_prims = collections.Counter(
        str(r["prim"]).lower() for r in hps_rows if r.get("prim")
    )

    wb_specs, wb_roles = _wb_specs(wb)
    mp = mplus or {}
    hm = ((home_mplus or {}).get("realms") or [{}])[0]

    payload = {
        "v": 1,
        "src": BASE,
        "rankings": BASE + "/rankings",
        "realm": "Darkmoon",
        "mined": "2026-08-22",
        "phase": {"n": int(pn), "name": pname},
        "classless": True,
        "heroClass": "Hero",
        "blurb": (
            "Oeffentliche Top-Parses auf Darkmoon, "
            + pname
            + ". Wer loggt, steht vorn — das ist kein Levelrun-Durchschnitt "
            "und keine Schadensformel."
        ),
        "dps": {
            "scope": "phase-rankings metric=avg_dps, Top-10 je Boss/Schwierigkeit",
            "parses": dps_n,
            "chars": dps_cn,
            "locs": dict(locs),
            "diffs": dict(diffs),
            "paths": dps_paths,
            "charsByPath": dps_chars,
            "primaryStat": dict(prims),
        },
        "hps": {
            "scope": "phase-rankings metric=avg_hps, gleiche Bosse",
            "parses": hps_n,
            "paths": hps_paths,
            "primaryStat": dict(hps_prims),
        },
        "wb": {
            "scope": "GET /api/home/world-bosses All-Stars (alle Rollen)",
            "specs": wb_specs,
            "roles": wb_roles,
        },
        "mplus": {
            "attribution": mp.get("attribution") or "Leaderboard data: ascension.gg",
            "characters": int(mp.get("totalCharacters") or hm.get("totalCharacters") or 0),
            "hero": int(((mp.get("classes") or [{}])[0]).get("characters") or 0),
            "unattributed": int(mp.get("unattributed") or 0),
            "highestKey": int(hm.get("highestLevel") or 0),
            "specHint": "M+ zeigt oft spec=Talents/Hero — kein Path",
        },
        "ids": {
            "strength": 1,
            "agility": 2,
            "intelligence": 3,
            "healing": 4,
            "duality": 6,
            "note": "passt zu Addon C_PrimaryStat / PATH-Zeile",
        },
        "themeHint": {
            "ele": "dua",
            "cast": "int",
            "heal": "heal",
            "phys": "str",
        },
        "inspects": {
            "note": INSPECT_NOTE,
            "chars": INSPECTS,
            "meleeOverlap": MELEE_OVERLAP,
        },
        "omit": [
            "keine SP/AP-Koeffizienten aus Parses",
            "keine Tooltip-Zahlen aus Rankings",
            "keine Path-Score-Aenderung nur weil ein Path gerade oft vorkommt",
        ],
    }
    return payload


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    from_cache = "--from-cache" in argv
    payload = build(from_cache=from_cache)
    dest = os.path.join(DATA, "logmeta.json")
    text = json.dumps(payload, ensure_ascii=False, separators=(",", ":"))
    io.open(dest, "w", encoding="utf-8").write(text + "\n")
    kb = os.path.getsize(dest) / 1024.0
    print("geschrieben:", dest, "%.1f KB" % kb)
    dps = payload.get("dps") or {}
    print("DPS parses", dps.get("parses"), "chars", dps.get("chars"),
          "paths", dps.get("paths"))
    print("HPS parses", (payload.get("hps") or {}).get("parses"),
          (payload.get("hps") or {}).get("paths"))
    if kb > 16:
        raise SystemExit("logmeta.json %.1f KB — zu gross fuer OPTIONAL_PAYLOAD" % kb)


if __name__ == "__main__":
    main()
