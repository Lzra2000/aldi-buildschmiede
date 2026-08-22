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
  ap     Prozent Attack Power
  sp     Prozent Spell Power
  heal   [min, max] Grundheilung
  inc    [[Prozent, worauf], ...]         "increases X by N%"
  red    [[Prozent, worauf], ...]         "reduces X by N%"
  proc   Prozent Proc-Chance
  stk    maximale Stapel
  cd     Cooldown in Sekunden
"""
import io
import json
import os
import re

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")

SCHOOL = (r"(?:Fire|Frost|Nature|Shadow|Arcane|Holy|Physical|Bleed|Radiant|"
          r"Void|Spellfire|Frostfire|Shadowflame|Astral|Storm|Lightning|Chaos)")

RX_WEAPON = re.compile(
    r"(\d+(?:\.\d+)?)\s*%\s*(?:of\s+(?:your\s+)?)?"
    r"(main[-\s]?hand|off[-\s]?hand|ranged|total)?\s*weapon\s+damage"
    r"(?:\s+as\s+(" + SCHOOL + r"))?", re.I)

RX_FLAT = re.compile(r"(\d[\d,]*)\s+to\s+(\d[\d,]*)\s+(" + SCHOOL + r")?\s*damage", re.I)
RX_FLAT1 = re.compile(r"(?:causing|dealing|deals|for)\s+(\d[\d,]*)\s+(" + SCHOOL + r")\s+damage", re.I)
RX_HEAL = re.compile(r"heal(?:s|ing)?\s+[^.]{0,40}?for\s+(\d[\d,]*)(?:\s+to\s+(\d[\d,]*))?", re.I)
RX_DOT = re.compile(r"over\s+(\d+)\s*sec", re.I)
RX_TICK = re.compile(r"(\d[\d,]*)\s+(?:" + SCHOOL + r"\s+)?damage\s+every\s+(?:(\d+)\s+)?sec", re.I)
RX_AP = re.compile(r"(\d+(?:\.\d+)?)\s*%\s+of\s+(?:your\s+)?attack\s+power", re.I)
RX_SP = re.compile(r"(\d+(?:\.\d+)?)\s*%\s+of\s+(?:your\s+)?spell\s+(?:power|damage)", re.I)
RX_PROC = re.compile(r"(\d+(?:\.\d+)?)\s*%\s+chance", re.I)
RX_STK = re.compile(r"(?:stack(?:s|ing)?\s+up\s+to|up\s+to)\s+(\d+)\s*(?:times|stacks)?", re.I)
RX_CD = re.compile(r"(\d+)\s*(sec|min)[a-z]*\s+cooldown", re.I)

RX_INC = re.compile(
    r"[Ii]ncreas(?:es|ing)\s+(?:the\s+)?(?:your\s+)?(.{2,46}?)\s+by\s+(\d+(?:\.\d+)?)\s*%")
RX_RED = re.compile(
    r"[Rr]educ(?:es|ing)\s+(?:the\s+)?(?:your\s+)?(.{2,46}?)\s+by\s+(\d+(?:\.\d+)?)\s*%")

# Ressourcen, die eine Faehigkeit EINBRINGT. Die DBC kennt nur die Kosten;
# was etwas zurueckgibt, steht ausschliesslich im Beschreibungstext.
RES_DE = {"rage": "Wut", "energy": "Energie", "mana": "Mana",
          "focus": "Fokus", "runic power": "Runenmacht"}
RX_GEN = re.compile(
    r"(?:generat\w*|restor\w*|grant\w*(?:\s+you)?|gain\w*|award\w*)"
    r"\s+(\d+)\s+(rage|energy|mana|focus|runic power)", re.I)
# Prozentuale Manarueckgabe wird als negative Zahl abgelegt, damit die
# Seite sie als Prozent statt als Punkte anzeigen kann.
RX_GENPCT = re.compile(
    r"(\d+)\s*%\s+of\s+(?:your\s+)?(?:total\s+|base\s+)?mana", re.I)

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
    ("dmg", re.compile(r"damage|attack power|spell power|critical|crit|"
                       r"haste|attack speed|" + SCHOOL, re.I)),
    ("heal", re.compile(r"heal|healing power|absorb|shield", re.I)),
    ("stat", re.compile(r"strength|agility|intellect|spirit|stamina|"
                        r"all attributes|armor", re.I)),
]


def kindOf(what):
    for name, rx in KIND:
        if rx.search(what):
            return name
    return "misc"


def num(s):
    return int(str(s).replace(",", ""))


def tidy(s):
    s = re.sub(r"\s+", " ", s).strip(" ,.;")
    # fuehrende Fuellwoerter weg
    s = re.sub(r"^(?:amount|effect|effectiveness|total)\s+(?:of\s+)?", "", s, flags=re.I)
    return s


def extract(desc):
    d = desc or ""
    o = {}

    m = RX_WEAPON.search(d)
    if m:
        o["w"] = float(m.group(1))
        hand = (m.group(2) or "any").lower().replace(" ", "").replace("-", "")
        o["wh"] = {"mainhand": "mh", "offhand": "oh", "ranged": "ranged",
                   "total": "any", "any": "any"}.get(hand, "any")
        if m.group(3):
            o["sch"] = m.group(3).title()

    m = RX_FLAT.search(d)
    if m:
        o["flat"] = [num(m.group(1)), num(m.group(2))]
        if m.group(3):
            o["fsch"] = m.group(3).title()
    else:
        m = RX_FLAT1.search(d)
        if m:
            o["flat"] = [num(m.group(1)), num(m.group(1))]
            o["fsch"] = m.group(2).title()

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
    if m:
        o["ap"] = float(m.group(1))
    m = RX_SP.search(d)
    if m:
        o["sp"] = float(m.group(1))

    m = RX_PROC.search(d)
    if m:
        o["proc"] = float(m.group(1))
    m = RX_STK.search(d)
    if m:
        o["stk"] = int(m.group(1))
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
    m = RX_GENPCT.search(d)
    if m:
        gen.append([-int(m.group(1)), "Mana"])
    if gen:
        o["gen"] = gen[:3]

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
