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
# Optionale Pipeline-Outputs (stags / ssugsp laut assemble.py OPTIONAL_PAYLOAD).
OPTIONAL_JSON = (
    ("methods.json", "meth"),
    ("method-spelltags.json", "stags"),
    ("spellsuggest.json", "ssugsp"),
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

        self.assertEqual(
            bad_rage[:10], [],
            "Wut/Runenmacht cost >100 oder ungueltig: %s" % bad_rage[:10],
        )
        self.assertEqual(bad_range[:10], [], "range >100 m: %s" % bad_range[:10])
        self.assertEqual(bad_cast[:10], [], "cast >10 s: %s" % bad_cast[:10])

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


if __name__ == "__main__":
    unittest.main(verbosity=2)
