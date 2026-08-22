# -*- coding: utf-8 -*-
"""Related-Spell-Graph aus SpellSpellSuggestions.dbc.

DBC-Layout (WDBC, 4 Felder, 353193 Zeilen):

    rowId, spellId, relatedSpellId, weight

weight ist ein ganzzahliger Score (0..~9800); hoeher = staerkerer Vorschlag.
Die Tabelle ist gerichtet und asymmetrisch — keine Kanten erfinden.

Nur Kanten, bei denen BEIDE SpellIds im Katalog stehen (3071). Top-N
pro Quell-Spell nach weight absteigend, als Katalogindizes (nicht SpellIds),
damit die JSON klein genug zum Einbetten bleibt.

Ausgabe: data/spellsuggest.json
Einbettung optional als D.ssugsp (assemble OPTIONAL_PAYLOAD).
NICHT D.ssug — das ist SpellStatSuggestions / Path-Hinweise.

    python3 pipeline/spellsuggest.py
"""
from __future__ import print_function

import collections
import io
import json
import os
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
DBC = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
SUGGEST = os.path.join(DBC, "SpellSpellSuggestions.dbc")

# Genug fuer UI-Vorschlaege, << 500 KB Embed-Budget.
TOP_N = 12


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        if magic != b"WDBC":
            raise SystemExit("not WDBC: %s" % path)
        data = fh.read(rc * rs)
        strings = fh.read(sbs)
    return rc, fc, rs, data, strings


def load_edges(sid_to_idx):
    """spellId -> [(catalogIndex, weight), ...] nur Katalog↔Katalog, a!=b."""
    if not os.path.isfile(SUGGEST):
        raise SystemExit("fehlt: %s" % SUGGEST)
    rc, fc, rs, data, _ = read_dbc(SUGGEST)
    if fc < 4:
        raise SystemExit("SpellSpellSuggestions: erwartete >=4 Felder, got %d" % fc)

    adj = collections.defaultdict(list)
    both = 0
    src_only = 0
    dst_only = 0
    self_loops = 0
    weight_hist = collections.Counter()

    for i in range(rc):
        _rid, a, b, w = struct.unpack_from("<iiii", data, i * rs)
        weight_hist[w] += 1
        ai = sid_to_idx.get(a)
        bi = sid_to_idx.get(b)
        if ai is None and bi is None:
            continue
        if ai is None:
            dst_only += 1
            continue
        if bi is None:
            src_only += 1
            continue
        if a == b:
            self_loops += 1
            continue
        both += 1
        adj[a].append((bi, w))

    for a in adj:
        adj[a].sort(key=lambda x: (-x[1], x[0]))

    meta = {
        "dbcRows": rc,
        "catalogBoth": both,
        "srcCatalogOnly": src_only,
        "dstCatalogOnly": dst_only,
        "selfLoops": self_loops,
        "weightTop": dict(weight_hist.most_common(20)),
    }
    return adj, meta


def main():
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    ids = json.load(io.open(os.path.join(DATA, "spellids.json"), encoding="utf-8"))
    if len(cat) != len(ids):
        raise SystemExit("catalog/spellids Laengen drift")

    cat_sids = [int(row[0] or 0) for row in ids]
    sid_to_idx = {sid: i for i, sid in enumerate(cat_sids) if sid}
    adj, meta = load_edges(sid_to_idx)

    rows = []
    edges_kept = 0
    nodes = 0
    for sid in cat_sids:
        flat = []
        for idx, w in adj.get(sid, [])[:TOP_N]:
            flat.append(idx)
            flat.append(w)
        rows.append(flat)
        if flat:
            nodes += 1
            edges_kept += len(flat) // 2

    out = {
        "v": 1,
        "source": "SpellSpellSuggestions.dbc",
        "layout": "rowId, spellId, relatedSpellId, weight",
        "note": (
            "Gerichtete Related-Spell-Kanten aus SpellSpellSuggestions.dbc. "
            "Nur Katalog↔Katalog (beide SpellIds in spellids.json), Self-Loops "
            "verworfen. Pro Quell-Spell Top-%d nach weight absteigend. "
            "rel[i] = flaches [catalogIndex, weight, ...] parallel zum Katalog. "
            "Keine erfundenen Kanten. Assemble-Schluessel D.ssugsp "
            "(nicht D.ssug = SpellStatSuggestions/Path)."
            % TOP_N
        ),
        "topN": TOP_N,
        "catalogSize": len(cat),
        "nodes": nodes,
        "edgesKept": edges_kept,
        "dbc": meta,
        "rel": rows,
    }

    dest = os.path.join(DATA, "spellsuggest.json")
    raw = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    io.open(dest, "w", encoding="utf-8").write(raw)
    kb = len(raw.encode("utf-8")) / 1024.0
    print("Geschrieben:", dest)
    print("  Knoten mit Nachbarn: %d / %d" % (nodes, len(cat)))
    print("  Kanten behalten: %d (Top-%d)" % (edges_kept, TOP_N))
    print("  DBC Katalog<->Katalog: %d  src-only: %d  self: %d" % (
        meta["catalogBoth"], meta["srcCatalogOnly"], meta["selfLoops"]))
    print("  Groesse: %.1f KB" % kb)


if __name__ == "__main__":
    main()
