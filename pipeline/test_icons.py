# -*- coding: utf-8 -*-
"""Regression: spell icons must keep position+size via iconStyle; no BLP overlays."""
import io
import json
import os
import re
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "src")


def _read(path):
    with io.open(path, encoding="utf-8") as fh:
        return fh.read()


def _icon_style_fn(js):
    m = re.search(r"function iconStyle\(i, size\) \{.*?\n  \}", js, re.S)
    if not m:
        raise AssertionError("iconStyle missing")
    return m.group(0)


class IconStyleRegression(unittest.TestCase):
    def test_icon_style_scales_position_and_size_together(self):
        js = _read(os.path.join(SRC, "builder-app.js"))
        body = _icon_style_fn(js)
        self.assertIn("background-position:-", body)
        self.assertIn("background-size:", body)
        self.assertIn("SPR.cols * size", body)
        # Shorthand would clear assemble's sprite background-image.
        self.assertNotIn('return "background:', body)
        self.assertIn("background-image:none", body)

    def test_head_has_no_hardcoded_sprite_size_or_blp_overlay(self):
        head = _read(os.path.join(SRC, "builder-head.html"))
        # Isolate .icon rules (not .gico etc.)
        icon_blocks = re.findall(r"\.icon(?:\.qf\d|::(?:before|after))?[^{]*\{[^}]*\}", head)
        self.assertTrue(icon_blocks, "expected .icon CSS in builder-head")
        joined = "\n".join(icon_blocks)
        self.assertNotIn("background-size:1536", joined)
        self.assertNotIn("--chrome-slot", head)
        self.assertNotIn("chrome-goldicon", head)
        # Explicit kill-switch for BLP slot overlays
        self.assertRegex(head, r"\.icon::before,\s*\.icon::after\{[^}]*content:\s*none")

    def test_spriteindex_and_assembled_index_when_present(self):
        spr_path = os.path.join(ROOT, "data", "spriteindex.json")
        self.assertTrue(os.path.exists(spr_path))
        spr = json.loads(_read(spr_path))
        self.assertGreaterEqual(spr["cols"], 1)
        self.assertEqual(spr["tile"], 32)
        self.assertEqual(len(spr["idx"]), 3071)
        self.assertTrue(all(t >= 0 for t in spr["idx"]))

        # Simulate iconStyle math for default + small size
        i, t = 0, spr["idx"][0]
        for size in (spr["tile"], 20):
            x = (t % spr["cols"]) * size
            y = (t // spr["cols"]) * size
            self.assertGreaterEqual(x, 0)
            self.assertGreaterEqual(y, 0)
            self.assertEqual(spr["cols"] * size, spr["cols"] * size)

        idx_path = os.path.join(ROOT, "index.html")
        if not os.path.exists(idx_path):
            self.skipTest("index.html not assembled")
        idx = _read(idx_path)
        self.assertIn(".icon{background-image:url(data:image/webp;base64,", idx)
        self.assertNotIn("--chrome-slot", idx)
        self.assertNotRegex(idx, r"\.icon::after\{[^}]*--chrome-")
        src_js = _icon_style_fn(_read(os.path.join(SRC, "builder-app.js")))
        idx_js = _icon_style_fn(idx)
        self.assertEqual(src_js, idx_js)

        syn = os.path.join(ROOT, "synergien.html")
        self.assertTrue(os.path.exists(syn), "synergien.html must ship with assemble")
        syn_html = _read(syn)
        self.assertNotIn("--chrome-slot", syn_html)
        self.assertNotIn("uichrome.css", syn_html)


if __name__ == "__main__":
    unittest.main()
