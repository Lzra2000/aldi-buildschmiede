# -*- coding: utf-8 -*-
"""Setzt die Buildschmiede zu einer einzelnen HTML-Datei zusammen.

Alles wird eingebettet: Katalog, Beziehungen, Skalierungszahlen, Mechanik
und das Icon-Sprite als data:-URI. Die fertige Seite laeuft ohne jede
externe Anfrage ausser Google Fonts.

    python3 pipeline/assemble.py

liest src/ und data/, schreibt index.html und kopiert
src/synergien-source.html → synergien.html (GitHub Pages).
"""
import base64
import io
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
SRC = os.path.join(ROOT, "src")
DATA = os.path.join(ROOT, "data")

# Schluessel im eingebetteten JSON -> Datei in data/.
# Wer eine neue Datenquelle ergaenzt, traegt sie hier ein und liest sie in
# builder-app.js als D.<schluessel> aus - mehr ist nicht noetig.
PAYLOAD = [
    ("cat", "catalog.json"),        # [name, kind, class, quality, level, desc]
    ("rel", "relations.json"),      # [base, needs, refs[], dupGroup, gate, cdGroup]
    ("arch", "archetypes.json"),    # Archetyp -> [Katalogindex]
    ("spr", "spriteindex.json"),    # {cols, tile, idx[]}
    ("cdg", "cdgroups.json"),       # Namen der geteilten Cooldowngruppen
    ("bm", "basemods.json"),        # Basisindex -> Talente, die sie verbessern
    ("tag", "pathtags.json"),       # Bitmaske: woraus zieht ein Eintrag Wert
    ("sc", "scaling.json"),         # aus Tooltips gelesene Skalierungszahlen
    ("mc", "mechanics.json"),       # Cooldown/Cast/Kosten/Charges aus Spell.dbc
]

# Optional: fehlen stillschweigend — Seite baut trotzdem.
OPTIONAL_PAYLOAD = [
    ("meth", "methods.json"),             # pipeline/methods.py
    ("tree", "spectags.json"),            # Spec-/Schul-Tab aus DataMiner (oeffentlich)
    ("des", "desireelig.json"),           # Desire-Board-fähig (CatalogData.desiredEligible)
    ("stags", "method-spelltags.json"),   # SpellTags-Facetten (DBC ∩ Katalog)
    ("tagn", "tagnames.json"),            # SpellTagTypes Namen + bySpell
    ("ssug", "statsuggest.json"),         # Path aus SpellStatSuggestions.dbc
    ("ssugsp", "spellsuggest.json"),      # Related-Spell-Graph (SpellSpellSuggestions)
    ("iic", "itemicons.json"),            # itemId -> iconName (itemicons.py, kompakt)
]

# Sicherheitsnetz: nur einbetten wenn klein genug fuer GitHub Pages.
ITEMICONS_EMBED_MAX_KB = 512


def read(path):
    return io.open(path, encoding="utf-8").read()


def main():
    payload = {}
    for key, fname in PAYLOAD:
        p = os.path.join(DATA, fname)
        if not os.path.exists(p):
            raise SystemExit("fehlt: data/%s - siehe AGENTS.md" % fname)
        payload[key] = json.load(io.open(p, encoding="utf-8"))

    opt_note = []
    for key, fname in OPTIONAL_PAYLOAD:
        p = os.path.join(DATA, fname)
        if not os.path.exists(p):
            continue
        if key == "iic":
            kb = os.path.getsize(p) / 1024.0
            if kb > ITEMICONS_EMBED_MAX_KB:
                print("  iic uebersprungen (%.0f KB > %d KB) — "
                      "pipeline/itemicons.py ohne --all neu laufen"
                      % (kb, ITEMICONS_EMBED_MAX_KB))
                continue
        payload[key] = json.load(io.open(p, encoding="utf-8"))
        opt_note.append(key)

    # Spell- und Entry-IDs aus spellids.json — Addon-Import matcht zuerst
    # per entryId, dann spellId, zuletzt Name (Season10-Stil; Doppelungen).
    sid_path = os.path.join(DATA, "spellids.json")
    if not os.path.exists(sid_path):
        raise SystemExit("fehlt: data/spellids.json - siehe AGENTS.md")
    sid_rows = json.load(io.open(sid_path, encoding="utf-8"))
    payload["sid"] = [int(row[0]) for row in sid_rows]
    payload["eid"] = [
        int(row[5]) if len(row) > 5 else 0 for row in sid_rows
    ]

    sprite_path = os.path.join(DATA, "sprite.webp")
    if not os.path.exists(sprite_path):
        raise SystemExit("fehlt: data/sprite.webp - siehe AGENTS.md")
    with open(sprite_path, "rb") as fh:
        sprite_b64 = base64.b64encode(fh.read()).decode("ascii")

    head = read(os.path.join(SRC, "builder-head.html"))
    body = read(os.path.join(SRC, "builder-body.html"))
    js = read(os.path.join(SRC, "builder-app.js"))

    out = []
    out.append(head)
    # Spell sprite only — UI chrome is CSS in builder-head (no BLP panel frames).
    out.append("<style>.icon{background-image:url(data:image/webp;base64,"
               + sprite_b64 + ")}</style>")
    out.append(body)
    out.append('<script type="application/json" id="data">')
    out.append(json.dumps(payload, ensure_ascii=False, separators=(",", ":")))
    out.append("</script>")
    out.append("<script>")
    out.append(js)
    out.append("</script>")

    html = "\n".join(out)
    dest = os.path.join(ROOT, "index.html")
    io.open(dest, "w", encoding="utf-8").write(html)

    print("Geschrieben:", dest)
    print("Groesse:", round(len(html.encode("utf-8")) / 1024 / 1024, 2), "MB")
    print("  Katalog:", len(payload["cat"]),
          "| Sprite:", round(len(sprite_b64) / 1024), "KB base64")
    if opt_note:
        print("  Optional:", ", ".join(opt_note))

    # Synergiekompendium: CSS-only chrome (no BLP UI frames).
    syn_src = os.path.join(SRC, "synergien-source.html")
    syn_dest = os.path.join(ROOT, "synergien.html")
    if not os.path.exists(syn_src):
        raise SystemExit("fehlt: src/synergien-source.html")
    syn_html = read(syn_src).replace("<!-- uichrome -->", "", 1)
    io.open(syn_dest, "w", encoding="utf-8").write(syn_html)
    print("Geschrieben:", syn_dest)


if __name__ == "__main__":
    main()
