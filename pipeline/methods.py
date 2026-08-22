# -*- coding: utf-8 -*-
"""Drei abgeleitete Methoden aus Katalog + Scaling + Mechanik + Relations.

Keine neuen Client-Daten, keine erfundenen Koeffizienten. Jede Zahl kommt
aus data/*.json (Tooltip-Parser oder Spell.dbc). Was fehlt, wird als Luecke
markiert — nicht geraten.

Ausgabe: data/methods.json  (ein Block, drei Methoden)

  tempo    Levelrun-Tempo-Score (Waffen-% / CD, Level 10–59)
  modheat  Modifier-Ketten-Hitze (basemods × Schulvarianten)
  gaps     Ehrliche Zahlenluecken (Schadenstext ohne messbare Skalierung)

  python3 pipeline/methods.py
"""
from __future__ import print_function

import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")

GCD = 1.5          # Fallback nur wenn DBC keinen CD liefert
LVL_LO, LVL_HI = 10, 59
TEMPO_TOP = 80
HEAT_TOP = 40
GAPS_TOP = 100

# Schaden/Heilung austeilen — nicht „damage taken“ / Buff-Floskeln.
RX_DEALS = re.compile(
    r"(?:deal(?:s|ing)?|cause(?:s|ing)?|inflict(?:s|ing)?)\s+"
    r".{0,60}?damage"
    r"|weapon'?s?\s+damage"
    r"|\d[\d,]*(?:\.\d+)?\s*%\s*.{0,30}?weapon"
    r"|\d[\d,]*(?:\.\d+)?\s+to\s+\d[\d,]*(?:\.\d+)?\s+\w*\s*damage"
    r"|heal(?:s|ing)?\s+.{0,80}?for\s+\d",
    re.I,
)
RX_NOT_DEALS = re.compile(
    r"damage\s+taken|reduc(?:es?|ing)\s+.{0,40}?damage|absorb|immune",
    re.I,
)

SCALE_KEYS = ("w", "flat", "ap", "sp", "heal", "tick")


def load(name):
    return json.load(io.open(os.path.join(DATA, name), encoding="utf-8"))


def conf_for(sc, mc):
    """Vertrauensstufe: nie SP/AP erfinden — Flat ohne Koeffizient = low."""
    has_w = "w" in sc
    has_cd = "cd" in mc
    has_ap = "ap" in sc or "apb" in sc
    has_sp = "sp" in sc or "spb" in sc
    has_flat = "flat" in sc or "tick" in sc
    if has_w and has_cd:
        return "high"
    if has_w:
        return "mid"          # CD auf GCD geschaetzt
    if has_flat and (has_ap or has_sp):
        return "mid" if has_cd else "low"
    if has_flat:
        return "low"          # Flat ohne SP/AP-Koeffizient
    return "none"


def build_tempo(cat, sc, mc):
    """Waffen-% / effektiver CD — ehrlicher Levelrun-Proxy.

    Nur Eintraege mit messbarem Waffen-% (oder AP/SP-Prozent). Flat ohne
    Koeffizient kommt in die Liste mit conf=low und score=0 — sichtbar, aber
    nicht als DPS gerankt.
    """
    ranked = []
    flagged = []
    for i, rec in enumerate(cat):
        if rec[1] != 0:
            continue
        lvl = rec[4] or 0
        if lvl < LVL_LO or lvl > LVL_HI:
            continue
        s = sc[i] or {}
        m = mc[i] or {}
        conf = conf_for(s, m)
        if conf == "none":
            continue
        cd = m.get("cd")
        # SpellCharges: effektiver Takt = Recharge / maxCharges (DBC),
        # sonst Category-CD, sonst GCD. Keine erfundenen Werte.
        ch = m.get("ch")
        chr_s = m.get("chr")
        cd_eff = None
        cd_src = None
        if ch and chr_s and float(ch) > 0:
            cd_eff = float(chr_s) / float(ch)
            cd_src = "charges"
        elif cd:
            cd_eff = float(cd)
            cd_src = "cd"
        else:
            cd_eff = GCD
            cd_src = "gcd"
        if cd_eff < 0.5:
            cd_eff = 0.5
        # conf: Charges aus DBC zaehlen wie ein echter CD
        if conf == "mid" and cd_src == "charges" and "w" in s:
            conf = "high"
        elif conf == "low" and cd_src == "charges" and (
            "ap" in s or "sp" in s or "apb" in s or "spb" in s
        ):
            conf = "mid"
        w = s.get("w")
        ap = s.get("ap")
        sp = s.get("sp")
        score = None
        basis = None
        if w is not None:
            score = round(float(w) / cd_eff, 2)
            basis = "w"
        elif ap is not None:
            score = round(float(ap) / cd_eff, 2)
            basis = "ap"
        elif sp is not None:
            score = round(float(sp) / cd_eff, 2)
            basis = "sp"
        else:
            # Flat ohne Koeffizient: kein Tempo-Score, nur Hinweis.
            flagged.append({
                "i": i,
                "lvl": lvl,
                "conf": "low",
                "why": "flat_ohne_koeffizient",
                "flat": s.get("flat"),
                "cd": cd,
                "ch": ch,
                "chr": chr_s,
            })
            continue
        row = {
            "i": i,
            "s": score,
            "lvl": lvl,
            "conf": conf,
            "basis": basis,
            "cd": cd if cd is not None else None,
            "cdEff": round(cd_eff, 2),
            "cdSrc": cd_src,
        }
        if ch is not None:
            row["ch"] = ch
        if chr_s is not None:
            row["chr"] = chr_s
        if w is not None:
            row["w"] = w
            if "sch" in s:
                row["sch"] = s["sch"]
        if ap is not None:
            row["ap"] = ap
        if sp is not None:
            row["sp"] = sp
        if m.get("res"):
            row["res"] = m["res"]
            row["cost"] = m.get("cost")
        ranked.append(row)

    ranked.sort(key=lambda r: (-r["s"], r["lvl"], r["i"]))
    high = [r for r in ranked if r["conf"] == "high"]
    return {
        "gcd": GCD,
        "lvl": [LVL_LO, LVL_HI],
        "n": len(ranked),
        "nHigh": len(high),
        "topHigh": high[:TEMPO_TOP],
        "top": ranked[:TEMPO_TOP],
        "flatOhneKoeff": flagged[:40],
        "note": (
            "Score = messbarer Anteil (Waffen-%% / AP-%% / SP-%%) geteilt durch "
            "effektiven Takt: DBC-CD, sonst Charges chr/ch, sonst GCD %.1fs. "
            "Flat-Schaden ohne genannten Koeffizienten wird nicht gerankt. "
            "topHigh = nur conf=high."
            % GCD
        ),
    }


def build_modheat(cat, rel, bm):
    """Talent-Hitze: wie viele Abilities profitieren, wenn das Talent greift.

    Schulvarianten erben die Talente der Basis (nicht die Basis selbst).
    Hitze eines Talents = Anzahl Abilities mit derselben Basis (Basis + Varianten).
    Hitze einer Basis = Varianten × modifizierende Talente.
    """
    variants = {}
    for i, r in enumerate(rel):
        b = r[0]
        if b is None:
            continue
        variants.setdefault(b, []).append(i)

    # Talent -> maximale Reichweite ueber alle Basen, die es modifiziert
    talent_heat = {}
    talent_bases = {}
    for b_str, talents in bm.items():
        b = int(b_str)
        chain = variants.get(b, [b])
        reach = len(chain)
        for t in talents:
            if reach > talent_heat.get(t, 0):
                talent_heat[t] = reach
                talent_bases[t] = b

    talents = sorted(
        (
            {
                "i": t,
                "h": talent_heat[t],
                "base": talent_bases[t],
            }
            for t in talent_heat
        ),
        key=lambda r: (-r["h"], r["i"]),
    )

    bases = []
    for b, chain in variants.items():
        tals = bm.get(str(b)) or bm.get(b) or []
        if not tals and len(chain) < 2:
            continue
        bases.append({
            "i": b,
            "v": len(chain),
            "t": len(tals),
            "h": len(chain) * max(len(tals), 1),
            "orphan": 1 if (len(chain) >= 3 and not tals) else 0,
        })
    bases.sort(key=lambda r: (-r["h"], -r["v"], r["i"]))

    return {
        "nTalents": len(talents),
        "nBases": len(bases),
        "talents": talents[:HEAT_TOP],
        "bases": bases[:HEAT_TOP],
        "orphans": [b for b in bases if b["orphan"]][:20],
        "note": (
            "Hitze eines Talents = wie viele Katalog-Abilities dieselbe Basis "
            "nutzen (inkl. Schulvarianten). Orphan = Variantenfamilie ohne "
            "bekanntes Modifier-Talent in basemods."
        ),
    }


def build_gaps(cat, sc):
    """Abilities mit Schadenstext, aber ohne messbare Skalierungszahl."""
    items = []
    for i, rec in enumerate(cat):
        if rec[1] != 0:
            continue
        desc = rec[5] or ""
        if not RX_DEALS.search(desc):
            continue
        if RX_NOT_DEALS.search(desc) and not re.search(
            r"weapon'?s?\s+damage|deal(?:s|ing)?\s+.{0,40}?damage", desc, re.I
        ):
            continue
        s = sc[i] or {}
        if any(k in s for k in SCALE_KEYS):
            continue
        why = "schadenstext_ohne_zahl"
        if "inc" in s or "red" in s:
            why = "nur_multiplikator_kein_basisschaden"
        elif "proc" in s:
            why = "proc_ohne_schaden"
        elif "apb" in s or "spb" in s:
            why = "skaliert_ohne_prozent"
        elif "dot" in s:
            why = "dot_ohne_tickzahl"
        lvl = rec[4] or 0
        items.append({
            "i": i,
            "lvl": lvl,
            "q": rec[3] or 0,
            "why": why,
            "hasInc": 1 if "inc" in s else 0,
            "band": 1 if LVL_LO <= lvl <= LVL_HI else 0,
        })

    # Levelrun zuerst, dann ehrliche Restluecken
    items.sort(key=lambda r: (-r["band"], r["lvl"], r["i"]))
    by_why = {}
    for it in items:
        by_why[it["why"]] = by_why.get(it["why"], 0) + 1
    n_band = sum(1 for it in items if it["band"])
    return {
        "n": len(items),
        "nBand": n_band,
        "lvl": [LVL_LO, LVL_HI],
        "byWhy": by_why,
        "items": items[:GAPS_TOP],
        "note": (
            "Katalog beschreibt Schaden/Heilung, scaling.json liefert aber weder "
            "Waffen-%%, Flat, AP-%%, SP-%%, Heal noch Tick. Kein Koeffizient erfunden. "
            "nBand = Luecken in Level %d-%d."
            % (LVL_LO, LVL_HI)
        ),
    }


def build_resmap(cat, mc):
    """Mehrpool-Karte: Ressourcenkosten aus der DBC, Pools duerfen koexistieren."""
    pools = {}
    for i, rec in enumerate(cat):
        if rec[1] != 0:
            continue
        m = mc[i] or {}
        res = m.get("res")
        if not res:
            continue
        bucket = pools.setdefault(res, {"n": 0, "costSum": 0, "samples": []})
        bucket["n"] += 1
        cost = m.get("cost") or 0
        try:
            bucket["costSum"] += float(cost)
        except (TypeError, ValueError):
            pass
        if len(bucket["samples"]) < 8:
            bucket["samples"].append({
                "i": i,
                "cost": cost,
                "cd": m.get("cd"),
                "lvl": rec[4] or 0,
            })
    # Kosten-Summe runden
    for b in pools.values():
        b["costSum"] = round(b["costSum"], 1)
    return {
        "pools": pools,
        "note": (
            "Alle Ressourcenpools existieren gleichzeitig — Wut+Energie ist "
            "kein Fehler. Zahlen aus Spell.dbc (mechanics.json)."
        ),
    }


# CatalogData.lua: …, level, desiredEligible }
_RX_CATALOG_DESIRE = re.compile(
    r'^\s*\{\s*"(Spell|Talent)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
    r'(\d+)\s*,\s*(\d+)\s*,'
    r'.*,\s*(true|false)\s*\}\s*,?\s*$'
)


def build_rollgate(cat, ids):
    """Wildcard desiredEligible aus oeffentlichem CatalogData.lua.

    false = nicht fuer Desired/Rapid-Roll vorgesehen (Client-Feld).
    Keine Heuristik — nur gematchte spellIds.
    """
    path = os.path.join(DATA, "CatalogData.lua")
    if not os.path.isfile(path):
        return {
            "n": 0,
            "nFalse": 0,
            "matched": 0,
            "blocked": [],
            "note": "CatalogData.lua fehlt — rollgate uebersprungen.",
        }

    sid_to_i = {}
    for i, row in enumerate(ids):
        sid = int(row[0] or 0)
        if sid and sid not in sid_to_i:
            sid_to_i[sid] = i

    blocked = []
    matched = 0
    n_false = 0
    for ln in io.open(path, encoding="utf-8", errors="replace"):
        m = _RX_CATALOG_DESIRE.match(ln.rstrip())
        if not m:
            continue
        sid = int(m.group(3))
        eligible = m.group(5) == "true"
        idx = sid_to_i.get(sid)
        if idx is None:
            continue
        matched += 1
        if not eligible:
            n_false += 1
            rec = cat[idx]
            blocked.append({
                "i": idx,
                "spellId": sid,
                "lvl": rec[4] or 0,
                "q": rec[3] or 0,
                "kind": rec[1],
            })

    blocked.sort(key=lambda r: (r["lvl"], r["i"]))
    return {
        "n": matched,
        "nFalse": n_false,
        "matched": matched,
        "blocked": blocked[:80],
        "note": (
            "desiredEligible=false aus CatalogData.lua (oeffentlicher "
            "Season10-Export). Diese Eintraege sind im Wildcard-Roll nicht "
            "als Desired vorgesehen — Filter, kein Schadenskoeffizient."
        ),
    }


def main():
    cat = load("catalog.json")
    sc = load("scaling.json")
    mc = load("mechanics.json")
    rel = load("relations.json")
    bm = load("basemods.json")
    ids = load("spellids.json")

    assert len(cat) == len(sc) == len(mc) == len(rel) == len(ids), "Laengen drift"

    out = {
        "v": 2,
        "tempo": build_tempo(cat, sc, mc),
        "modheat": build_modheat(cat, rel, bm),
        "gaps": build_gaps(cat, sc),
        "resmap": build_resmap(cat, mc),
        "rollgate": build_rollgate(cat, ids),
    }

    dest = os.path.join(DATA, "methods.json")
    io.open(dest, "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    )

    t = out["tempo"]
    h = out["modheat"]
    g = out["gaps"]
    print("Geschrieben:", dest)
    print("  Tempo-Kandidaten:", t["n"], "| high:", t.get("nHigh", 0),
          "| Top:", len(t["top"]),
          "| Flat-ohne-Koeff:", len(t["flatOhneKoeff"]))
    if t.get("topHigh"):
        i0 = t["topHigh"][0]["i"]
        print("  Tempo high #1: %s  score=%s cd=%s" % (
            cat[i0][0], t["topHigh"][0]["s"], t["topHigh"][0].get("cd")))
    elif t["top"]:
        i0 = t["top"][0]["i"]
        print("  Tempo #1: %s  score=%s conf=%s" % (
            cat[i0][0], t["top"][0]["s"], t["top"][0]["conf"]))
    print("  Modheat-Talente:", h["nTalents"], "| Basen:", h["nBases"],
          "| Orphans:", len(h["orphans"]))
    if h["talents"]:
        ti = h["talents"][0]["i"]
        print("  Hitze #1 Talent: %s  h=%s (Basis %s)" % (
            cat[ti][0], h["talents"][0]["h"], cat[h["talents"][0]["base"]][0]))
    print("  Zahlenluecken:", g["n"], "| Levelrun-Band:", g.get("nBand"), g["byWhy"])
    print("  Ressourcenpools:", sorted(out["resmap"]["pools"].keys()))
    rg = out["rollgate"]
    print("  Rollgate: matched=%s blocked(false)=%s (listed %s)" % (
        rg.get("matched"), rg.get("nFalse"), len(rg.get("blocked") or [])))


if __name__ == "__main__":
    main()
