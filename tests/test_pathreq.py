# -*- coding: utf-8 -*-
"""Anker und Invarianten fuer pipeline/pathreq.py → data/pathreq.json.

Nur gemessene Requires-Zeilen. SpellStatSuggestions bleibt Hinweis.
builder-app.js bleibt in dieser Testdatei unberuehrt.
"""
from __future__ import print_function

import io
import json
import os
import sys
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
sys.path.insert(0, os.path.join(ROOT, "pipeline"))

import pathreq  # noqa: E402

CATALOG_LEN = 3071


class TestExtractText(unittest.TestCase):
    def test_requires_path_of_healing(self):
        keys, raw = pathreq.extract_text(
            "Requires   Path of Healing   Throw a potion that heals."
        )
        self.assertEqual(keys, ["heal"])
        self.assertEqual(raw, [])

    def test_requires_primary_stat_agility(self):
        keys, raw = pathreq.extract_text(
            "Requires   Primary Stat: Agility     Increases your hit chance."
        )
        self.assertEqual(keys, ["agi"])
        self.assertEqual(raw, [])

    def test_requires_primary_stat_strength(self):
        keys, raw = pathreq.extract_text(
            "Requires   Primary Stat: Strength  Piercing Shots also causes."
        )
        self.assertEqual(keys, ["str"])
        self.assertEqual(raw, [])

    def test_might_or_finesse_stays_raw(self):
        keys, raw = pathreq.extract_text(
            "Requires   Primary Stat: Might or Finesse  Increases healing."
        )
        self.assertEqual(keys, [])
        self.assertTrue(raw)
        self.assertIn("Might or Finesse", raw[0])

    def test_while_primary_stat_is_not_require(self):
        keys, raw = pathreq.extract_text(
            "The damage gained from spell power is doubled while your "
            "Primary Stat is Spirit. This uses Penance modifiers."
        )
        self.assertEqual(keys, [])
        self.assertEqual(raw, [])

    def test_while_in_path_bonus_not_require(self):
        keys, raw = pathreq.extract_text(
            "While in Path of Agility or Duality your Missile Barrage "
            "is hastened by 60%."
        )
        self.assertEqual(keys, [])
        self.assertEqual(raw, [])

    def test_requires_seconds_not_path(self):
        keys, raw = pathreq.extract_text(
            "Requires 20 sec seconds to fully bloom another shot after firing."
        )
        self.assertEqual(keys, [])
        self.assertEqual(raw, [])


class TestRelGate(unittest.TestCase):
    def test_pfad_healing(self):
        keys, raw = pathreq.extract_rel_gate(["Pfad", "Path of Healing"])
        self.assertEqual(keys, ["heal"])
        self.assertEqual(raw, [])

    def test_stat_agility(self):
        keys, raw = pathreq.extract_rel_gate(["Stat", "Primary Stat: Agility"])
        self.assertEqual(keys, ["agi"])
        self.assertEqual(raw, [])

    def test_stat_might_raw(self):
        keys, raw = pathreq.extract_rel_gate(["Stat", "Primary Stat: Might"])
        self.assertEqual(keys, [])
        self.assertTrue(raw)

    def test_weapon_ignored(self):
        keys, raw = pathreq.extract_rel_gate(["Waffe", "Dagger (Main Hand)"])
        self.assertEqual(keys, [])
        self.assertEqual(raw, [])


class TestJsonInvariants(unittest.TestCase):
    def test_file_and_anchors(self):
        path = os.path.join(DATA, "pathreq.json")
        self.assertTrue(os.path.isfile(path), "data/pathreq.json fehlt")
        with io.open(path, encoding="utf-8") as fh:
            out = json.load(fh)
        with io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8") as fh:
            cat = json.load(fh)
        kb = os.path.getsize(path) / 1024.0
        pathreq.verify_payload(cat, out, kb)
        self.assertLessEqual(kb, 64, "pathreq.json %.1f KB > 64 KB" % kb)
        self.assertEqual(len(cat), CATALOG_LEN)
        self.assertLessEqual(out["meta"]["nReq"], pathreq.REQ_CEILING)
        self.assertGreater(out["meta"]["nReq"], 0)
        # Nicht der ganze Katalog.
        self.assertLess(out["meta"]["nReq"], 200)


if __name__ == "__main__":
    unittest.main()
