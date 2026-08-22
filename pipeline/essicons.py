# -*- coding: utf-8 -*-
"""Haengt gemessene AE/TE-Icons an sprite.webp an — ohne Full-Rebuild.

Client (SpellListItem.lua, Constants.lua MARKUP_AE_ICON / MARKUP_TE_ICON):
  Interface\\Icons\\inv_custom_abilityessence
  Interface\\Icons\\inv_custom_talentessence

BLP: AscensionInterfaceExtract patch-I.MPQ/Interface/icons/
Schreibt data/sprite.webp + data/spriteindex.json extra{} (Kachelnummern).
Katalog-idx bleibt unveraendert.
"""
from __future__ import print_function

import io
import json
import os
import sys

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
DATA = os.path.join(ROOT, "data")
EXTRACT = r"C:\Users\x\Documents\AscensionInterfaceExtract\by-archive"

# Gemessen — keine erfundenen Dateinamen.
EXTRA_ICONS = (
    "inv_custom_abilityessence",
    "inv_custom_talentessence",
)

KNOWN = {
    "inv_custom_abilityessence": os.path.join(
        EXTRACT, "patch-I.MPQ", "Interface", "icons",
        "inv_custom_abilityessence.blp"),
    "inv_custom_talentessence": os.path.join(
        EXTRACT, "patch-I.MPQ", "Interface", "icons",
        "inv_custom_talentessence.blp"),
}


def find_blp(name):
    known = KNOWN.get(name)
    if known and os.path.isfile(known):
        return known
    want = name.lower() + ".blp"
    if not os.path.isdir(EXTRACT):
        return None
    for root, _dirs, files in os.walk(EXTRACT):
        if "icon" not in root.lower():
            continue
        for fn in files:
            if fn.lower() == want:
                return os.path.join(root, fn)
    return None


def tile_image(path, tile):
    im = Image.open(path)
    im.load()
    return im.convert("RGBA").resize((tile, tile), Image.LANCZOS)


def main():
    sprite_path = os.path.join(DATA, "sprite.webp")
    idx_path = os.path.join(DATA, "spriteindex.json")
    if not os.path.isfile(sprite_path) or not os.path.isfile(idx_path):
        print("fehlt sprite.webp / spriteindex.json — essicons uebersprungen")
        return 0

    meta = json.load(io.open(idx_path, encoding="utf-8"))
    cols = int(meta.get("cols") or 48)
    tile = int(meta.get("tile") or 32)
    idx = meta.get("idx") or []
    extra = dict(meta.get("extra") or {})

    paths = {}
    missing = []
    for name in EXTRA_ICONS:
        p = find_blp(name)
        if p:
            paths[name] = p
        else:
            missing.append(name)
    if missing:
        print("BLP fehlt:", ", ".join(missing))
        if not paths:
            return 0

    used = [t for t in idx if isinstance(t, int) and t >= 0]
    used.extend(int(v) for v in extra.values() if isinstance(v, int) and v >= 0)
    next_tile = (max(used) + 1) if used else 0

    sheet = Image.open(sprite_path)
    sheet.load()
    sheet = sheet.convert("RGBA")
    changed = False

    for name in EXTRA_ICONS:
        src = paths.get(name)
        if not src:
            continue
        t = extra.get(name)
        if not isinstance(t, int) or t < 0:
            t = next_tile
            extra[name] = t
            next_tile += 1
        need_w = cols * tile
        need_h = (t // cols + 1) * tile
        if sheet.size[0] < need_w or sheet.size[1] < need_h:
            grown = Image.new(
                "RGBA",
                (max(sheet.size[0], need_w), max(sheet.size[1], need_h)),
                (0, 0, 0, 0),
            )
            grown.paste(sheet, (0, 0))
            sheet = grown
        im = tile_image(src, tile)
        sheet.paste(im, ((t % cols) * tile, (t // cols) * tile))
        changed = True
        print("extra", name, "tile", t, "<-", src)

    if not changed:
        print("essicons: nichts zu tun")
        return 0

    sheet.convert("RGB").save(sprite_path, "WEBP", quality=80, method=6)
    meta["extra"] = extra
    io.open(idx_path, "w", encoding="utf-8").write(
        json.dumps(meta, ensure_ascii=False, separators=(",", ":"))
    )
    print("sprite.webp", round(os.path.getsize(sprite_path) / 1024), "KB",
          "| extra", extra)
    return 0


if __name__ == "__main__":
    sys.exit(main())
