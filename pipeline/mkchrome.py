# -*- coding: utf-8 -*-
"""Kuratiertes Ascension-UI-Chrome (CA / Wildcard / Dialog) + Item-Icons.

Liest BLP aus dem lokalen Interface-Extract (nicht ins Repo), schreibt:
  data/uichrome.css   — CSS-Variablen mit data:-WebP
  data/itemicons.json — itemId -> {i, url} mit 32px-WebP

Keine FrameXML/Lua — nur abgeleitete Texturen.
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
LOC = "enUS_locale-enUS.MPQ"
PA = "patch-A.MPQ"

# key, archive, relpath, resize (int|tuple|None), quality
CHROME = [
    # Spell / item slots (3.3.5 chrome — same as CA action buttons)
    ("slot", LOC, r"Interface\BUTTONS\UI-EmptySlot.blp", 64, 80),
    ("quick", LOC, r"Interface\BUTTONS\UI-Quickslot2.blp", 64, 80),
    ("aborder", LOC, r"Interface\BUTTONS\UI-ActionButton-Border.blp", 64, 80),
    ("dborder", LOC, r"Interface\BUTTONS\UI-Debuff-Border.blp", 64, 80),
    ("iframe", PA, r"Interface\COMMON\WhiteIconFrame.blp", 64, 80),
    ("goldicon", PA, r"Interface\Draft\goldiconborder.blp", 64, 82),
    ("safeslot", PA,
     r"Interface\AddOns\AwAddons\Textures\SafeSlots\SlotBorder_H.blp", 64, 80),
    # Character Advancement window chrome
    ("cacorner", PA, r"Interface\CharacterAdvancement\caCorner.blp", 32, 85),
    ("goldc", PA, r"Interface\COMMON\GoldBorder-Corner-TL.blp", 32, 85),
    ("goldtop", PA, r"Interface\COMMON\GoldBorder-Top.blp", None, 85),
    ("goldleft", PA, r"Interface\COMMON\GoldBorder-Left.blp", None, 85),
    # Dialog / tooltip panels (WoW 3.3.5 — Ascension still uses these)
    ("dlgborder", LOC, r"Interface\DialogFrame\UI-DialogBox-Border.blp", None, 78),
    ("dlgbg", LOC, r"Interface\DialogFrame\UI-DialogBox-Background.blp", 64, 70),
    ("dlghead", LOC, r"Interface\DialogFrame\UI-DialogBox-Header.blp", (256, 32), 78),
    ("tipborder", LOC, r"Interface\Tooltips\UI-Tooltip-Border.blp", None, 80),
    ("tipbg", LOC, r"Interface\Tooltips\UI-Tooltip-Background.blp", 32, 70),
    # Tabs + panel buttons
    ("tabon", LOC, r"Interface\PaperDollInfoFrame\UI-Character-ActiveTab.blp",
     (128, 32), 80),
    ("taboff", LOC, r"Interface\PaperDollInfoFrame\UI-Character-InActiveTab.blp",
     (128, 32), 80),
    ("btnup", LOC, r"Interface\Buttons\UI-Panel-Button-Up.blp", (128, 32), 80),
    ("btndown", LOC, r"Interface\Buttons\UI-Panel-Button-Down.blp", (128, 32), 80),
    ("btnhi", LOC, r"Interface\Buttons\UI-Panel-Button-Highlight.blp",
     (128, 32), 75),
    # Brand / Wildcard flavour (small)
    ("poa", PA, r"Interface\BUTTONS\PoAQuestIconBLP_Complete.blp", 48, 78),
    ("scslot", PA, r"Interface\Draft\skillcardslot.blp", 64, 72),
]


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


def write_uichrome():
    lines = [
        "/* Ascension CA/Wildcard chrome — mkchrome.py (Interface extract) */",
        ":root{",
    ]
    total = 0
    for key, archive, rel, size, quality in CHROME:
        path = os.path.join(EXTRACT, archive, rel)
        if not os.path.exists(path):
            print("fehlt:", path)
            continue
        try:
            b64 = to_webp_b64(path, size=size, quality=quality)
        except Exception as exc:
            print("skip", key, ":", exc)
            continue
        total += len(b64)
        lines.append("  --chrome-%s:url(data:image/webp;base64,%s);" % (key, b64))
        print("chrome", key, round(len(b64) / 1024.0, 1), "KB")
    lines.append("}")
    dest = os.path.join(DATA, "uichrome.css")
    io.open(dest, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("geschrieben:", dest, "|", round(total / 1024.0, 1), "KB b64")


def enrich_itemicons():
    src = os.path.join(DATA, "itemicons.json")
    raw = json.load(io.open(src, encoding="utf-8"))
    flat = {}
    for k, v in raw.items():
        if isinstance(v, str):
            flat[k] = v
        elif isinstance(v, dict):
            flat[k] = v.get("i") or v.get("icon") or v.get("name") or ""
    out = {}
    ok = miss = 0
    for iid, name in flat.items():
        if not name:
            continue
        path = find_icon_blp(name)
        if not path:
            out[iid] = {"i": name}
            miss += 1
            continue
        try:
            b64 = to_webp_b64(path, size=32, quality=78)
        except Exception:
            out[iid] = {"i": name}
            miss += 1
            continue
        out[iid] = {"i": name, "url": "data:image/webp;base64," + b64}
        ok += 1
    io.open(src, "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    )
    print("itemicons:", ok, "mit url,", miss, "ohne |",
          round(os.path.getsize(src) / 1024.0, 1), "KB")


def main():
    if not os.path.isdir(EXTRACT):
        print("Extract fehlt:", EXTRACT)
        return 1
    write_uichrome()
    enrich_itemicons()
    return 0


if __name__ == "__main__":
    sys.exit(main())
