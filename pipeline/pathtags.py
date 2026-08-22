"""Taggt jeden Katalogeintrag danach, WORAUS er seinen Wert zieht.

Das ist die Grundlage fuer die Pfadempfehlung: ein Build, der ueberwiegend
Waffenschaden-als-Element austeilt, will einen anderen Pfad als einer, der
reine Spruchsalven schiebt.

Bitmaske pro Katalogindex:
   1  WEAPON   - skaliert mit Waffenschaden ("100% weapon damage", main-hand ...)
   2  MAGIC    - richtet Schaden einer Magieschule an / nennt Spell Power
   4  HEAL     - heilt
   8  PHYS     - ausdruecklich physischer Schaden ohne Schule
  16  TWOHAND  - Text nennt Two-Handed
  32  ONEHAND  - Text nennt One-Handed
  64  AP       - nennt Attack Power
 128  SP       - nennt Spell Power
 256  CRIT     - nennt kritische Treffer
 512  HASTE    - nennt Tempo
1024  ARPEN    - nennt Ruestungsdurchdringung / ignoriert Ruestung
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")

SCHOOLS = r"(?:Fire|Frost|Nature|Shadow|Arcane|Holy|Radiant|Void|Storm|Lightning|Frostfire)"

RX = {
    1: re.compile(r"weapon damage|main-hand|off-hand|main hand|weapon dps", re.I),
    2: re.compile(r"\b" + SCHOOLS + r"\s+damage\b|\bas\s+" + SCHOOLS + r"\b"
                  r"|spell damage|spell power", re.I),
    4: re.compile(r"\bheal(?:s|ing|ed)?\b|restor\w*\s+(?:\d|[\w\s]{0,12}health)", re.I),
    8: re.compile(r"\bphysical damage\b", re.I),
    16: re.compile(r"two-handed", re.I),
    32: re.compile(r"one-handed", re.I),
    64: re.compile(r"attack power", re.I),
    128: re.compile(r"spell power", re.I),
    256: re.compile(r"critical strike|\bcrit\b", re.I),
    512: re.compile(r"\bhaste\b|attack speed|casting speed|cast time", re.I),
    1024: re.compile(r"armor penetration|ignores? armor|bypass\w* armor", re.I),
}

NAMES = [(1, "WEAPON"), (2, "MAGIC"), (4, "HEAL"), (8, "PHYS"), (16, "2H"),
         (32, "1H"), (64, "AP"), (128, "SP"), (256, "CRIT"), (512, "HASTE"),
         (1024, "ARPEN")]


def main():
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    tags = []
    for rec in cat:
        d = rec[5] or ""
        v = 0
        for bit, rx in RX.items():
            if rx.search(d):
                v |= bit
        tags.append(v)

    io.open(os.path.join(DATA, "pathtags.json"), "w", encoding="utf-8").write(
        json.dumps(tags, separators=(",", ":"))
    )

    print("Eintraege:", len(tags))
    for bit, name in NAMES:
        print("  %-7s %5d" % (name, sum(1 for v in tags if v & bit)))
    print("  WEAPON+MAGIC (Duality-Kandidaten):",
          sum(1 for v in tags if (v & 1) and (v & 2)))


if __name__ == "__main__":
    main()
