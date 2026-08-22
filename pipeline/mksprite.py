"""Baut ein Sprite-Sheet aus den WoW-Icons fuer die Buildschmiede.

Quelle sind die aus den MPQs extrahierten BLP-Dateien. Pillow liest BLP2
nativ. Ausgabe: eine WebP-Kachelgrafik plus ein Index (Katalogposition ->
Kachelnummer), beides fuer die Einbettung als data:-URI gedacht.
"""
import io
import json
import os
import sys

from PIL import Image

ICON_ROOT = r"C:\Users\x\Documents\AscensionInterfaceExtract\by-archive"
TILE = 32
COLS = 48

# Gemessen (SpellListItem / MARKUP_AE_ICON / MARKUP_TE_ICON) — nicht Katalog.
EXTRA_ICONS = (
    "inv_custom_abilityessence",
    "inv_custom_talentessence",
)


def index_blps():
    """Dateiname (klein, ohne .blp) -> vollstaendiger Pfad."""
    found = {}
    for root, _dirs, files in os.walk(ICON_ROOT):
        if "icon" not in root.lower():
            continue
        for fn in files:
            if fn.lower().endswith(".blp"):
                key = fn[:-4].lower()
                found.setdefault(key, os.path.join(root, fn))
    return found


def main():
    catalog = json.load(io.open("catalog.json", encoding="utf-8"))
    iconmap = json.load(io.open("iconmap.json", encoding="utf-8"))
    blps = index_blps()
    print("BLP-Dateien indiziert:", len(blps))

    # Welche Icons brauchen wir wirklich? Nur die, die im Katalog vorkommen.
    needed = []
    for rec in catalog:
        name = rec[0]
        icon = iconmap.get(name)
        needed.append(icon if icon and icon in blps else None)

    uniq = sorted({i for i in needed if i} | {n for n in EXTRA_ICONS if n in blps})
    print("Katalog:", len(catalog), "| aufloesbare Icons:", sum(1 for i in needed if i),
          "| eindeutige Kacheln:", len(uniq))

    slot = {name: n for n, name in enumerate(uniq)}
    rows = (len(uniq) + COLS - 1) // COLS
    sheet = Image.new("RGBA", (COLS * TILE, rows * TILE), (0, 0, 0, 0))

    bad = 0
    for n, name in enumerate(uniq):
        try:
            im = Image.open(blps[name])
            im.load()
            im = im.convert("RGBA").resize((TILE, TILE), Image.LANCZOS)
            sheet.paste(im, ((n % COLS) * TILE, (n // COLS) * TILE))
        except Exception:
            bad += 1

    sheet.convert("RGB").save("sprite.webp", "WEBP", quality=80, method=6)
    size = os.path.getsize("sprite.webp")
    print("Sheet:", sheet.size, "| Kacheln:", len(uniq), "| defekt:", bad,
          "| WebP:", round(size / 1024), "KB")

    # Index: pro Katalogposition die Kachelnummer, -1 = kein Icon
    idx = [slot.get(i, -1) if i else -1 for i in needed]
    extra = {n: slot[n] for n in EXTRA_ICONS if n in slot}
    io.open("spriteindex.json", "w", encoding="utf-8").write(
        json.dumps({"cols": COLS, "tile": TILE, "idx": idx, "extra": extra},
                   separators=(",", ":"))
    )
    print("Ohne Icon:", sum(1 for v in idx if v < 0))


if __name__ == "__main__":
    sys.exit(main())
