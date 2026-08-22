# -*- coding: utf-8 -*-
"""Export-Parsing gegen data/testexport-*.txt (echte parseExport aus builder-app.js).

Kein Browser. Braucht nur Python 3 + Node (wie die Syntaxpruefung in AGENTS.md).

    python tests/test_export_parse.py
    python -m unittest tests.test_export_parse -v
    python -m pytest tests/test_export_parse.py -q   # optional, falls pytest da ist
"""
from __future__ import print_function

import json
import os
import subprocess
import unittest

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
HARNESS = os.path.join(ROOT, "tests", "parse_export_harness.js")


def _node_parse(fixture_name):
    path = os.path.join(DATA, fixture_name)
    if not os.path.isfile(path):
        raise unittest.SkipTest("fehlt: data/%s" % fixture_name)
    if not os.path.isfile(HARNESS):
        raise unittest.SkipTest("fehlt: tests/parse_export_harness.js")
    try:
        proc = subprocess.run(
            ["node", HARNESS, path],
            cwd=ROOT,
            capture_output=True,
            text=True,
            encoding="utf-8",
            timeout=30,
            check=False,
        )
    except FileNotFoundError:
        raise unittest.SkipTest("node nicht im PATH")
    if proc.returncode != 0:
        raise AssertionError(
            "harness failed (%s):\n%s\n%s"
            % (fixture_name, proc.stdout, proc.stderr)
        )
    return json.loads(proc.stdout)


class TestExportParse(unittest.TestCase):
    def test_harness_self_check(self):
        try:
            proc = subprocess.run(
                ["node", HARNESS, "--self-check"],
                cwd=ROOT,
                capture_output=True,
                text=True,
                encoding="utf-8",
                timeout=30,
                check=False,
            )
        except FileNotFoundError:
            raise unittest.SkipTest("node nicht im PATH")
        self.assertEqual(
            proc.returncode, 0,
            "self-check failed:\n%s\n%s" % (proc.stdout, proc.stderr),
        )
        body = json.loads(proc.stdout)
        self.assertTrue(body.get("ok"))
        self.assertGreaterEqual(body.get("fixtures", 0), 3)

    def test_charakter_pathentry_draft_wc_counts(self):
        d = _node_parse("testexport-charakter.txt")
        self.assertEqual(d["pathEntry"], 12003)
        self.assertIn("WILDCARD", d["modes"])
        self.assertIn("DRAFT", d["modes"])
        self.assertTrue(d["draft"])
        wc = d["wc"]
        self.assertEqual(wc["RRAbi"], {"cur": 2, "req": 5, "next": 8, "raw": "2/5/8"})
        self.assertEqual(wc["RRTal"], {"cur": 1, "req": 3, "next": 5, "raw": "1/3/5"})
        self.assertEqual(wc["RepurchAbi"], 1)
        self.assertEqual(wc["CanRepurch"], 1)
        self.assertEqual(d["countA"], 10)
        self.assertEqual(d["countT"], 9)
        self.assertEqual(len(d["abi"]), 10)
        self.assertEqual(len(d["tal"]), 9)

    def test_fremd_pathentry_mode_wc_counts(self):
        d = _node_parse("testexport-fremd.txt")
        self.assertEqual(d["pathEntry"], 12001)
        self.assertEqual(d["modes"], ["WILDCARD"])
        self.assertFalse(d.get("draft"))
        self.assertTrue(d.get("inspect"))
        wc = d["wc"]
        self.assertEqual(wc["RRAbi"]["raw"], "0/0/0")
        self.assertEqual(wc["RRTal"]["raw"], "0/0/0")
        self.assertEqual(d["countA"], 7)
        self.assertEqual(d["countT"], 9)
        self.assertEqual(len(d["abi"]), 7)
        self.assertEqual(len(d["tal"]), 9)

    def test_gear_pathentry_draft_wc_counts(self):
        d = _node_parse("testexport-gear.txt")
        self.assertEqual(d["pathEntry"], 12002)
        self.assertIn("DRAFT", d["modes"])
        self.assertTrue(d["draft"])
        wc = d["wc"]
        self.assertEqual(wc["RRAbi"], {"cur": 4, "req": 6, "next": 9, "raw": "4/6/9"})
        self.assertEqual(wc["RRTal"], {"cur": 2, "req": 4, "next": 6, "raw": "2/4/6"})
        self.assertEqual(wc["RRPhase"], "Rolling")
        self.assertEqual(d["countA"], 5)
        self.assertEqual(d["countT"], 3)
        self.assertEqual(len(d["abi"]), 5)
        self.assertEqual(len(d["tal"]), 3)
        self.assertEqual(d["startChoice"], [801, 802, 803])


if __name__ == "__main__":
    unittest.main(verbosity=2)
