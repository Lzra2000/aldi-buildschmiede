"""Baut den Index 'welche Talente verbessern Basisfaehigkeit X'.

Hintergrund: eine Schulvariante wie Burning Slam traegt
"This uses Slam modifiers" - sie erbt damit die TALENTE von Slam, nicht die
Faehigkeit Slam selbst. Fuer die Skalierungspruefung ist also
entscheidend, ob der Spieler ein Talent gewaehlt hat, das die Basis
verbessert. Ob die Basisfaehigkeit im Build steht, ist irrelevant.

Quellen (kein Raten von Prozenten):
  1. relations.json Feld 0 (Season10-Basisindex), wenn gesetzt
  2. Katalogtext "This uses X modifiers" → Basisname aufloesen

Ausgabe:
  basemods.json  = { basisIndex: [talentIndex, ...] }
  usesbase.json  = { variantenIndex: basisIndex }  # Text-Vererbung;
                     nur Eintraege, bei denen die Phrase aufgeloest wurde.
                     UI: REL[i][0] hat Vorrang, sonst usesbase.
"""
import io
import json
import os
import re
from collections import defaultdict

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")

# Phrase aus dem Tooltip → Katalogname(n), wenn der Phrase-String selbst
# kein Eintrag ist. Nur gemessene Luecken — keine erfundenen Basen.
ALIASES = {
    "swipe": ["Swipe (Cat)"],          # Varianten sagen "Swipe"; Katalog: Swipe (Cat)
    "feral spirits": ["Feral Spirit"], # Plural im Text, Singular im Katalog
}

# Kein gueltiger Modifier-Stamm (Witz / kein Talentziel).
SKIP_PHRASES = {
    "crate",  # "Stealth" → "This uses crate modifiers"
}

USES_RX = re.compile(r"(?i)this uses ([^.]+?) modifiers")


def word_pat(needle):
    """Wortgrenzen, damit Slam != Shield Slam und umgekehrt."""
    return re.compile(
        r"(?<![A-Za-z])" + re.escape(needle) + r"(?![A-Za-z])"
    )


def build_name_index(catalog):
    """name.lower() -> [indices], Abilities (kind 0) zuerst."""
    idx = defaultdict(list)
    for i, rec in enumerate(catalog):
        idx[rec[0].lower()].append(i)
    # Abilities vor Talenten / sonstigem
    for k in idx:
        idx[k].sort(key=lambda i: (0 if catalog[i][1] == 0 else 1, i))
    return idx


def resolve_phrase(phrase, name_index, catalog):
    """Phrase → Katalogindex oder None. Kein Raten bei Mehrdeutigkeit."""
    key = phrase.strip().lower()
    if not key or key in SKIP_PHRASES:
        return None
    candidates = ALIASES.get(key)
    if candidates:
        for name in candidates:
            hits = name_index.get(name.lower()) or []
            ab = [i for i in hits if catalog[i][1] == 0]
            if ab:
                return ab[0]
            if hits:
                return hits[0]
        return None
    hits = name_index.get(key) or []
    ab = [i for i in hits if catalog[i][1] == 0]
    if ab:
        return ab[0]
    if len(hits) == 1:
        return hits[0]
    return None


def main():
    catalog = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    rel = json.load(io.open(os.path.join(DATA, "relations.json"), encoding="utf-8"))
    name_index = build_name_index(catalog)

    # basis -> Suchnadeln (Katalogname + Phrasen aus "uses X")
    needles = defaultdict(set)
    # Variante -> Basis aus Text
    uses_map = {}
    unresolved = []

    # 1) Season10-Relations-Basen
    for i, r in enumerate(rel):
        b = r[0]
        if b is not None:
            needles[b].add(catalog[b][0])

    # 2) Katalogtext "This uses X modifiers"
    for i, rec in enumerate(catalog):
        m = USES_RX.search(rec[5] or "")
        if not m:
            continue
        phrase = m.group(1).strip()
        b = resolve_phrase(phrase, name_index, catalog)
        if b is None:
            unresolved.append((i, rec[0], phrase))
            continue
        uses_map[i] = b
        needles[b].add(catalog[b][0])
        needles[b].add(phrase)

    print("Basen (Relations + Text):", len(needles))
    print("uses-X aufgeloest:", len(uses_map), "| unaufgeloest:", len(unresolved))
    for i, name, phrase in unresolved:
        print("  unresolved:", name, "->", repr(phrase))

    # Talente, die eine Nadel namentlich nennen
    out = {}
    for b, names in needles.items():
        pats = [word_pat(n) for n in names if n]
        hits = []
        for j, rec in enumerate(catalog):
            if rec[1] != 1:  # nur Talente
                continue
            if j == b:
                continue
            desc = rec[5] or ""
            if any(p.search(desc) for p in pats):
                hits.append(j)
        if hits:
            out[b] = hits

    io.open(os.path.join(DATA, "basemods.json"), "w", encoding="utf-8").write(
        json.dumps(out, separators=(",", ":"))
    )
    # String-Keys wie uebrige Embed-Maps (JSON-Objekt)
    uses_out = {str(k): v for k, v in sorted(uses_map.items())}
    io.open(os.path.join(DATA, "usesbase.json"), "w", encoding="utf-8").write(
        json.dumps(uses_out, separators=(",", ":"))
    )

    tot = sum(len(v) for v in out.values())
    print("Basen mit modifizierenden Talenten:", len(out), "| Talent-Verweise:", tot)
    text_only = sum(
        1 for b in out
        if not any(r[0] == b for r in rel)
    )
    print("davon nur ueber Text-Basis (nicht in relations[0]):", text_only)
    for b in list(out)[:5]:
        names = [catalog[j][0] for j in out[b][:4]]
        print("  ", catalog[b][0], "<-", ", ".join(names))


if __name__ == "__main__":
    main()
