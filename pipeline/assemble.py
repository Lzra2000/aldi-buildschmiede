# -*- coding: utf-8 -*-
"""Setzt die Buildschmiede zu einer einzelnen HTML-Datei zusammen.

Alles wird eingebettet: Katalog, Beziehungen, Skalierungszahlen, Mechanik
und das Icon-Sprite als data:-URI. Die fertige Seite laeuft ohne jede
externe Anfrage ausser Google Fonts.

    python3 pipeline/assemble.py

liest src/ und data/ und schreibt index.html im Wurzelverzeichnis.
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
    ("mc", "mechanics.json"),       # Cooldown/Cast/Kosten aus Spell.dbc
]


def read(path):
    return io.open(path, encoding="utf-8").read()


def main():
    payload = {}
    for key, fname in PAYLOAD:
        p = os.path.join(DATA, fname)
        if not os.path.exists(p):
            raise SystemExit("fehlt: data/%s - siehe AGENTS.md" % fname)
        payload[key] = json.load(io.open(p, encoding="utf-8"))

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


if __name__ == "__main__":
    main()
