"""Baut den Index 'welche Talente verbessern Basisfaehigkeit X'.

Hintergrund: eine Schulvariante wie Burning Slam traegt
"This uses Slam modifiers" - sie erbt damit die TALENTE von Slam, nicht die
Faehigkeit Slam selbst. Fuer die Skalierungspruefung ist also
entscheidend, ob der Spieler ein Talent gewaehlt hat, das die Basis
verbessert. Ob die Basisfaehigkeit im Build steht, ist irrelevant.

Ausgabe: basemods.json = { basisIndex: [talentIndex, ...] }
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")


def main():
    catalog = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    rel = json.load(io.open(os.path.join(DATA, "relations.json"), encoding="utf-8"))

    # Welche Eintraege sind ueberhaupt Basis einer Vererbung?
    bases = {}
    for i, r in enumerate(rel):
        b = r[0]
        if b is not None:
            bases.setdefault(b, []).append(i)
    print("Basisfaehigkeiten mit Varianten:", len(bases))

    # Fuer jede Basis: welche TALENTE nennen sie namentlich?
    out = {}
    for b in bases:
        name = catalog[b][0]
        # Wortgrenzen, damit "Slam" nicht in "Shield Slam" mitzaehlt und
        # umgekehrt "Shield Slam" nicht als "Slam" durchgeht.
        pat = re.compile(r"(?<![A-Za-z])" + re.escape(name) + r"(?![A-Za-z])")
        hits = []
        for j, rec in enumerate(catalog):
            if rec[1] != 1:      # nur Talente
                continue
            if j == b:
                continue
            if pat.search(rec[5]):
                hits.append(j)
        if hits:
            out[b] = hits

    io.open(os.path.join(DATA, "basemods.json"), "w", encoding="utf-8").write(
        json.dumps(out, separators=(",", ":"))
    )
    tot = sum(len(v) for v in out.values())
    print("Basen mit modifizierenden Talenten:", len(out), "| Talent-Verweise:", tot)
    # Ein paar Beispiele zur Kontrolle
    for b in list(out)[:5]:
        names = [catalog[j][0] for j in out[b][:4]]
        print("  ", catalog[b][0], "<-", ", ".join(names))


if __name__ == "__main__":
    main()
