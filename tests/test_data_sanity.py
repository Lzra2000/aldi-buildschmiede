# -*- coding: utf-8 -*-
"""Daten-Invarianten: Kataloglaenge, Mechanik-Spannen, optionale JSON-Payloads.

Nur Standardbibliothek. Keine erfundenen Spell-Zahlen — nur Plausibilitaetsgrenzen
aus AGENTS.md (Wut <= 100, Reichweite <= 100 m, Cast <= 10 s).

    python tests/test_data_sanity.py
    python -m unittest tests.test_data_sanity -v
    python -m pytest tests/test_data_sanity.py -q   # optional
"""
from __future__ import print_function

import json
import os
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")

CATALOG_LEN = 3071
# Optionale Pipeline-Outputs (Keys wie assemble.py OPTIONAL_PAYLOAD).
OPTIONAL_JSON = (
    ("methods.json", "meth"),
    ("method-spelltags.json", "stags"),
    ("tagnames.json", "tagn"),
    ("statsuggest.json", "ssug"),
    ("spellsuggest.json", "ssugsp"),
    ("desireelig.json", "des"),
    ("spectags.json", "tree"),
    ("itemicons.json", "iic"),
    ("ilvlbands.json", "ilb"),
    ("weapons.json", "wpn"),
    ("formtags.json", "frm"),
    ("pathreq.json", "preq"),
)
# Parallele Arrays: assemble-Deckel 64 KB (des / tree / frm).
PARALLEL_EMBED_MAX_KB = 64
ITEMICONS_EMBED_MAX_KB = 512
# Gemessen 2026-08-22 (CatalogData 2026-07-27 / bestehendes spectags.json).
DESIRE_FALSE_N = 104
SPECTAGS_FILLED_N = 1335
SPECTAGS_KNOWN = frozenset((
    "Affliction", "Arcane", "Arms", "Assassination", "Balance",
    "BeastMastery", "Blood", "Combat", "Demonology", "Destruction",
    "Discipline", "Elemental", "Enhancement", "Feral", "Fire",
    "Frost", "Fury", "Holy", "Marksmanship", "Protection",
    "Restoration", "Retribution", "Shadow", "Subtlety", "Survival",
    "Unholy",
))
SSUG_PATHS = frozenset(("Strength", "Agility", "Intelligence", "Healing"))
SSUG_ANCHORS = (
    (100, "Strength"),
    (53, "Agility"),
    (116, "Intelligence"),
    (139, "Healing"),
)


def _load(name):
    path = os.path.join(DATA, name)
    if not os.path.isfile(path):
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


class TestDataSanity(unittest.TestCase):
    def test_catalog_length(self):
        cat = _load("catalog.json")
        self.assertIsNotNone(cat, "data/catalog.json fehlt")
        self.assertIsInstance(cat, list)
        self.assertEqual(
            len(cat), CATALOG_LEN,
            "catalog.json Laenge %s != %s" % (len(cat), CATALOG_LEN),
        )

    def test_mechanics_invariants(self):
        mc = _load("mechanics.json")
        self.assertIsNotNone(mc, "data/mechanics.json fehlt")
        self.assertIsInstance(mc, list)
        self.assertEqual(
            len(mc), CATALOG_LEN,
            "mechanics.json Laenge %s != Katalog %s" % (len(mc), CATALOG_LEN),
        )

        bad_rage = []
        bad_range = []
        bad_cast = []
        bad_proc = []
        for i, e in enumerate(mc):
            if not e or not isinstance(e, dict):
                continue
            res = e.get("res")
            cost = e.get("cost")
            # Wut/Runenmacht: DBC-Zehntel -> Spielwert; Cap 100 (AGENTS.md).
            if res in ("Wut", "Runenmacht") and cost is not None:
                if not isinstance(cost, (int, float)) or cost < 0 or cost > 100:
                    bad_rage.append((i, res, cost))
            rng = e.get("range")
            if rng is not None and (
                not isinstance(rng, (int, float)) or rng < 0 or rng > 100
            ):
                bad_range.append((i, rng))
            cast = e.get("cast")
            if cast is not None and (
                not isinstance(cast, (int, float)) or cast < 0 or cast > 10
            ):
                bad_cast.append((i, cast))
            # Spell.dbc procChance: nur 1–99. 101 = immer, nie als Prozent.
            proc = e.get("proc")
            if proc is not None and (
                not isinstance(proc, int) or isinstance(proc, bool)
                or proc < 1 or proc > 99
            ):
                bad_proc.append((i, proc))

        self.assertEqual(
            bad_rage[:10], [],
            "Wut/Runenmacht cost >100 oder ungueltig: %s" % bad_rage[:10],
        )
        self.assertEqual(bad_range[:10], [], "range >100 m: %s" % bad_range[:10])
        self.assertEqual(bad_cast[:10], [], "cast >10 s: %s" % bad_cast[:10])
        self.assertEqual(
            bad_proc[:10], [],
            "mechanics.proc muss 1-99 sein (nie 101/0/100): %s" % bad_proc[:10],
        )

    def test_real_proc_chance_rule(self):
        """DBC-unabhaengig: 101/0/100 nie ausliefern (AGENTS.md)."""
        import importlib.util
        path = os.path.join(ROOT, "pipeline", "mechanics.py")
        spec = importlib.util.spec_from_file_location("bs_mechanics", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        self.assertIsNone(mod.real_proc_chance(0))
        self.assertIsNone(mod.real_proc_chance(100))
        self.assertIsNone(mod.real_proc_chance(101))
        self.assertIsNone(mod.real_proc_chance(102))
        self.assertEqual(mod.real_proc_chance(1), 1)
        self.assertEqual(mod.real_proc_chance(99), 99)
        self.assertEqual(mod.real_proc_chance(15), 15)

    def test_statsuggest_layout_if_present(self):
        ss = _load("statsuggest.json")
        if ss is None:
            return
        ids = _load("spellids.json")
        self.assertIsInstance(ss, dict)
        self.assertEqual(ss.get("v"), 1)
        self.assertIn("path", ss)
        self.assertEqual(
            len(ss["path"]), CATALOG_LEN,
            "statsuggest.path Laenge %s != Katalog %s"
            % (len(ss["path"]), CATALOG_LEN),
        )
        self.assertEqual(ss.get("catalogSize"), CATALOG_LEN)
        tagged = 0
        by_path = {}
        for lab in ss["path"]:
            if not lab:
                continue
            self.assertIn(lab, SSUG_PATHS, "ungueltiger ssug-Path %r" % lab)
            tagged += 1
            by_path[lab] = by_path.get(lab, 0) + 1
        self.assertEqual(ss.get("tagged"), tagged)
        meta_by = ss.get("byPath") or {}
        for name in SSUG_PATHS:
            self.assertEqual(int(meta_by.get(name) or 0), by_path.get(name, 0))
        if ids is None:
            return
        first = {}
        for i, row in enumerate(ids):
            sid = int(row[0] or 0)
            if sid and sid not in first:
                first[sid] = i
        for sid, expected in SSUG_ANCHORS:
            idx = first.get(sid)
            self.assertIsNotNone(idx, "ssug-Anker spellId %s fehlt" % sid)
            self.assertEqual(ss["path"][idx], expected)

    def test_spellsuggest_layout_if_present(self):
        ss = _load("spellsuggest.json")
        if ss is None:
            return
        cat = _load("catalog.json")
        self.assertIsInstance(ss, dict)
        self.assertIn("rel", ss)
        self.assertEqual(
            len(ss["rel"]), CATALOG_LEN,
            "spellsuggest.rel Laenge %s != Katalog %s" % (len(ss["rel"]), CATALOG_LEN),
        )
        if cat is not None:
            self.assertEqual(len(cat), CATALOG_LEN)
        top_n = int(ss.get("topN") or 12)
        for i, row in enumerate(ss["rel"]):
            self.assertEqual(len(row) % 2, 0, "ssugsp[%s] ungerade Laenge" % i)
            self.assertLessEqual(len(row) // 2, top_n)
            for k in range(0, len(row) - 1, 2):
                dest = row[k]
                w = row[k + 1]
                self.assertTrue(isinstance(dest, int) and 0 <= dest < CATALOG_LEN)
                self.assertNotEqual(dest, i, "ssugsp Self-Loop %s" % i)
                self.assertTrue(isinstance(w, int) and w >= 0)

        # v3: Talent-Refs, die in rel[i] stehen, bilden ein Praefix
        # (DBC ∩ relations.refs zuerst, Gewicht unveraendert).
        if int(ss.get("v") or 0) >= 3:
            relations = _load("relations.json")
            catalog = _load("catalog.json")
            if relations is not None and catalog is not None:
                self.assertEqual(len(relations), CATALOG_LEN)
                self.assertEqual(len(catalog), CATALOG_LEN)
                for i, row in enumerate(ss["rel"]):
                    if catalog[i][1] != 1:
                        continue
                    refs = set(relations[i][2] or [])
                    seen_non_ref = False
                    for k in range(0, len(row) - 1, 2):
                        dest = row[k]
                        if dest in refs:
                            self.assertFalse(
                                seen_non_ref,
                                "ssugsp Talent %s: Ref %s nicht vorn" % (i, dest),
                            )
                        else:
                            seen_non_ref = True

    def test_pathtags_from_scaling(self):
        tags = _load("pathtags.json")
        sc = _load("scaling.json")
        self.assertIsNotNone(tags, "data/pathtags.json fehlt")
        self.assertIsNotNone(sc, "data/scaling.json fehlt")
        self.assertEqual(len(tags), CATALOG_LEN)
        self.assertEqual(len(sc), CATALOG_LEN)
        not_magic = frozenset(("physical", "phys", "pysical", "bleed", ""))
        missing_w = []
        missing_m = []
        missing_strike = []
        missing_phys = []
        for i, s in enumerate(sc):
            if not isinstance(s, dict):
                continue
            t = tags[i]
            if s.get("w") and not (t & 1):
                missing_w.append(i)
            for key in ("sch", "fsch"):
                sch = s.get(key)
                if not sch:
                    continue
                low = str(sch).strip().lower()
                if low in ("pysical", "phys"):
                    low = "physical"
                if low.endswith("strike") and not ((t & 1) and (t & 2)):
                    missing_strike.append(i)
                elif low not in not_magic and not (t & 2):
                    missing_m.append(i)
                elif low == "physical" and not (t & 8):
                    missing_phys.append(i)
        self.assertEqual(missing_w[:10], [], "scaling.w ohne WEAPON-Bit")
        self.assertEqual(missing_strike[:10], [], "*strike ohne WEAPON+MAGIC")
        self.assertEqual(missing_m[:10], [], "Magieschule ohne MAGIC-Bit")
        self.assertEqual(missing_phys[:10], [], "Physical-Schule ohne PHYS-Bit")

    def test_spelltags_coverage_if_present(self):
        """Levelrun-Keys stabil; Coverage erklärt den Rest, nichts geraten."""
        st = _load("method-spelltags.json")
        tn = _load("tagnames.json")
        if st is None or tn is None:
            return
        cat = _load("catalog.json")
        n = len(cat) if cat is not None else CATALOG_LEN
        cov = st.get("coverage") or {}
        self.assertEqual(st.get("catalogSize"), n)
        self.assertEqual(cov.get("tagged") + cov.get("untagged"), n)
        self.assertEqual(cov.get("levelrunFacetHits"), 1454)
        self.assertGreaterEqual(cov.get("synergyFacetHits") or 0, 950)
        leftover = (
            (cov.get("taggedInstantOnly") or 0)
            + (cov.get("taggedClassSpecOnly") or 0)
            + (cov.get("taggedOtherNoFacet") or 0)
        )
        self.assertEqual(leftover, cov.get("taggedNoStructuralFacet"))
        keys = [f["key"] for f in (st.get("facets") or [])]
        self.assertEqual(
            keys,
            [
                "mobility", "interrupt", "hard_cc", "soft_cc",
                "defensive", "direct_heal", "hot", "absorb",
                "dot", "aoe", "cleave", "single",
                "melee", "magic", "ranged", "dispel",
                "raid_buff", "taunt",
            ],
        )
        syn_keys = [f["key"] for f in (st.get("synergyFacets") or [])]
        for need in ("mana_cost", "energy_cost", "rage_cost"):
            self.assertIn(need, syn_keys)
        self.assertIn("warrior", st.get("byClass") or {})
        self.assertTrue(tn.get("types"))
        sample = tn["types"].get("67") or {}
        self.assertEqual(sample.get("nameDe"), "Krieger")
        tcov = tn.get("coverage") or {}
        self.assertEqual(tcov.get("typesTotal"), 200)
        self.assertIn("typesUnusedWhy", tcov)

    def test_optional_json_parse_if_present(self):
        for fname, _key in OPTIONAL_JSON:
            path = os.path.join(DATA, fname)
            if not os.path.isfile(path):
                continue
            with open(path, encoding="utf-8") as f:
                data = json.load(f)
            self.assertIsNotNone(data, "%s leerte zu None" % fname)
            self.assertTrue(
                isinstance(data, (dict, list)),
                "%s: erwartetes dict/list, got %s" % (fname, type(data).__name__),
            )

    def test_assembled_optional_payload_keys(self):
        """Existierende optionale JSON unter Assemble-Deckel muss in index.html stehen."""
        html_path = os.path.join(ROOT, "index.html")
        if not os.path.isfile(html_path):
            return
        with open(html_path, encoding="utf-8") as f:
            html = f.read()
        start = html.find('<script type="application/json" id="data">')
        end = html.find("</script>", start)
        self.assertGreaterEqual(start, 0, "index.html ohne #data-Payload")
        self.assertGreater(end, start)
        raw = html[start:end].split(">", 1)[1]
        payload = json.loads(raw)
        self.assertIsInstance(payload, dict)
        skip_oversize = {
            "iic": ITEMICONS_EMBED_MAX_KB,
            "wpn": ITEMICONS_EMBED_MAX_KB,
            "frm": PARALLEL_EMBED_MAX_KB,
            "preq": PARALLEL_EMBED_MAX_KB,
        }
        missing = []
        for fname, key in OPTIONAL_JSON:
            path = os.path.join(DATA, fname)
            if not os.path.isfile(path):
                continue
            kb = os.path.getsize(path) / 1024.0
            cap = skip_oversize.get(key)
            if cap is not None and kb > cap:
                continue
            if key not in payload:
                missing.append("%s (%s)" % (key, fname))
        self.assertEqual(missing, [], "Assemble-Embed fehlt: %s" % missing)

    def test_ilvlbands_if_present(self):
        """Stufen 10–60, Perzentile, gemessene Anker — nichts raten."""
        ilb = _load("ilvlbands.json")
        if not ilb:
            return
        self.assertIsInstance(ilb, dict)
        levels = ilb.get("levels")
        if not levels:
            return
        self.assertIsInstance(levels, dict)
        for L in range(10, 61):
            self.assertIn(str(L), levels, "ilvlbands Stufe %s fehlt" % L)
            entry = levels[str(L)]
            for key in ("ilvl", "w1h", "w2h", "armor"):
                self.assertIn(key, entry, "Stufe %s ohne %s" % (L, key))
                b = entry[key]
                self.assertGreaterEqual(b.get("n") or 0, 40)
                self.assertLessEqual(b["p25"], b["p50"])
                self.assertLessEqual(b["p50"], b["p75"])
            self.assertGreater(
                entry["w2h"]["p50"], entry["w1h"]["p50"],
                "Stufe %s: 2H-Median nicht groesser als 1H" % L,
            )
        # Anker gemessen 2026-08-22 (NOTES-ilvl.md) — bei Drift neu messen.
        self.assertEqual(levels["40"]["ilvl"]["p50"], 36)
        self.assertEqual(levels["40"]["w1h"]["p50"], 49.5)
        self.assertEqual(levels["40"]["w2h"]["p50"], 86.5)
        self.assertEqual(levels["40"]["armor"]["p50"], 161)
        self.assertEqual(levels["60"]["ilvl"]["p50"], 55)

    def test_weapons_if_present(self):
        """Nur ItemStat-Bänder 10–60. Kein Name/ilvl/dmg aus unkartiertem Addon."""
        wpn = _load("weapons.json")
        if not wpn:
            return
        self.assertIsInstance(wpn, dict)
        forbidden = ("n", "q", "ilvl", "dmg", "speed", "dps")
        for iid, ent in wpn.items():
            self.assertTrue(str(iid).isdigit(), "weapons Key keine itemId: %r" % iid)
            self.assertIsInstance(ent, dict)
            for key in forbidden:
                self.assertNotIn(
                    key, ent,
                    "weapons[%s] hat %s — nicht aus ItemStat f1/f2" % (iid, key),
                )
            b = ent.get("b")
            self.assertIsInstance(b, dict)
            self.assertTrue(b, "weapons[%s] Band leer" % iid)
            for lv, pair in b.items():
                nlv = int(lv)
                self.assertGreaterEqual(nlv, 10)
                self.assertLessEqual(nlv, 60)
                self.assertIsInstance(pair, list)
                self.assertEqual(len(pair), 2)
                self.assertGreater(pair[0], 0)
                self.assertGreaterEqual(pair[1], pair[0])
                self.assertLess(pair[1], 100000)

    def test_methods_triggers_from_text(self):
        """Trigger-Tags nur aus Katalogtext. Kein erfundenes pct/icd."""
        meth = _load("methods.json")
        cat = _load("catalog.json")
        if meth is None or cat is None:
            return
        tr = meth.get("triggers")
        self.assertIsInstance(tr, dict)
        self.assertGreaterEqual(tr.get("n") or 0, 700)
        self.assertEqual(tr.get("nPct"), 236)
        self.assertEqual(tr.get("nScProc"), 239)
        self.assertEqual(tr.get("nScOverlap"), 236)
        self.assertLessEqual(tr["nPct"], tr["nScProc"])
        by_i = {}
        for row in tr.get("entries") or []:
            self.assertIn("t", row)
            self.assertTrue(row["t"])
            if "pct" in row:
                self.assertGreater(row["pct"], 0)
                self.assertLessEqual(row["pct"], 100)
            if "icd" in row:
                self.assertGreater(row["icd"], 0)
            by_i[row["i"]] = row

        import importlib.util
        path = os.path.join(ROOT, "pipeline", "methods.py")
        spec = importlib.util.spec_from_file_location("bs_methods", path)
        mod = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(mod)
        mod.selfcheck_triggers(cat)

        for name in ("Deterrence", "Pain Suppression", "Conduit", "Shred"):
            idx = next(i for i, rec in enumerate(cat) if rec[0] == name)
            self.assertNotIn(idx, by_i, "%s darf keinen Trigger-Tag haben" % name)

        wf = next(i for i, rec in enumerate(cat) if rec[0] == "Windfury Weapon")
        fb = next(i for i, rec in enumerate(cat) if rec[0] == "Frostbrand Weapon")
        self.assertEqual(by_i[wf].get("pct"), 20.0)
        self.assertNotIn("pct", by_i[fb])

    def test_burning_slam_inherits_slam_not_shield_slam(self):
        """Burning Slam erbt Slam-Talente, nicht Shield Slam (Suffix-Sperre)."""
        cat = _load("catalog.json")
        rel = _load("relations.json")
        ub = _load("usesbase.json")
        bm = _load("basemods.json")
        self.assertIsNotNone(cat)
        self.assertIsNotNone(rel)
        self.assertIsNotNone(ub)
        self.assertIsNotNone(bm)

        def first_ability(name):
            for i, rec in enumerate(cat):
                if rec[0] == name and rec[1] == 0:
                    return i
            return None

        slam = first_ability("Slam")
        burning = first_ability("Burning Slam")
        shield = first_ability("Shield Slam")
        self.assertIsNotNone(slam, "Slam fehlt im Katalog")
        self.assertIsNotNone(burning, "Burning Slam fehlt im Katalog")
        self.assertIsNotNone(shield, "Shield Slam fehlt im Katalog")
        self.assertIn(
            "uses Slam modifiers",
            cat[burning][5] or "",
            "Burning Slam muss die gemessene uses-X-Phrase tragen",
        )
        self.assertIsNone(
            rel[burning][0],
            "Burning Slam hat relations[0]; Spot erwartet Text-usesbase",
        )
        self.assertEqual(
            ub.get(str(burning)), slam,
            "usesbase[%s] sollte Slam (%s) sein" % (burning, slam),
        )
        slam_tal = set(bm.get(str(slam)) or bm.get(slam) or [])
        shield_tal = set(bm.get(str(shield)) or bm.get(shield) or [])
        self.assertGreaterEqual(len(slam_tal), 1, "Slam ohne Talente in basemods")
        self.assertTrue(
            slam_tal.isdisjoint(shield_tal),
            "Slam- und Shield-Slam-Talente ueberlappen: %s"
            % sorted(slam_tal & shield_tal)[:8],
        )

    def test_desireelig_embeddable(self):
        des = _load("desireelig.json")
        self.assertIsNotNone(des, "data/desireelig.json fehlt (D.des)")
        self.assertIsInstance(des, list)
        self.assertEqual(
            len(des), CATALOG_LEN,
            "desireelig.json Laenge %s != Katalog %s" % (len(des), CATALOG_LEN),
        )
        self.assertTrue(
            all(v in (0, 1) for v in des),
            "desireelig.json darf nur 0/1 enthalten",
        )
        self.assertEqual(
            des.count(0), DESIRE_FALSE_N,
            "desireelig 0-Count %s != gemessen %s" % (des.count(0), DESIRE_FALSE_N),
        )
        kb = os.path.getsize(os.path.join(DATA, "desireelig.json")) / 1024.0
        self.assertLessEqual(
            kb, PARALLEL_EMBED_MAX_KB,
            "desireelig.json %.1f KB > %d KB" % (kb, PARALLEL_EMBED_MAX_KB),
        )

    def test_spectags_embeddable(self):
        tree = _load("spectags.json")
        self.assertIsNotNone(tree, "data/spectags.json fehlt (D.tree)")
        self.assertIsInstance(tree, list)
        self.assertEqual(
            len(tree), CATALOG_LEN,
            "spectags.json Laenge %s != Katalog %s" % (len(tree), CATALOG_LEN),
        )
        unknown = [t for t in tree if t and t not in SPECTAGS_KNOWN]
        self.assertEqual(unknown[:8], [], "spectags unbekannte Tabs: %s" % unknown[:8])
        filled = sum(1 for t in tree if t)
        self.assertEqual(
            filled, SPECTAGS_FILLED_N,
            "spectags gefuellt %s != gemessen %s" % (filled, SPECTAGS_FILLED_N),
        )
        self.assertEqual(len(set(t for t in tree if t)), len(SPECTAGS_KNOWN))
        kb = os.path.getsize(os.path.join(DATA, "spectags.json")) / 1024.0
        self.assertLessEqual(
            kb, PARALLEL_EMBED_MAX_KB,
            "spectags.json %.1f KB > %d KB" % (kb, PARALLEL_EMBED_MAX_KB),
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
