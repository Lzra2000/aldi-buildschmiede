"""UNTERSUCHUNG, NICHT TEIL DES BUILDS - Ergebnis: nicht verwendbar.

Frage war: laesst sich der Grundschaden zuverlaessiger aus den
Spelleffekten lesen als per Regex aus dem Beschreibungstext?

Antwort: nein. Gegenprobe ueber 3.071 Eintraege:

    identisch          7
    abweichend       101
    nur im Text      140
    nur in der DBC   140

Bei eigenstaendigen Zaubern stimmen beide Quellen praktisch ueberein -
Incinerate 102-121 (Text) gegen 100-118 (DBC), Frostfire Bolt 183-211
gegen 177-205; die Differenz ist Levelskalierung. Bei Schulvarianten mit
"This uses X modifiers" ist der DBC-Eintrag dagegen ein Stummel: Water
Nova zeigt im Tooltip 496 Frost damage, in der DBC stehen 14-17 - die
Werte von Frost Nova Rang 1. Ascension rechnet den echten Wert
serverseitig und schreibt ihn in den Beschreibungstext.

Faktoren zwischen Text und DBC reichen von 0,4x bis 197x, in 25
verschiedenen Groessenordnungen - es gibt also keinen Umrechnungsfaktor,
mit dem man die DBC-Werte brauchbar machen koennte.

Konsequenz: der Beschreibungstext bleibt die Anzeigequelle. Er ist
ausserdem das, was der Spieler im Spiel sieht und nachpruefen kann.

Das Skript bleibt liegen, damit die Frage nicht ein zweites Mal
untersucht wird. Es schreibt data/effects.json, das bewusst NICHT
eingebettet wird.

Technische Notizen fuer den Fall, dass jemand die Felder doch braucht:
   71..73  Effect[3]            Effekttyp (2 Schaden, 10 Heilung, 62 Leech)
   74..76  EffectDieSides[3]    Wuerfelseiten
   80..82  EffectBasePoints[3]  Basiswert, vorzeichenbehaftet lesen
   tatsaechlicher Wert = basePoints + 1 .. basePoints + dieSides
"""
import io
import json
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
SPELL = r"C:\Users\x\Documents\AscensionDBC\patch-T\DBFilesClient\Spell.dbc"

F_EFFECT = 71
F_DIESIDES = 74
F_BASEPOINTS = 80

EFF_DAMAGE = 2
EFF_HEAL = 10
EFF_HEALTH_LEECH = 62


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        assert magic == b"WDBC", (path, magic)
        data = fh.read(rc * rs)
        strings = fh.read(sbs)
    return rc, fc, rs, data, strings


def main():
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    ids = json.load(io.open(os.path.join(DATA, "spellids.json"), encoding="utf-8"))
    scal = json.load(io.open(os.path.join(DATA, "scaling.json"), encoding="utf-8"))

    rc, fc, rs, data, sb = read_dbc(SPELL)
    print("Spell.dbc:", rc, "Eintraege")

    # Vorzeichenbehaftet lesen: EffectBasePoints ist bei Kosten und
    # Abschwaechungen negativ.
    by_id = {}
    for i in range(rc):
        v = struct.unpack_from("<%di" % fc, data, i * rs)
        by_id[v[0] & 0xFFFFFFFF] = v

    out = []
    for idx in range(len(cat)):
        v = by_id.get(ids[idx][0])
        o = {}
        if v:
            for e in range(3):
                eff = v[F_EFFECT + e]
                if eff not in (EFF_DAMAGE, EFF_HEAL, EFF_HEALTH_LEECH):
                    continue
                base = v[F_BASEPOINTS + e]
                sides = v[F_DIESIDES + e]
                lo = base + 1
                hi = base + max(sides, 1)
                if lo <= 0:
                    continue
                key = "heal" if eff == EFF_HEAL else "dmg"
                if key not in o:
                    o[key] = [lo, hi]
        out.append(o)

    io.open(os.path.join(DATA, "effects.json"), "w", encoding="utf-8").write(
        json.dumps(out, separators=(",", ":"))
    )

    withdmg = sum(1 for o in out if "dmg" in o)
    withheal = sum(1 for o in out if "heal" in o)
    print("mit Schadenseffekt:", withdmg, "| mit Heileffekt:", withheal)

    # Gegenprobe gegen die Textauswertung.
    same = diff = onlytext = onlydbc = 0
    examples = []
    for i, o in enumerate(out):
        t = scal[i].get("flat")
        d = o.get("dmg")
        if t and d:
            if t[0] == d[0] and t[1] == d[1]:
                same += 1
            else:
                diff += 1
                if len(examples) < 8:
                    examples.append((cat[i][0], t, d, (cat[i][5] or "")[:70]))
        elif t and not d:
            onlytext += 1
        elif d and not t:
            onlydbc += 1

    print("\nText gegen DBC:")
    print("  identisch      %5d" % same)
    print("  abweichend     %5d" % diff)
    print("  nur im Text    %5d" % onlytext)
    print("  nur in der DBC %5d" % onlydbc)
    if examples:
        print("\nAbweichungen:")
        for n, t, d, desc in examples:
            print("  %-22s Text %-12s DBC %-12s | %s"
                  % (n[:22], "%d-%d" % (t[0], t[1]), "%d-%d" % (d[0], d[1]), desc))


if __name__ == "__main__":
    main()
