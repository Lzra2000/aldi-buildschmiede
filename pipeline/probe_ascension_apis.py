# -*- coding: utf-8 -*-
"""Probe bereits extrahierter Ascension-DBC/Lua — schreibt NOTES, kopiert keinen Client-Code.

Liest nur:
  - C:\\Users\\x\\Documents\\AscensionDBC\\DBFilesClient\\*.dbc
  - optional CatalogData.lua (Repo) fuer Tag-Schnittmenge
  - optional AscensionLuaExtract (Aufrufzaehler, keine Dateikopie)

Ausgabe: pipeline/NOTES-ascension-apis.md (additiv, kein Collect-1.4.0-Umbau).
"""
from __future__ import print_function

import collections
import datetime
import io
import os
import re
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
NOTES = os.path.join(HERE, "NOTES-ascension-apis.md")
DBC_DIR = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
LUA_EXTRACT = (
    r"C:\Users\x\Documents\AscensionLuaExtract\by-archive\patch-B.MPQ"
)
CATALOG = os.path.join(REPO, "data", "CatalogData.lua")

# APIs die Collect/Inspect/Quality/SkillCards bereits anfassen (kein Inventar).
USED = {
    "C_CharacterAdvancement.GetKnownSpellEntries",
    "C_CharacterAdvancement.GetKnownTalentEntries",
    "C_CharacterAdvancement.GetTalentRankByID",
    "C_CharacterAdvancement.ExportBuild",
    "C_CharacterAdvancement.GetRemainingAE",
    "C_CharacterAdvancement.GetRemainingTE",
    "C_CharacterAdvancement.GetGlobalAEInvestment",
    "C_CharacterAdvancement.GetGlobalTEInvestment",
    "C_CharacterAdvancement.GetLearnedAE",
    "C_CharacterAdvancement.GetLearnedTE",
    "C_CharacterAdvancement.IsLockedID",
    "C_CharacterAdvancement.GetActiveSpecID",
    "C_CharacterAdvancement.GetAbilityEssenceCost",
    "C_CharacterAdvancement.GetTalentEssenceCost",
    "C_CharacterAdvancement.IsMastery",
    "C_CharacterAdvancement.GetClassPointInvestment",
    "C_CharacterAdvancement.GetQualityCount",
    "C_CharacterAdvancement.GetQualityLimit",
    "C_CharacterAdvancement.GetQualityInfo",
    "C_CharacterAdvancement.GetAllEntries",
    "C_CharacterAdvancement.InspectUnit",
    "C_CharacterAdvancement.GetInspectedBuild",
    "C_CharacterAdvancement.GetInspectInfo",
    "C_CharacterAdvancement.GetEntryByInternalID",
    "C_CharacterAdvancement.IsTalentID",
    "C_CharacterAdvancement.IsTalentAbilityID",
    "C_PrimaryStat.GetActivePrimaryStat",
    "C_PrimaryStat.GetUnitPrimaryStat",
    "C_GameMode.IsGameModeActive",
    "C_SkillCard.GetMaxCardCount",
    "C_SkillCard.GetCardAtIndex",
    "C_SkillCard.IsCardAtIndexBlocked",
    "C_SkillCard.IsCardedSpellID",
    "C_SkillCard.GetSkillCardInfo",
    "C_SkillCard.GetCardSpellID",
}


def read_dbc(path):
    with open(path, "rb") as fh:
        magic, rc, fc, rs, sbs = struct.unpack("<4sIIII", fh.read(20))
        assert magic == b"WDBC", (path, magic)
        data = fh.read(rc * rs)
        strings = fh.read(sbs)
    return rc, fc, rs, data, strings


def sref(strings, off):
    if off <= 0 or off >= len(strings):
        return ""
    end = strings.find(b"\x00", off)
    if end < 0:
        end = len(strings)
    return strings[off:end].decode("utf-8", "replace")


def catalog_spell_ids():
    ids = set()
    if not os.path.isfile(CATALOG):
        return ids
    pat = re.compile(
        r'^\s*\{\s*"(?:Spell|Talent)"\s*,\s*"(?:[^"\\]|\\.)*"\s*,\s*(\d+)'
    )
    with io.open(CATALOG, encoding="utf-8") as fh:
        for ln in fh:
            m = pat.match(ln)
            if m:
                ids.add(int(m.group(1)))
    return ids


def load_tag_type_names():
    path = os.path.join(DBC_DIR, "SpellTagTypes.dbc")
    rc, fc, rs, data, strings = read_dbc(path)
    names = {}
    for i in range(rc):
        row = struct.unpack_from("<" + "I" * fc, data, i * rs)
        tid = row[0]
        best = ""
        for v in row[1:]:
            t = sref(strings, v)
            if not t or len(t) > 64:
                continue
            if t.startswith("SPELL_TAG") or re.match(
                r"^[A-Za-z][A-Za-z0-9 _/\-]{1,40}$", t
            ):
                if t.startswith("SPELL_TAG") or len(t) > len(best):
                    best = t
        names[tid] = best or ("type_%d" % tid)
    return names, (rc, fc, rs, len(strings))


def probe_spell_tags(cat_ids, type_names):
    path = os.path.join(DBC_DIR, "SpellTags.dbc")
    rc, fc, rs, data, _ = read_dbc(path)
    # Layout aus Extract-UI + Stichprobe: id, spellId, tagType
    hist = collections.Counter()
    tagged_spells = set()
    for i in range(rc):
        _rid, spell_id, tag_type = struct.unpack_from("<III", data, i * rs)
        if spell_id in cat_ids:
            hist[tag_type] += 1
            tagged_spells.add(spell_id)
    return {
        "header": (rc, fc, rs),
        "tagged": len(tagged_spells),
        "catalog": len(cat_ids),
        "top": hist.most_common(20),
        "type_names": type_names,
    }


def probe_headers():
    want = [
        "SpellTags.dbc",
        "SpellTagTypes.dbc",
        "SpellDescriptionVariables.dbc",
        "SpellAddon.dbc",
        "SpellCustomAttr.dbc",
        "SpellStatSuggestions.dbc",
        "SpellSpellSuggestions.dbc",
        "SpellEnchantSuggestions.dbc",
        "SpellCharges.dbc",
        "SpellRank.dbc",
    ]
    out = []
    for name in want:
        path = os.path.join(DBC_DIR, name)
        if not os.path.isfile(path):
            out.append((name, None))
            continue
        rc, fc, rs, _data, strings = read_dbc(path)
        out.append((name, (rc, fc, rs, len(strings))))
    return out


def sample_desc_vars():
    path = os.path.join(DBC_DIR, "SpellDescriptionVariables.dbc")
    rc, fc, rs, data, strings = read_dbc(path)
    rows = []
    for i in range(min(rc, 8)):
        vid, off = struct.unpack_from("<II", data, i * rs)
        body = sref(strings, off)
        preview = body.replace("\r", "\\r").replace("\n", "\\n")[:100]
        rows.append((vid, len(body), preview))
    return rc, fc, rs, rows


def sample_stat_suggestions():
    path = os.path.join(DBC_DIR, "SpellStatSuggestions.dbc")
    rc, fc, rs, data, _ = read_dbc(path)
    rows = []
    for i in range(min(rc, 8)):
        rows.append(struct.unpack_from("<IIII", data, i * rs))
    return rc, fc, rs, rows


def mine_lua_methods():
    """Zaehlt C_CharacterAdvancement.*-Aufrufe im Extract; speichert Ersttreffer."""
    if not os.path.isdir(LUA_EXTRACT):
        return {}
    pat = re.compile(r"C_CharacterAdvancement\.([A-Za-z_][A-Za-z0-9_]*)")
    counts = collections.Counter()
    first = {}
    for root, _dirs, files in os.walk(LUA_EXTRACT):
        for fn in files:
            if not fn.endswith(".lua"):
                continue
            path = os.path.join(root, fn)
            try:
                with io.open(path, encoding="utf-8", errors="replace") as fh:
                    for lineno, line in enumerate(fh, 1):
                        for m in pat.finditer(line):
                            name = m.group(1)
                            counts[name] += 1
                            if name not in first:
                                rel = os.path.relpath(path, LUA_EXTRACT)
                                first[name] = (rel.replace("\\", "/"), lineno,
                                               line.strip()[:140])
            except OSError:
                continue
    return {"counts": counts, "first": first}


# Kandidaten fuer "Top 10 noch ungenutzt" — Buildschmiede-relevant, mit Evidence.
TOP10 = [
    (
        "C_CharacterAdvancement.GetSuggestedStats",
        "Liefert vom Client vorgeschlagene PrimaryStats zum aktuellen Build — "
        "passt zur Path-Empfehlung auf der Analyse-Seite.",
        "PATHSUG|statId;… oder Abgleich mit bestehender Path-Heuristik",
    ),
    (
        "C_CharacterAdvancement.GetEntryBySpellID",
        "SpellID → CA-Entry ohne Eigen-Lookup; nuetzlich fuer ECOST/QOWN und "
        "Karten-Aufloesung.",
        "kein neues Exportfeld noetig; robustere Collect-Zuordnung",
    ),
    (
        "C_CharacterAdvancement.GetTabTEInvestment",
        "TE pro Klasse/Tab (Talentbaum) — Levelrun-Struktur statt nur Global-TE.",
        "INVEST|…|TAB:class:spec:n (additiv) oder Analyse-only",
    ),
    (
        "C_CharacterAdvancement.GetExpectedAE",
        "Erwartete AE nach Level — Budget-Plausibilitaet ohne Rate.",
        "ESSENCE|…|EA:expectedAtLevel oder LEVELAE|n",
    ),
    (
        "C_CharacterAdvancement.GetRootSpellTagTypes / GetSpellTagTypes",
        "Offizielle Tag-Hierarchie (CA-Browser); DBC SpellTags ist die "
        "Offline-Spiegelung.",
        "Pipeline: tags.json; Export optional SPELLTAG|id:tag;…",
    ),
    (
        "C_CharacterAdvancement.UnitKnownID / UnitTalentRankByID",
        "Inspect pro Spec ohne nur GetInspectedBuild — feinere Fremd-Exporte.",
        "Inspect-Pfad; FORMAT bleibt 1",
    ),
    (
        "C_CharacterAdvancement.GetActiveChrSpec",
        "CoA/Chr-Spec getrennt von GetActiveSpecID — Spec-Zeile absichern.",
        "SPEC|… ggf. CHR:id additiv",
    ),
    (
        "C_CharacterAdvancement.IsTrait",
        "Draft/Trait-Eintraege markieren (nicht Ability/Talent).",
        "TRAIT|entryId;… oder Flag in ABI",
    ),
    (
        "C_SkillCard.GetSkillCardQuality / IsCardAtIndexActive",
        "Kartenqualitaet + aktiver Slot — ergaenzt SCARD ohne Purchase-APIs.",
        "SCARD-Felder erweitern: …:qN / nur aktive Slots",
    ),
    (
        "C_GameMode.GetActiveGameModes",
        "Bitmaske aller aktiven Modi (nicht nur WildCard-Bool).",
        "MODE|WILDCARD|DRAFT|… aus Enum.GameMode",
    ),
]


def find_evidence(fqname, mined):
    """Evidence aus Mine oder hart verdrahtete Extract-Pfade."""
    hard = {
        "C_CharacterAdvancement.GetSuggestedStats": (
            "Interface/AddOns/Ascension_ForcedPrimaryStat/PrimaryStat.lua",
            108,
            "local topStat, topStats = C_CharacterAdvancement.GetSuggestedStats()",
        ),
        "C_CharacterAdvancement.GetEntryBySpellID": (
            "Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua",
            170,
            "local entry = C_CharacterAdvancement.GetEntryBySpellID(dropdown.spell)",
        ),
        "C_CharacterAdvancement.GetTabTEInvestment": (
            "Interface/AddOns/Ascension_CharacterAdvancement/Templates/CAClassButton.lua",
            70,
            "local spentOnTab = C_CharacterAdvancement.GetTabTEInvestment(class, spec, 0) or 0",
        ),
        "C_CharacterAdvancement.GetExpectedAE": (
            "Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua",
            134,
            "self.expectedAEByLevel[i] = C_CharacterAdvancement.GetExpectedAE(i) or 0",
        ),
        "C_CharacterAdvancement.GetRootSpellTagTypes / GetSpellTagTypes": (
            "Interface/FrameXML/Util/CharacterAdvancementUtil.lua",
            622,
            "local rootTags = C_CharacterAdvancement.GetRootSpellTagTypes()",
        ),
        "C_CharacterAdvancement.UnitKnownID / UnitTalentRankByID": (
            "Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua",
            145,
            "if C_CharacterAdvancement.UnitKnownID(unit, entry.ID, self.activeSpec) then",
        ),
        "C_CharacterAdvancement.GetActiveChrSpec": (
            "Interface/AddOns/Ascension_CoATalents/CoASpecViewMixin.lua",
            26,
            "local activeSpecID = C_CharacterAdvancement.GetActiveChrSpec()",
        ),
        "C_CharacterAdvancement.IsTrait": (
            "Interface/AddOns/Ascension_Draft/DraftCardMixin.lua",
            522,
            "elseif (C_CharacterAdvancement.IsTrait and C_CharacterAdvancement.IsTrait(internalID)) then",
        ),
        "C_SkillCard.GetSkillCardQuality / IsCardAtIndexActive": (
            "Interface/AddOns/Ascension_SkillCards/SkillCard/SkillCard.lua",
            421,
            "local quality = C_SkillCard.GetSkillCardQuality(cardData.CardID, displayedRank) or cardData.Quality",
        ),
        "C_GameMode.GetActiveGameModes": (
            "Interface/FrameXML/Util/C_GameMode.lua",
            27,
            "function C_GameMode:GetActiveGameModes()",
        ),
    }
    if fqname in hard:
        return hard[fqname]
    short = fqname.split(".")[-1].split(" ")[0]
    first = mined.get("first", {})
    if short in first:
        rel, ln, snippet = first[short]
        return (rel, ln, snippet)
    return ("?", 0, "(kein Treffer im Extract — nicht erfinden)")


def render(notes_bits):
    today = datetime.date.today().isoformat()
    lines = []
    a = lines.append
    a("# Ascension API / DBC Notes (Probe)")
    a("")
    a("Generiert von `pipeline/probe_ascension_apis.py` am %s." % today)
    a("Nur aus **bereits extrahierten** Baeumen. Kein Client-Lua im Repo.")
    a("Collect **1.4.0** bleibt unangetastet — Hinweise sind additiv.")
    a("")
    a("## 1. Was „RE“ hier heisst")
    a("")
    a("### Erlaubt (Forschung / Buildschmiede)")
    a("- Lesen der Extract-Baeume unter Documents (Lua / Interface / DBC).")
    a("- Mapping undokumentierter `C_*`-Aufrufe anhand FrameXML-/AddOn-**Aufrufe**.")
    a("- DBC-Header und Feldlayouts messen (records/fields/recordSize/stringblock).")
    a("- Neue Exportzeilen und Pipeline-Schritte **vorschlagen**; Safe/pcall nur in `addon/` / `pipeline/`.")
    a("")
    a("### Hard no")
    a("- Ascension.exe decompilieren, MPQ knacken jenseits der Extracts.")
    a("- Anti-Cheat-Bypass, Memory-Editing, Packet-Injection.")
    a("- Proprietaeres Blizzard-/Ascension-Lua **ins Repo kopieren** (AGENTS.md).")
    a("- APIs erfinden, die im Extract keine Evidence haben.")
    a("")
    a("## 2. Top 10 ungenutzte APIs/Felder (mit Evidence)")
    a("")
    a("Pfad-Basis Evidence: "
      "`AscensionLuaExtract/by-archive/patch-B.MPQ/`.")
    a("")
    for i, (name, why, export) in enumerate(TOP10, 1):
        rel, ln, snip = find_evidence(name, notes_bits["mined"])
        a("### %d. `%s`" % (i, name))
        a("- **Evidence:** `%s:%s`" % (rel, ln))
        a("  - `%s`" % snip.replace("`", "'"))
        a("- **Nutzen:** %s" % why)
        a("- **Export/Pipeline-Idee:** %s" % export)
        a("")
    a("### DBC-Felder (Offline, Pipeline)")
    a("")
    a("| Datei | records | fields | recordSize | stringBlock |")
    a("|---|---:|---:|---:|---:|")
    for name, hdr in notes_bits["headers"]:
        if hdr is None:
            a("| `%s` | missing | | | |" % name)
        else:
            rc, fc, rs, sbs = hdr
            a("| `%s` | %d | %d | %d | %d |" % (name, rc, fc, rs, sbs))
    a("")
    tags = notes_bits["tags"]
    a("**SpellTags ∩ Katalog:** %d / %d Spells haben ≥1 Tag "
      "(Layout `id, spellId, tagType`)."
      % (tags["tagged"], tags["catalog"]))
    a("")
    a("Haeufigste `tagType` auf Katalog-Spells:")
    a("")
    for tid, n in tags["top"]:
        tname = tags["type_names"].get(tid, "?")
        a("- `%s` × %d — %s" % (tid, n, tname))
    a("")
    a("**SpellDescriptionVariables:** %d Eintraege (Tooltip-Variablen `$…`, "
      "kein Schaden erfinden — nur Formeln spiegeln)."
      % notes_bits["desc"][0])
    for vid, length, preview in notes_bits["desc"][3]:
        a("- id=%s len=%s preview=`%s`" % (vid, length, preview))
    a("")
    ss = notes_bits["statsug"]
    a("**SpellStatSuggestions:** rc=%d fc=%d — Stichprobe "
      "`(rowId, spellOrEntry?, stat?, flag?)`:" % (ss[0], ss[1]))
    for row in ss[3]:
        a("- `%s`" % (row,))
    a("")
    a("## 3. Bereits im Addon genutzt (nicht anfassen)")
    a("")
    for u in sorted(USED):
        a("- `%s`" % u)
    a("")
    mined = notes_bits["mined"]
    if mined.get("counts"):
        a("## 4. Extract-Zaehler `C_CharacterAdvancement.*` (Top 25)")
        a("")
        for name, n in mined["counts"].most_common(25):
            mark = " *(bereits genutzt)*" if (
                "C_CharacterAdvancement." + name
            ) in USED else ""
            a("- `%s` × %d%s" % (name, n, mark))
        a("")
    a("## 5. Naechste sichere Schritte (ohne Collect-Umbau)")
    a("")
    a("1. Optional: `tags.json` aus SpellTags∩Katalog (wie `pathtags.py`).")
    a("2. Collect-Kommentarblock fuer Safe-Kandidaten (GetSuggestedStats, "
      "GetExpectedAE, GetActiveGameModes) — erst implementieren nach Live-pcall.")
    a("3. SkillCards: Quality/Active nur lesen, kein Set/Purchase.")
    a("4. FORMAT bleibt **1**; neue Zeilen additiv.")
    a("")
    a("---")
    a("Ende der Probe-Ausgabe.")
    a("")
    return "\n".join(lines)


def main():
    if not os.path.isdir(DBC_DIR):
        raise SystemExit("DBC_DIR fehlt: %s" % DBC_DIR)
    type_names, _tt_hdr = load_tag_type_names()
    cat = catalog_spell_ids()
    tags = probe_spell_tags(cat, type_names)
    bits = {
        "headers": probe_headers(),
        "tags": tags,
        "desc": sample_desc_vars(),
        "statsug": sample_stat_suggestions(),
        "mined": mine_lua_methods(),
    }
    text = render(bits)
    with io.open(NOTES, "w", encoding="utf-8", newline="\n") as fh:
        fh.write(text)
    print("Wrote", NOTES)
    print("catalog", len(cat), "tagged", tags["tagged"],
          "CA methods mined", len(bits["mined"].get("counts", {})))


if __name__ == "__main__":
    main()
