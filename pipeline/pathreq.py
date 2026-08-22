# -*- coding: utf-8 -*-
"""Harte Path-Voraussetzung pro Katalogeintrag.

Nur gemessener Text: ``Requires Path of X`` / ``Requires Primary Stat: X``
aus CatalogData.lua und catalog.json, plus relations-Gate Art Pfad/Stat.

SpellStatSuggestions (D.ssug) ist KEIN Requirement — nur Hinweis.
Might/Finesse werden nicht auf Strength/Agility geraten.

    python3 pipeline/pathreq.py            # schreibt data/pathreq.json
    python3 pipeline/pathreq.py --verify   # nur pruefen
"""
from __future__ import print_function

import io
import json
import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
SRC = os.path.join(DATA, "CatalogData.lua")
EMBED_MAX_KB = 64
CATALOG_LEN = 3071
# Zu viele Treffer = Regex zu gierig, nicht der Katalog.
REQ_CEILING = 200

# Nur die fuenf Paths. Spirit = Healing (Client zeigt Path of Healing).
# Intellect = Intelligence. Might/Finesse: nicht mappen.
PATH_MAP = {
    "healing": "heal",
    "spirit": "heal",
    "strength": "str",
    "agility": "agi",
    "intelligence": "int",
    "intellect": "int",
    "duality": "dua",
}
PATH_ORDER = ("str", "agi", "int", "heal", "dua")
PATH_NAME = {
    "str": "Strength",
    "agi": "Agility",
    "int": "Intelligence",
    "heal": "Healing",
    "dua": "Duality",
}

# Nur HARTE Requires-Zeilen. Bonus/Malus ("while your Primary Stat is") nie.
RX_REQ_PATH = re.compile(
    r"\bRequires\s+Path\s+of\s+(Healing|Strength|Agility|Intelligence|Duality)\b",
    re.I,
)
RX_REQ_STAT = re.compile(
    r"\bRequires\s+Primary\s+Stat:\s*"
    r"([A-Za-z][A-Za-z]*(?:\s+or\s+[A-Za-z][A-Za-z]*)*)",
    re.I,
)
RX_REL_PATH = re.compile(r"Path\s+of\s+(\w+)", re.I)
RX_REL_STAT = re.compile(r"Primary\s+Stat:\s*(.+)$", re.I)

# CatalogData: kind, name, spellId, entryId, class, rank, description
LUA_ROW = re.compile(
    r'^\s*\{\s*"(Spell|Talent)"\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
    r'(nil|\d+)\s*,\s*(nil|\d+)\s*,\s*"((?:[^"\\]|\\.)*)"\s*,\s*'
    r'"((?:[^"\\]|\\.)*)"\s*,\s*"((?:[^"\\]|\\.)*)"',
)

# Anker: gemessen im Tooltip, nicht geraten.
ANCHORS = (
    ("Potion Toss", "heal"),
    ("Careful Aim", "agi"),
    ("Perforating Shots", "str"),
    ("Grove Ranger's Agility", "heal"),
)
# Kein hartes Require — nur ssug / Bonus-Text.
ANCHORS_EMPTY = (
    "Charge",
    "Frostbolt",
    "Backstab",
    "Renew",
)
# Gemessen unmapped (Might/Finesse ≠ die fuenf Paths).
ANCHOR_RAW = ("Power of Light", "Might or Finesse")


def unescape(s):
    return s.replace('\\"', '"').replace("\\\\", "\\")


def map_token(tok):
    if not tok:
        return None
    return PATH_MAP.get(str(tok).strip().lower())


def parse_stat_list(blob):
    """OR-Liste → (mapped_keys, unmapped_tokens)."""
    parts = re.split(r"\s+or\s+", str(blob or ""), flags=re.I)
    mapped, raw = [], []
    seen = set()
    for p in parts:
        t = p.strip()
        if not t:
            continue
        k = map_token(t)
        if k:
            if k not in seen:
                mapped.append(k)
                seen.add(k)
        else:
            raw.append(t)
    return mapped, raw


def extract_text(desc):
    """Nur Requires-Zeilen. Gibt (keys, raw_bits)."""
    keys = []
    raw = []
    seen = set()
    d = desc or ""
    for m in RX_REQ_PATH.finditer(d):
        k = map_token(m.group(1))
        if k and k not in seen:
            keys.append(k)
            seen.add(k)
        elif not k:
            raw.append("Path of " + m.group(1))
    for m in RX_REQ_STAT.finditer(d):
        mapped, unmapped = parse_stat_list(m.group(1))
        if unmapped:
            # OR mit unmapped Token: nichts erfinden — nur Rohtext.
            raw.append("Primary Stat: " + m.group(1).strip())
        else:
            for k in mapped:
                if k not in seen:
                    keys.append(k)
                    seen.add(k)
    return keys, raw


def extract_rel_gate(gate):
    if not gate or not isinstance(gate, (list, tuple)) or len(gate) < 2:
        return [], []
    art = str(gate[0] or "")
    name = str(gate[1] or "")
    if art in ("Pfad", "Path"):
        m = RX_REL_PATH.search(name)
        tok = m.group(1) if m else name
        k = map_token(tok)
        if k:
            return [k], []
        return [], [name]
    if art == "Stat":
        m = RX_REL_STAT.search(name)
        blob = m.group(1) if m else name
        mapped, unmapped = parse_stat_list(blob)
        if unmapped:
            return [], ["Primary Stat: " + blob.strip()]
        return mapped, []
    return [], []


def load_lua_descs():
    """spellId / entryId → Beschreibung aus CatalogData.lua."""
    by_sid, by_eid = {}, {}
    n = 0
    if not os.path.isfile(SRC):
        return by_sid, by_eid, n
    for ln in io.open(SRC, encoding="utf-8"):
        m = LUA_ROW.match(ln)
        if not m:
            continue
        _kind, _name, sid_s, eid_s, _cls, _rank, desc = m.groups()
        desc = unescape(desc)
        n += 1
        if sid_s != "nil":
            sid = int(sid_s)
            if sid and sid not in by_sid:
                by_sid[sid] = desc
        if eid_s != "nil":
            eid = int(eid_s)
            if eid and eid not in by_eid:
                by_eid[eid] = desc
    return by_sid, by_eid, n


def join_keys(keys):
    order = {k: i for i, k in enumerate(PATH_ORDER)}
    uniq = []
    seen = set()
    for k in keys:
        if k in PATH_NAME and k not in seen:
            uniq.append(k)
            seen.add(k)
    uniq.sort(key=lambda k: order.get(k, 99))
    return "+".join(uniq)


def join_raw(bits):
    out, seen = [], set()
    for b in bits:
        t = " ".join(str(b).split())
        if t and t not in seen:
            out.append(t)
            seen.add(t)
    return "; ".join(out)


def build(cat, sid_rows, rel, by_sid, by_eid):
    req = {}
    raw = {}
    src_n = {"lua": 0, "cat": 0, "rel": 0}
    how = {"spellId": 0, "entryId": 0, "catOnly": 0}
    for i, rec in enumerate(cat):
        keys, bits = [], []
        sid = int(sid_rows[i][0]) if i < len(sid_rows) else 0
        eid = 0
        if i < len(sid_rows) and len(sid_rows[i]) > 5:
            eid = int(sid_rows[i][5]) or 0
        lua_desc = None
        if sid and sid in by_sid:
            lua_desc = by_sid[sid]
            how["spellId"] += 1
        elif eid and eid in by_eid:
            lua_desc = by_eid[eid]
            how["entryId"] += 1
        if lua_desc:
            k, r = extract_text(lua_desc)
            if k or r:
                src_n["lua"] += 1
            keys.extend(k)
            bits.extend(r)
        cat_desc = rec[5] if len(rec) > 5 else ""
        k2, r2 = extract_text(cat_desc)
        if k2 or r2:
            src_n["cat"] += 1
            if not lua_desc:
                how["catOnly"] += 1
        keys.extend(k2)
        bits.extend(r2)
        gate = None
        if i < len(rel) and isinstance(rel[i], (list, tuple)) and len(rel[i]) > 4:
            gate = rel[i][4]
        k3, r3 = extract_rel_gate(gate)
        if k3 or r3:
            src_n["rel"] += 1
        keys.extend(k3)
        bits.extend(r3)
        ks = join_keys(keys)
        rs = join_raw(bits)
        if ks:
            req[str(i)] = ks
        if rs:
            raw[str(i)] = rs
    return req, raw, src_n, how


def by_path_counts(req):
    out = {k: 0 for k in PATH_ORDER}
    for v in req.values():
        for k in v.split("+"):
            if k in out:
                out[k] += 1
    return out


def find_name(cat, name):
    want = name.lower()
    for i, rec in enumerate(cat):
        if rec[0].lower() == want:
            return i
    return None


def verify_payload(cat, out, kb):
    if out.get("v") != 1:
        raise SystemExit("pathreq: v muss 1 sein")
    req = out.get("req") or {}
    raw = out.get("raw") or {}
    if not isinstance(req, dict) or not isinstance(raw, dict):
        raise SystemExit("pathreq: req/raw muessen Objekte sein")
    n = len(cat)
    for k, v in req.items():
        try:
            i = int(k)
        except ValueError:
            raise SystemExit("pathreq: ungueltiger Index %r" % k)
        if i < 0 or i >= n:
            raise SystemExit("pathreq: Index ausserhalb %s" % k)
        parts = [p for p in str(v).split("+") if p]
        if not parts or any(p not in PATH_NAME for p in parts):
            raise SystemExit("pathreq: ungueltige Keys an %s: %r" % (k, v))
    if len(req) > REQ_CEILING:
        raise SystemExit(
            "pathreq: %d Requirements > %d — Regex zu gierig"
            % (len(req), REQ_CEILING)
        )
    if kb > EMBED_MAX_KB:
        raise SystemExit(
            "pathreq.json %.1f KB > %d KB — nicht einbettbar"
            % (kb, EMBED_MAX_KB)
        )
    for name, key in ANCHORS:
        i = find_name(cat, name)
        if i is None:
            raise SystemExit("pathreq-Anker fehlt im Katalog: %s" % name)
        got = req.get(str(i), "")
        if key not in got.split("+"):
            raise SystemExit(
                "pathreq-Anker %s (i=%d): erwartet %s, ist %r"
                % (name, i, key, got)
            )
    for name in ANCHORS_EMPTY:
        i = find_name(cat, name)
        if i is None:
            continue
        if str(i) in req:
            raise SystemExit(
                "pathreq: %s darf kein hartes Require haben (ist %r)"
                % (name, req[str(i)])
            )
    i = find_name(cat, ANCHOR_RAW[0])
    if i is not None:
        blob = raw.get(str(i), "")
        if ANCHOR_RAW[1] not in blob:
            raise SystemExit(
                "pathreq: %s muss unmapped bleiben (%s), ist %r"
                % (ANCHOR_RAW[0], ANCHOR_RAW[1], blob)
            )
        if str(i) in req:
            raise SystemExit(
                "pathreq: %s nicht auf einen Path mappen (Might/Finesse)"
                % ANCHOR_RAW[0]
            )
    return kb


def payload_of(cat, req, raw, src_n, how, n_lua):
    byp = by_path_counts(req)
    n_ssug = 0
    ssug_path = os.path.join(DATA, "statsuggest.json")
    if os.path.isfile(ssug_path):
        ssug = json.load(io.open(ssug_path, encoding="utf-8"))
        paths = ssug.get("path") if isinstance(ssug, dict) else None
        if isinstance(paths, list):
            n_ssug = sum(1 for p in paths if p)
    return {
        "v": 1,
        "req": req,
        "raw": raw,
        "meta": {
            "nReq": len(req),
            "nRaw": len(raw),
            "nSsug": n_ssug,
            "byPath": byp,
            "src": src_n,
            "match": how,
            "luaRows": n_lua,
            "note": (
                "req = hartes Requires (CatalogData/Katalog/relations.Pfad). "
                "ssug bleibt Hinweis. raw = unmapped (Might/Finesse)."
            ),
        },
    }


def report(cat, out, kb, dest=None):
    meta = out["meta"]
    req = out["req"]
    print("Katalog:", len(cat), "| harte Path-Requires:", meta["nReq"],
          "| unmapped raw:", meta["nRaw"],
          "| ssug-Hinweise:", meta["nSsug"])
    print("  byPath:", " ".join("%s=%s" % (k, meta["byPath"][k])
                                for k in PATH_ORDER if meta["byPath"][k]))
    print("  Quelle Eintraege: lua=%s cat=%s rel=%s | CatalogData-Zeilen=%s"
          % (meta["src"]["lua"], meta["src"]["cat"], meta["src"]["rel"],
             meta["luaRows"]))
    print("  Match: spellId=%s entryId=%s catOnly=%s"
          % (meta["match"]["spellId"], meta["match"]["entryId"],
             meta["match"]["catOnly"]))
    print("  Datei: %.1f KB (D.preq, Deckel %d KB)" % (kb, EMBED_MAX_KB))
    if dest:
        print("Geschrieben:", dest)
    shown = 0
    for i_s, keys in sorted(req.items(), key=lambda kv: int(kv[0])):
        i = int(i_s)
        labs = "+".join(PATH_NAME[k] for k in keys.split("+"))
        print("  req:", cat[i][0], "|", labs, "|",
              "TAL" if cat[i][1] else "ABI")
        shown += 1
        if shown >= 12:
            rest = len(req) - shown
            if rest > 0:
                print("  … +%d weitere" % rest)
            break
    for i_s, blob in sorted(out["raw"].items(), key=lambda kv: int(kv[0])):
        i = int(i_s)
        print("  raw:", cat[i][0], "|", blob)


def main(argv=None):
    argv = list(sys.argv[1:] if argv is None else argv)
    verify_only = "--verify" in argv
    dest = os.path.join(DATA, "pathreq.json")
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    if len(cat) != CATALOG_LEN:
        print("Hinweis: Kataloglaenge %d != %d" % (len(cat), CATALOG_LEN))

    sid_path = os.path.join(DATA, "spellids.json")
    sid_rows = []
    if os.path.isfile(sid_path):
        sid_rows = json.load(io.open(sid_path, encoding="utf-8"))
    rel_path = os.path.join(DATA, "relations.json")
    rel = []
    if os.path.isfile(rel_path):
        rel = json.load(io.open(rel_path, encoding="utf-8"))

    by_sid, by_eid, n_lua = load_lua_descs()
    if not n_lua and os.path.isfile(dest):
        print("CatalogData.lua fehlt — vorhandenes pathreq.json bleibt.",
              file=sys.stderr)
        out = json.load(io.open(dest, encoding="utf-8"))
        kb = os.path.getsize(dest) / 1024.0
        verify_payload(cat, out, kb)
        report(cat, out, kb)
        return

    req, raw, src_n, how = build(cat, sid_rows, rel, by_sid, by_eid)
    out = payload_of(cat, req, raw, src_n, how, n_lua)
    blob = json.dumps(out, ensure_ascii=False, separators=(",", ":"))
    kb = len(blob.encode("utf-8")) / 1024.0
    verify_payload(cat, out, kb)
    if verify_only:
        if os.path.isfile(dest):
            old = json.load(io.open(dest, encoding="utf-8"))
            if old.get("req") != out["req"] or old.get("raw") != out["raw"]:
                raise SystemExit("pathreq --verify: JSON driftet")
        report(cat, out, kb)
        return
    io.open(dest, "w", encoding="utf-8").write(blob)
    verify_payload(cat, out, os.path.getsize(dest) / 1024.0)
    report(cat, out, kb, dest)


if __name__ == "__main__":
    main()
