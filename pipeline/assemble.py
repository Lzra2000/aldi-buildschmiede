# -*- coding: utf-8 -*-
"""Setzt Builder und Synergien fuer GitHub Pages zusammen.

Alles wird eingebettet: Katalog, Beziehungen, Skalierungszahlen, Mechanik
und das Icon-Sprite als data:-URI. Die fertige Builder-Seite laeuft ohne
jede externe Anfrage ausser Google Fonts.

    python3 pipeline/assemble.py

liest src/ und data/, schreibt IMMER beides:

  - index.html          ← builder-head + body + data + builder-app.js
  - synergien.html      ← src/synergien-source.html (Synergien ist first-class;
                          fehlende Quelle = harter Fehler, kein Skip)

Beide Pages-URLs muessen nach jedem Website-Ship zusammenpassen.
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
    ("ub", "usesbase.json"),        # Variante -> Basis aus "uses X modifiers"-Text
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
    ("ilb", "ilvlbands.json"),            # ilvl/Waffen-Bänder 10–60 (ilvlbands.py)
    ("wpn", "weapons.json"),              # itemId -> ItemStat-Bänder 10–60 (weapons.py)
    ("frm", "formtags.json"),             # Form-Familie aus Katalogtext (formtags.py)
    ("preq", "pathreq.json"),             # harte Path-Requires (pathreq.py) ≠ ssug
    ("lmeta", "logmeta.json"),            # Darkmoon-Log-Meta (logmeta.py)
]

# Sicherheitsnetz: nur einbetten wenn klein genug fuer GitHub Pages.
ITEMICONS_EMBED_MAX_KB = 512
# Parallele Katalog-Arrays (frm / des / tree) — nur einbetten wenn klein.
FORMTAGS_EMBED_MAX_KB = 64
PARALLEL_EMBED_MAX_KB = 64


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
        if key == "wpn":
            kb = os.path.getsize(p) / 1024.0
            if kb > ITEMICONS_EMBED_MAX_KB:
                print("  wpn uebersprungen (%.0f KB > %d KB) — "
                      "pipeline/weapons.py Seed verkleinern"
                      % (kb, ITEMICONS_EMBED_MAX_KB))
                continue
        if key == "frm":
            kb = os.path.getsize(p) / 1024.0
            if kb > FORMTAGS_EMBED_MAX_KB:
                print("  frm uebersprungen (%.0f KB > %d KB) — "
                      "pipeline/formtags.py kompakter halten"
                      % (kb, FORMTAGS_EMBED_MAX_KB))
                continue
        if key == "preq":
            kb = os.path.getsize(p) / 1024.0
            if kb > PARALLEL_EMBED_MAX_KB:
                print("  preq uebersprungen (%.0f KB > %d KB) — "
                      "pipeline/pathreq.py kompakter halten"
                      % (kb, PARALLEL_EMBED_MAX_KB))
                continue
        if key in ("des", "tree"):
            kb = os.path.getsize(p) / 1024.0
            if kb > PARALLEL_EMBED_MAX_KB:
                raise SystemExit(
                    "data/%s %.0f KB > %d KB — nicht einbettbar "
                    "(Desire-/Spec-Filter waere unvollstaendig)"
                    % (fname, kb, PARALLEL_EMBED_MAX_KB)
                )
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

    # Synergien (first-class Pages sibling): always emit; never skip.
    # CSS-only chrome (no BLP UI frames). Source missing = hard fail.
    syn_src = os.path.join(SRC, "synergien-source.html")
    syn_dest = os.path.join(ROOT, "synergien.html")
    if not os.path.exists(syn_src):
        raise SystemExit(
            "fehlt: src/synergien-source.html — Synergien ist Pflicht-Ship "
            "(siehe .cursor/rules/synergien-first-class.mdc)"
        )
    syn_html = read(syn_src).replace("<!-- uichrome -->", "", 1)
    io.open(syn_dest, "w", encoding="utf-8").write(syn_html)
    if not os.path.exists(syn_dest) or os.path.getsize(syn_dest) < 100:
        raise SystemExit("synergien.html wurde nicht korrekt geschrieben")
    print("Geschrieben:", syn_dest)


if __name__ == "__main__":
    main()
