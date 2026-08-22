# -*- coding: utf-8 -*-
"""Item-icon WebP enrichment ONLY — no UI chrome.

Website rule (.cursor/rules/website-assets.mdc / AGENTS.md):
  Own CSS/SVG/PNG/WebP for site chrome. Never embed Ascension/WoW BLP
  (or BLP-converted) panel frames (DialogFrame, PaperDoll tabs, caCorner, …).

This script used to write data/uichrome.css from Interface BLPs — REMOVED.
Spell sprites stay in dbcicons.py / mksprite.py.
Optional: enrich data/itemicons.json with 32px data:-WebP urls (allowed icons).
"""
from __future__ import print_function

import base64
import io
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
EXTRACT = r"C:\Users\x\Documents\AscensionInterfaceExtract\by-archive"

ITEMICONS_WEBP_SOFT_MAX_KB = 380


def find_icon_blp(name):
    want = name.lower() + ".blp"
    for root, _dirs, files in os.walk(EXTRACT):
        if "icon" not in root.lower():
            continue
        for fn in files:
            if fn.lower() == want:
                return os.path.join(root, fn)
    return None


def to_webp_b64(path, size=None, quality=80):
    im = Image.open(path)
    im.load()
    im = im.convert("RGBA")
    if size is not None:
        if isinstance(size, tuple):
            im = im.resize(size, Image.LANCZOS)
        else:
            im = im.resize((size, size), Image.LANCZOS)
    buf = io.BytesIO()
    im.save(buf, "WEBP", quality=quality, method=6)
    return base64.b64encode(buf.getvalue()).decode("ascii")


def enrich_itemicons():
    src = os.path.join(DATA, "itemicons.json")
    raw = json.load(io.open(src, encoding="utf-8"))
    out = {}
    ok = miss = skipped = 0
    for iid in sorted(raw.keys(), key=lambda x: int(x) if str(x).isdigit() else 0):
        v = raw[iid]
        if isinstance(v, str):
            entry = {"i": v}
        elif isinstance(v, dict):
            entry = dict(v)
            if not entry.get("i"):
                entry["i"] = entry.get("icon") or entry.get("name") or ""
        else:
            continue
        name = entry.get("i") or ""
        if not name:
            continue
        if entry.get("url", "").startswith("data:image/"):
            out[iid] = entry
            ok += 1
            continue
        provisional = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
        if len(provisional.encode("utf-8")) / 1024.0 > ITEMICONS_WEBP_SOFT_MAX_KB:
            out[iid] = entry
            skipped += 1
            continue
        path = find_icon_blp(name)
        if not path:
            out[iid] = entry
            miss += 1
            continue
        try:
            b64 = to_webp_b64(path, size=32, quality=78)
            entry["url"] = "data:image/webp;base64," + b64
            ok += 1
        except Exception:
            miss += 1
        out[iid] = entry
    io.open(src, "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, separators=(",", ":"), sort_keys=True)
    )
    print("itemicons:", ok, "mit url,", miss, "ohne BLP,", skipped,
          "ohne url (Budget) |",
          round(os.path.getsize(src) / 1024.0, 1), "KB")


def main():
    print("Hinweis: UI-Chrome aus BLP ist abgeschaltet "
          "(website-assets.mdc). Nur Item-Icon-urls.")
    if not os.path.isdir(EXTRACT):
        print("Extract fehlt:", EXTRACT)
        return 1
    enrich_itemicons()
    return 0


if __name__ == "__main__":
    sys.exit(main())
