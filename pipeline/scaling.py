# -*- coding: utf-8 -*-
"""Zieht die tatsaechlichen Skalierungszahlen aus den Tooltip-Texten.

Die Beschreibungen im Katalog sind die einzige belastbare Quelle fuer
Koeffizienten - sie stehen woertlich so im Spiel. Was nicht im Text steht
(zum Beispiel der Spell-Power-Anteil eines Flat-Damage-Zaubers), wird hier
auch NICHT geraten; die Seite sagt dann ehrlich, dass die Zahl fehlt.

Ausgabe scaling.json: pro Katalogindex ein Objekt, leere Felder weggelassen.

  w      Prozent Waffenschaden            150  -> "150% weapon damage"
  wh     welche Waffe                     mh | oh | ranged | any
  sch    Schadensschule des Angriffs      "Fire"
  flat   [min, max] Grundschaden
  fsch   Schule des Grundschadens
  dot    Dauer in Sekunden
  tick   Schaden pro Sekunde (falls genannt)
  ap     Prozent Attack Power (Schadens-/Heilkoeffizient)
  apb    1 wenn Tooltip "based on attack power" ohne Prozent nennt
  sp     Prozent Spell Power (Schadenskoeffizient)
  spb    1 wenn Tooltip Spell-Power-Skalierung ohne Prozent nennt
  heal   [min, max] Grundheilung
  inc    [[Prozent, worauf], ...]         "increases X by N%"
  red    [[Prozent, worauf], ...]         "reduces X by N%"
  proc   Prozent Proc-Chance
  stk    maximale Stapel
  cd     Cooldown in Sekunden
  gen    [[Menge, Ressource], ...]        negative Menge = Prozent
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")

# Schulen aus Katalog-Tooltips, inkl. Ascension-Mischformen (*strike, *storm).
# "Pysical" ist ein Tippfehler im Katalog und wird auf Physical normalisiert.
SCHOOL = (
    r"(?:Fire|Frost|Nature|Shadow|Arcane|Holy|Physical|Pysical|Bleed|Radiant|"
    r"Void|Spellfire|Frostfire|Shadowflame|Shadowfrost|Astral|Storm|Lightning|"
    r"Chaos|Spellstorm|Firestorm|Plague|Divine|Elemental|Twilight|Chromatic|"
    r"Holyfrost|Holyfire|Holyflame|Spellshadow|"
    r"Firestrike|Froststrike|Stormstrike|Shadowstrike|Holystrike|"
    r"Spellstrike|Arcanestrike)"
)

# "75% of your normal weapon damage", "30% Nature weapon damage",
# "100% armor-piercing weapon damage", "150% weapon damage as Fire"
RX_WEAPON = re.compile(
    r"(\d+(?:\.\d+)?)\s*%\s*"
    r"(?:of\s+(?:your\s+)?)?"
    r"(?:normal\s+)?"
    r"(?:armor[-\s]?piercing\s+|extra\s+)?"
    r"(main[-\s]?hand|off[-\s]?hand|ranged|melee|total|combined)?"
    r"\s*"
    r"(" + SCHOOL + r")?"
    r"\s*"
    r"weapon'?s?\s+(?:average\s+)?"
    r"(?:(" + SCHOOL + r")\s+)?"
    r"damage"
    r"(?:\s+as\s+(" + SCHOOL + r")(?:\s+damage)?)?",
    re.I)

RX_FLAT = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s+to\s+(\d[\d,]*(?:\.\d+)?)\s+(" + SCHOOL + r")?\s*damage",
    re.I)
# Finishing moves / ältere Texte: "28-32 damage", "94 Spellstrike damage over"
RX_FLAT_HYPHEN = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s*-\s*(\d[\d,]*(?:\.\d+)?)\s+(" + SCHOOL + r")?\s*damage",
    re.I)
RX_FLAT1 = re.compile(
    r"(?:causing|causes|dealing|deals|deal|inflict(?:s|ing)?|for)\s+"
    r"(\d[\d,]*(?:\.\d+)?)\s+(?:(" + SCHOOL + r")\s+)?damage",
    re.I)
# "1 point: 121 damage over 12 sec" / "94 Spellstrike damage over 12 sec"
RX_FLAT_OVER = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s+(?:(" + SCHOOL + r")\s+)?damage\s+over\s+\d+",
    re.I)
# "plus 83 Firestrike damage" / "24 additional Holy damage"
RX_FLAT_PLUS = re.compile(
    r"(?:plus|additional)\s+(\d[\d,]*(?:\.\d+)?)\s+(?:(" + SCHOOL + r")\s+)?damage",
    re.I)
RX_HEAL = re.compile(
    r"heal(?:s|ing)?\s+[^.]{0,80}?for\s+(\d[\d,]*(?:\.\d+)?)"
    r"(?:\s+to\s+(\d[\d,]*(?:\.\d+)?))?",
    re.I)
RX_DOT = re.compile(r"over\s+(\d+)\s*sec", re.I)
RX_TICK = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s+(?:" + SCHOOL + r"\s+)?damage\s+every\s+(?:(\d+)\s+)?sec",
    re.I)
RX_AP = re.compile(r"(\d+(?:\.\d+)?)\s*%\s+of\s+(?:your\s+)?attack\s+power", re.I)
RX_SP = re.compile(r"(\d+(?:\.\d+)?)\s*%\s+of\s+(?:your\s+)?spell\s+(?:power|damage)", re.I)
RX_APB = re.compile(
    r"(?:based on|increased by|scales with)\s+(?:your\s+)?"
    r"(?:ranged\s+|melee\s+)?attack\s+power",
    re.I)
RX_SPB = re.compile(
    r"(?:based on|increased by|scales with|scaling with)\s+(?:your\s+)?"
    r"(?:healing\s+)?spell\s+(?:power|damage)"
    r"|spell\s+power\s+increases",
    re.I)
RX_PROC = re.compile(r"(\d+(?:\.\d+)?)\s*%\s+chance", re.I)
# Nur echte Stapel, nicht "up to 5 nearby enemies".
RX_STK = re.compile(
    r"(?:stacks?|stacking)\s+up\s+to\s+(\d+)\s*(?:times|stacks)?|"
    r"up\s+to\s+(\d+)\s*(?:times|stacks)\b",
    re.I)
RX_CD = re.compile(r"(\d+)\s*(sec|min)[a-z]*\s+cooldown", re.I)

RX_INC = re.compile(
    r"[Ii]ncreas(?:es|ing|e)\s+(?:the\s+)?(?:your\s+)?(.{2,60}?)\s+by\s+(\d+(?:\.\d+)?)\s*%")
RX_RED = re.compile(
    r"[Rr]educ(?:es|ing|e)\s+(?:the\s+)?(?:your\s+)?(.{2,60}?)\s+by\s+(\d+(?:\.\d+)?)\s*%")

# Ressourcen, die eine Faehigkeit EINBRINGT. Die DBC kennt nur die Kosten;
# was etwas zurueckgibt, steht ausschliesslich im Beschreibungstext.
RES_DE = {"rage": "Wut", "energy": "Energie", "mana": "Mana",
          "focus": "Fokus", "runic power": "Runenmacht"}
# "generates an additional 10 rage", "gain an additional 5 Rage"
RX_GEN = re.compile(
    r"(?:generat\w*|restor\w*|regenerat\w*|grant\w*(?:\s+you)?|gain\w*|award\w*|regain\w*)"
    r"(?:\s+(?:an?\s+)?(?:additional|extra|instantly))?"
    r"\s+(\d+)\s+(rage|energy|mana|focus|runic power)", re.I)
RX_GEN_RANGE = re.compile(
    r"(?:restor\w*|regenerat\w*)\s+(\d+)\s+to\s+(\d+)\s+"
    r"(rage|energy|mana|focus|runic power)", re.I)
# Prozentuale Manarueckgabe wird als negative Zahl abgelegt, damit die
# Seite sie als Prozent statt als Punkte anzeigen kann.
RX_GENPCT = re.compile(
    r"(?:regenerat\w*|restor\w*|regain\w*|gain\w*|grant\w*)"
    r"[^.]{0,48}?"
    r"(\d+)\s*%\s+"
    r"(?:of\s+(?:your\s+)?)?"
    r"(?:missing\s+|total\s+|base\s+|maximum\s+|max\s+)?"
    r"mana", re.I)

# Formulierungen, die zwar "increases ... by N%" sind, aber nichts mit
# Schaden oder Heilung zu tun haben. Die aus der Multiplikatorliste halten.
NOISE = re.compile(
    r"movement speed|run speed|threat|duration|range|radius|mana cost|"
    r"cooldown|chance to (?:be )?(?:hit|dodge|parry|block|resist)|"
    r"armor contribution|number of charges|size", re.I)


# Ein Multiplikator ist nicht gleich Multiplikator: +6% Stamina und
# +10% Physical damage stehen im selben Satzmuster, wirken aber voellig
# verschieden. Die Seite trennt das, damit die Schadensliste sauber bleibt.
KIND = [
    ("dmg", re.compile(r"damage|attack power|spell power|critical|crit\b|"
                       r"haste|attack speed|" + SCHOOL, re.I)),
    ("heal", re.compile(r"heal|healing power|absorb|shield", re.I)),
    ("stat", re.compile(r"strength|agility|intellect|spirit|stamina|"
                        r"all attributes|armor\b", re.I)),
]


def kindOf(what):
    for name, rx in KIND:
        if rx.search(what):
            return name
    return "misc"


def num(s):
    s = str(s).replace(",", "")
    if "." in s:
        f = float(s)
        return int(f) if f == int(f) else f
    return int(s)


def school_name(s):
    if not s:
        return None
    s = s.title()
    if s == "Pysical":
        return "Physical"
    return s


def tidy(s):
    s = re.sub(r"\s+", " ", s).strip(" ,.;")
    # fuehrende Fuellwoerter weg
    s = re.sub(r"^(?:amount|effect|effectiveness|total)\s+(?:of\s+)?", "", s, flags=re.I)
    return s


def _pct_is_conversion(desc, match):
    """True bei 'X by N% of AP/SP' — das ist Umrechnung, kein Trefferkoeffizient."""
    prev = desc[max(0, match.start() - 8):match.start()]
    return bool(re.search(r"\bby\s*$", prev, re.I))


def extract(desc):
    d = desc or ""
    o = {}

    m = RX_WEAPON.search(d)
    if m:
        o["w"] = float(m.group(1))
        hand = (m.group(2) or "any").lower().replace(" ", "").replace("-", "")
        o["wh"] = {"mainhand": "mh", "offhand": "oh", "ranged": "ranged",
                   "melee": "any", "combined": "any",
                   "total": "any", "any": "any"}.get(hand, "any")
        sch = school_name(m.group(3) or m.group(4) or m.group(5))
        if sch:
            o["sch"] = sch

    m = RX_FLAT.search(d)
    if m:
        o["flat"] = [num(m.group(1)), num(m.group(2))]
        sch = school_name(m.group(3))
        if sch:
            o["fsch"] = sch
    else:
        m = RX_FLAT_HYPHEN.search(d)
        if m:
            o["flat"] = [num(m.group(1)), num(m.group(2))]
            sch = school_name(m.group(3))
            if sch:
                o["fsch"] = sch
        else:
            m = RX_FLAT1.search(d)
            if m:
                o["flat"] = [num(m.group(1)), num(m.group(1))]
                sch = school_name(m.group(2))
                if sch:
                    o["fsch"] = sch
            else:
                m = RX_FLAT_OVER.search(d)
                if m:
                    o["flat"] = [num(m.group(1)), num(m.group(1))]
                    sch = school_name(m.group(2))
                    if sch:
                        o["fsch"] = sch
                else:
                    m = RX_FLAT_PLUS.search(d)
                    if m:
                        o["flat"] = [num(m.group(1)), num(m.group(1))]
                        sch = school_name(m.group(2))
                        if sch:
                            o["fsch"] = sch

    m = RX_HEAL.search(d)
    if m:
        lo = num(m.group(1))
        hi = num(m.group(2)) if m.group(2) else lo
        o["heal"] = [lo, hi]

    m = RX_DOT.search(d)
    if m:
        o["dot"] = int(m.group(1))

    m = RX_TICK.search(d)
    if m:
        o["tick"] = num(m.group(1))

    m = RX_AP.search(d)
    if m and not _pct_is_conversion(d, m):
        ctx = d[max(0, m.start() - 50):m.end() + 15]
        # Mana ueber AP ist kein Schadenskoeffizient (z.B. Shamanistic Rage).
        if not (re.search(r"mana|regenerat", ctx, re.I)
                and not re.search(r"damage|healing power", ctx, re.I)):
            o["ap"] = float(m.group(1))
    elif RX_APB.search(d):
        o["apb"] = 1

    m = RX_SP.search(d)
    if m and not _pct_is_conversion(d, m):
        ctx = d[max(0, m.start() - 40):m.end() + 20]
        # "absorbs an additional N% of spell damage" ist kein SP-Koeffizient.
        if not re.search(r"absorb", ctx, re.I):
            o["sp"] = float(m.group(1))
    elif "sp" not in o and RX_SPB.search(d):
        o["spb"] = 1

    m = RX_PROC.search(d)
    if m:
        o["proc"] = float(m.group(1))
    m = RX_STK.search(d)
    if m:
        o["stk"] = int(next(g for g in m.groups() if g))
    m = RX_CD.search(d)
    if m:
        o["cd"] = int(m.group(1)) * (60 if m.group(2).lower() == "min" else 1)

    inc = []
    for what, pct in RX_INC.findall(d):
        what = tidy(what)
        if what and not NOISE.search(what):
            inc.append([float(pct), what, kindOf(what)])
    if inc:
        o["inc"] = inc[:4]

    gen = []
    for amount, res in RX_GEN.findall(d):
        key = RES_DE.get(res.lower())
        if key:
            gen.append([int(amount), key])
    for lo, hi, res in RX_GEN_RANGE.findall(d):
        key = RES_DE.get(res.lower())
        if key:
            gen.append([(int(lo) + int(hi)) // 2, key])
    for pct in RX_GENPCT.findall(d):
        gen.append([-int(pct), "Mana"])
    if gen:
        # doppelte Mana-%-Treffer zusammenfassen
        seen = set()
        uniq = []
        for g in gen:
            t = (g[0], g[1])
            if t not in seen:
                seen.add(t)
                uniq.append(g)
        o["gen"] = uniq[:3]

    red = []
    for what, pct in RX_RED.findall(d):
        what = tidy(what)
        if what and not NOISE.search(what):
            red.append([float(pct), what, kindOf(what)])
    if red:
        o["red"] = red[:3]

    return o


def main():
    cat = json.load(io.open(os.path.join(DATA, "catalog.json"), encoding="utf-8"))
    out = [extract(r[5]) for r in cat]

    io.open(os.path.join(DATA, "scaling.json"), "w", encoding="utf-8").write(
        json.dumps(out, separators=(",", ":"))
    )

    keys = {}
    for o in out:
        for k in o:
            keys[k] = keys.get(k, 0) + 1
    print("Eintraege gesamt:", len(out))
    print("mit irgendeiner Skalierung:", sum(1 for o in out if o))
    for k in sorted(keys, key=lambda x: -keys[x]):
        print("  %-6s %5d" % (k, keys[k]))

    print("\nStichproben Waffenskalierung:")
    n = 0
    for i, o in enumerate(out):
        if "w" in o and n < 6:
            print("   %-22s %5.0f%% %-7s %s" % (cat[i][0][:22], o["w"],
                                                o.get("wh", ""), o.get("sch", "physisch")))
            n += 1
    print("\nStichproben Multiplikatoren:")
    n = 0
    for i, o in enumerate(out):
        if "inc" in o and n < 8:
            print("   %-24s %s" % (cat[i][0][:24],
                                   "; ".join("+%g%% %s [%s]" % (p, w, k) for p, w, k in o["inc"])))
            n += 1


if __name__ == "__main__":
    main()
