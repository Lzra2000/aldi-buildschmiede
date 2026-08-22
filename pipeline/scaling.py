# -*- coding: utf-8 -*-
"""Zieht die tatsaechlichen Skalierungszahlen aus den Tooltip-Texten.

Die Beschreibungen im Katalog sind die einzige belastbare Quelle fuer
Koeffizienten - sie stehen woertlich so im Spiel. Was nicht im Text steht
(zum Beispiel der Spell-Power-Anteil eines Flat-Damage-Zaubers), wird hier
auch NICHT geraten; die Seite sagt dann ehrlich, dass die Zahl fehlt.

Ausgabe scaling.json: pro Katalogindex ein Objekt, leere Felder weggelassen.

  w      Prozent Waffenschaden            150  -> "150% weapon damage"
         auch bare "weapon damage" / "weapon damage plus N" (= 100%)
  wh     welche Waffe                     mh | oh | ranged | any
  sch    Schadensschule des Angriffs      "Fire"
  flat   [min, max] Grundschaden
         inkl. "N to M additional", "armor-piercing", CP-Finisher,
         "N plus M over T" (nur Sofortanteil N)
  fsch   Schule des Grundschadens
  dot    Dauer in Sekunden
  tick   Schaden pro Sekunde (falls genannt)
  ap     Prozent Attack Power (Schadens-/Heilkoeffizient)
         aus Tooltip-Text ODER Spell.dbc-Formel ($AP*0.24 → 24)
  apb    1 wenn Tooltip "based on attack power" ohne Prozent nennt
  sp     Prozent Spell Power (Schadenskoeffizient)
         aus Tooltip-Text ODER Spell.dbc-Formel ($SP*0.24 → 24)
  spb    1 wenn Tooltip Spell-Power-Skalierung ohne Prozent nennt
  heal   [min, max] Grundheilung
         inkl. "restore N health", "healing an additional N"
  healpct Prozent Heilung von Max-Leben   4 -> "healed for 4% of maximum health"
  absorb [min, max] Schildstaerke         "absorbing 347 damage", "Absorbs 165 Fire damage"
  asch   Schule des Absorbs (Ward), sonst weggelassen
  echo   [Prozent, Schule]                50% of damage dealt as Holy
  relpct Prozent vom Schaden eines anderen Spells (Conflagrate)
  relsrc Tooltip-Fragment der Bezugsfaehigkeit
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
# Laengere Namen zuerst (Shadowstrike vor Shadow), sonst greift der Prefix.
# "Pysical" ist ein Tippfehler im Katalog und wird auf Physical normalisiert.
SCHOOL = (
    r"(?:Spellfire|Frostfire|Shadowflame|Shadowfrost|Spellstorm|Firestorm|"
    r"Holyfrost|Holyfire|Holyflame|Spellshadow|"
    r"Firestrike|Froststrike|Stormstrike|Shadowstrike|Holystrike|"
    r"Spellstrike|Arcanestrike|"
    r"Fire|Frost|Nature|Shadow|Arcane|Holy|Physical|Pysical|Bleed|Radiant|"
    r"Void|Astral|Storm|Lightning|Chaos|Plague|Divine|Elemental|Twilight|"
    r"Chromatic)"
)

# "75% of your normal weapon damage", "30% Nature weapon damage",
# "100% armor-piercing weapon damage", "150% weapon damage as Fire"
# "damag" = bekannter Katalog-Tippfehler (Whirlwind).
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
    r"damag(?:e)?"
    r"(?:\s+as\s+(" + SCHOOL + r")(?:\s+damage)?)?",
    re.I)

# Bare "weapon damage" / "weapon damage plus N [as School]" ohne fuehrendes %.
# Im Tooltip = 100% Waffenanteil (WoW-Konvention), kein erfundener SP/AP.
RX_WEAPON_BARE = re.compile(
    r"(?:dealing|deals|deal|causing|causes|does)\s+"
    r"(?:your\s+)?"
    r"(main[-\s]?hand|off[-\s]?hand|ranged|melee)?"
    r"\s*"
    r"(" + SCHOOL + r")?"
    r"\s*"
    r"weapon'?s?\s+damag(?:e)?"
    r"(?:\s+plus\s+(\d[\d,]*(?:\.\d+)?))?"
    r"(?:\s+as\s+(" + SCHOOL + r")(?:\s+damage)?)?",
    re.I)

# Offhand-Schlag ohne "% weapon damage": Shiv, Single-Minded Fury, Threat of Thassarian.
# Tooltip meint einen vollen OH-Waffenschlag (= 100%), kein SP/AP-Koeffizient.
RX_WEAPON_OH = re.compile(
    r"(?:additional|extra)\s+attack\s+with\s+(?:your\s+)?off[-\s]?hand\s+weapon"
    r"|(?:instant\s+)?off[-\s]?hand\s+weapon\s+attack"
    r"|strike(?:s)?\s+with\s+(?:your\s+)?off[-\s]?hand\s+weapon"
    r"|also\s+strike\s+with\s+(?:your\s+)?off[-\s]?hand(?:\s+weapon)?",
    re.I)

# "two extra attacks" / "3 extra attacks" = N × 100% Waffenanteil (Windfury).
# Zahlwort oder Ziffer; kein AP-% erfinden (auch wenn "N extra attack power" folgt).
_WORD_N = {"two": 2, "three": 3, "four": 4, "five": 5, "six": 6}
RX_EXTRA_ATTACKS = re.compile(
    r"(?:damage\s+equal\s+to\s+|dealing\s+)?"
    r"(two|three|four|five|six|\d+)\s+extra\s+attacks?\b",
    re.I)

RX_FLAT = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s+to\s+(\d[\d,]*(?:\.\d+)?)\s+"
    r"(?:additional\s+)?"
    r"(?:armor[-\s]?piercing\s+)?"
    r"(" + SCHOOL + r")?\s*damage",
    re.I)
# Finishing moves / ältere Texte: "28-32 damage", "94 Spellstrike damage over"
RX_FLAT_HYPHEN = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s*-\s*(\d[\d,]*(?:\.\d+)?)\s+"
    r"(?:additional\s+)?"
    r"(?:armor[-\s]?piercing\s+)?"
    r"(" + SCHOOL + r")?\s*damage",
    re.I)
RX_FLAT1 = re.compile(
    r"(?:causing|causes|dealing|deals|deal|inflict(?:s|ing)?|for)\s+"
    r"(\d[\d,]*(?:\.\d+)?)\s+"
    r"(?:(?:additional|armor[-\s]?piercing)\s+)*"
    r"(?:(" + SCHOOL + r")\s+)?damage",
    re.I)
# "1 point: 121 damage over 12 sec" / "94 Spellstrike damage over 12 sec"
RX_FLAT_OVER = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s+(?:additional\s+)?(?:(" + SCHOOL + r")\s+)?damage\s+over\s+\d+",
    re.I)
# "plus 83 Firestrike damage" / "24 additional Holy damage"
RX_FLAT_PLUS = re.compile(
    r"(?:plus|additional)\s+(\d[\d,]*(?:\.\d+)?)\s+(?:(" + SCHOOL + r")\s+)?damage",
    re.I)
# "405 plus 239 over 6 seconds Shadow damage" — nur der Sofortanteil als flat
RX_FLAT_PLUS_OVER = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s+plus\s+(\d[\d,]*(?:\.\d+)?)\s+over\s+(\d+)\s*"
    r"(?:sec(?:onds?)?)?\s*(" + SCHOOL + r")?\s*damage",
    re.I)
# "24 additional Holy damage" / "granting ... 24 additional Holy damage"
RX_FLAT_ADDITIONAL = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s+additional\s+(?:(" + SCHOOL + r")\s+)?damage",
    re.I)
# "increases melee damage by 18" (ohne %) — Flat-Bonus, kein Koeffizient
RX_FLAT_MELEE_BONUS = re.compile(
    r"increases?\s+melee\s+damage\s+by\s+(\d[\d,]*(?:\.\d+)?)(?!\s*%)",
    re.I)
# Finishing moves: "5 points: 437 damage" — hoechster genannter CP-Wert
RX_CP_FLAT = re.compile(
    r"(\d)\s+points?\s*:\s*(\d[\d,]*(?:\.\d+)?)\s+damage",
    re.I)
RX_HEAL = re.compile(
    r"heal(?:s|ing)?\s+[^.]{0,80}?for\s+(\d[\d,]*(?:\.\d+)?)"
    r"(?:\s+to\s+(\d[\d,]*(?:\.\d+)?))?",
    re.I)
# "healing an additional 64" / "triggers a 261 heal"
RX_HEAL_ADD = re.compile(
    r"heal(?:s|ing)?\s+(?:an?\s+)?additional\s+(\d[\d,]*(?:\.\d+)?)"
    r"|(\d[\d,]*(?:\.\d+)?)\s+heal(?:s|ing)?\b",
    re.I)
# "instantly restore 100 health" / "Restore 200 health"
RX_HEAL_RESTORE = re.compile(
    r"(?:restor(?:es?|ing)|recover(?:s|ing)?)\s+(\d[\d,]*(?:\.\d+)?)"
    r"(?:\s+to\s+(\d[\d,]*(?:\.\d+)?))?\s+(?:health|hit\s+points?)",
    re.I)
# "healed for 4% of its maximum health" — Prozent Max-Leben, kein Flat/SP
RX_HEAL_PCT = re.compile(
    r"(?:heal(?:ed|s|ing)?\s+(?:for\s+)?|(?:for\s+)?an?\s+amount\s+equal\s+(?:of|to)\s+)"
    r"(\d+(?:\.\d+)?)\s*%\s+of\s+"
    r"(?:its|their|your|the\s+target'?s?|maximum)\s+"
    r"(?:maximum\s+|max\s+)?(?:health|hit\s+points?)",
    re.I)
# Flat-Absorb aus Tooltip. Nicht: "absorbing 75% of the damage" (Prozent).
# "spell damage" = unspezifische Ward-Schule (Anti-Magic Zone).
RX_ABSORB = re.compile(
    r"absorb(?:s|ing)\s+(?:up\s+to\s+)?(\d[\d,]*(?:\.\d+)?)\s+"
    r"(?:(" + SCHOOL + r"|[Ss]pell)\s+)?damage\b",
    re.I)
# Echo / Relativ / Bleed / Flat-plus — kein SP/AP erfinden
RX_ECHO = re.compile(
    r"(?:additional\s+)?(\d+(?:\.\d+)?)\s*%\s+of\s+(?:the\s+)?"
    r"damage\s+dealt\s+as\s+(" + SCHOOL + r")",
    re.I)
RX_ECHO_BARE = re.compile(
    r"dealing\s+additional\s+(\d+(?:\.\d+)?)\s*%\s+damage\b",
    re.I)
RX_RELPCT = re.compile(
    r"damage\s+equal\s+to\s+(\d+(?:\.\d+)?)\s*%\s+of\s+(?:your\s+)?"
    r"([A-Za-z][A-Za-z0-9'\-]+(?:\s+or\s+[A-Za-z][A-Za-z0-9'\-]+)?)"
    r"(?!s?\s+health)"
    r"(?=\s*(?:,|\.|$| and |, and| over |, and causes))",
    re.I)
RX_BLEED_VULN = re.compile(
    r"take\s+(\d+(?:\.\d+)?)\s*%\s+additional\s+damage\s+from\s+"
    r"(bleeds?|bleed effects?|periodic(?:\s+damage)?)",
    re.I)
RX_FLAT_PLUS_BARE = re.compile(
    r"(?:damage|block\s+value)\s+plus\s+(?:an\s+)?additional\s+"
    r"(\d[\d,]*(?:\.\d+)?)(?!\s*%)",
    re.I)
RX_DOT = re.compile(r"over\s+(\d+)\s*sec", re.I)
RX_TICK = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s+(?:" + SCHOOL + r"\s+)?damage\s+every\s+(?:(\d+)\s+)?sec",
    re.I)
# DoT-Gesamtschaden ohne Sofortanteil: "N School damage over T sec"
# (RX_FLAT_OVER setzt flat; Tick nur wenn "every" genannt — sonst kein Tick erfinden)
RX_DOT_TOTAL = re.compile(
    r"(\d[\d,]*(?:\.\d+)?)\s+(?:(" + SCHOOL + r")\s+)?damage\s+over\s+(\d+)\s*sec",
    re.I)
RX_AP = re.compile(
    r"(\d+(?:\.\d+)?)\s*%\s+of\s+(?:your\s+)?"
    r"(?:ranged\s+|melee\s+)?attack\s+power",
    re.I)
RX_SP = re.compile(
    r"(\d+(?:\.\d+)?)\s*%\s+of\s+(?:your\s+)?"
    r"(?:bonus\s+)?(?:healing\s+)?spell\s+(?:power|damage)",
    re.I)
# "increased by 33% of the higher of your attack power or spell power" (Gargoyle).
# Beide Prozente gemessen — max(AP, SP), kein erfundenes Verhältnis.
RX_AP_OR_SP = re.compile(
    r"(\d+(?:\.\d+)?)\s*%\s+of\s+the\s+higher\s+of\s+your\s+"
    r"(?:attack\s+power\s+or\s+spell\s+power|"
    r"spell\s+power\s+or\s+attack\s+power)",
    re.I)
RX_APB = re.compile(
    r"(?:based on|increased by|scales with)\s+(?:your\s+)?"
    r"(?:ranged\s+|melee\s+)?attack\s+power"
    r"|damage\s+is\s+based\s+on\s+(?:your\s+)?attack\s+power"
    r"|increased\s+by\s+(?:your\s+)?attack\s+power"
    r"|scales\s+with\s+(?:ranged\s+)?attack\s+power",
    re.I)
RX_SPB = re.compile(
    r"(?:based on|increased by|scales with|scaling with)\s+(?:your\s+)?"
    r"(?:healing\s+)?spell\s+(?:power|damage)"
    r"|spell\s+power\s+increases"
    r"|(?:damage|healing)\s+gained\s+from\s+spell\s+power"
    r"|gained\s+from\s+spell\s+power"
    r"|scales\s+with\s+healing\s+power"
    r"|increased\s+by\s+healing\s+power"
    r"|heal(?:s|ing)?\s+(?:you\s+)?based\s+on\s+(?:your\s+)?spell\s+damage",
    re.I)

# DBC-Tooltip-Formeln ($SP*0.24) → 24 %% SP. Nur lesen, nie erfinden.
# SP/AP bleiben in sync_tooltips unaufgeloest; hier nur der Faktor → scaling.
_RX_DBC_SP = re.compile(
    r"\$?(?:SP|sp|SPS|SPH|SPFI|SPFR|SPN|spfi|sps|sph|spn)\s*\*\s*"
    r"(\d+(?:\.\d+)?)",
    re.I)
_RX_DBC_AP = re.compile(
    r"\$?(?:AP|ap|RAP|rap)\s*\*\s*(\d+(?:\.\d+)?)",
    re.I)
# Finisher: ($SP*0.0587)*5 → Faktor × CP
_RX_DBC_SP_CP = re.compile(
    r"\(\s*\$?(?:SP|sp|SPS|SPH|SPFI|SPFR|SPN|spfi|sps|sph|spn)\s*\*\s*"
    r"(\d+(?:\.\d+)?)\s*\)\s*\*\s*([1-5])",
    re.I)
_RX_DBC_AP_CP = re.compile(
    r"\(\s*\$?(?:AP|ap|RAP|rap)\s*\*\s*"
    r"(\d+(?:\.\d+)?)\s*\)\s*\*\s*([1-5])",
    re.I)
_RX_DBC_BOTH_L = re.compile(
    r"(\d+(?:\.\d+)?)\s*\*\s*\(\s*\$?(?:AP|ap|RAP|rap)\s*\+\s*\$?(?:SP|sp)\s*\)"
    r"(?:\s*\*\s*(\d+))?(?:\s*\*\s*(\d+))?",
    re.I)
_RX_DBC_BOTH_R = re.compile(
    r"\(\s*\$?(?:AP|ap|RAP|rap)\s*\+\s*\$?(?:SP|sp)\s*\)\s*\*"
    r"(?:(\d+)\s*\*\s*)?(?:(\d+)\s*\*\s*)?(\d+(?:\.\d+)?)",
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
    """True bei 'X by N% of AP/SP' — Umrechnung, kein Trefferkoeffizient.

    Ausnahme: Schaden/Heilung „… increased by N% of AP/SP“ ist ein gemessener
    Koeffizient (z. B. Summon Gargoyle), kein Stat-Umbau.
    """
    prev = desc[max(0, match.start() - 8):match.start()]
    if not re.search(r"\bby\s*$", prev, re.I):
        return False
    ctx = desc[max(0, match.start() - 80):match.start()]
    if re.search(
        r"(?:damage|healing|heal)\b.{0,70}"
        r"(?:increased|further\s+increased)\s+by\s*$",
        ctx, re.I,
    ):
        return False
    return True


def _ap_sp_is_non_damage(desc, match):
    """Mana-Regen, Healing-Power-Umbau, Absorb-% — kein Trefferkoeffizient."""
    ctx = desc[max(0, match.start() - 64):match.end() + 24]
    if re.search(r"absorb", ctx, re.I):
        return True
    if re.search(
        r"(?:healing\s+power|spell\s+healing|bonus\s+spell\s+healing)\s+by",
        ctx, re.I,
    ):
        return True
    if re.search(r"mana|regenerat", ctx, re.I) and not re.search(
        r"\b(?:damage|heal(?:ing|s)?)\b", ctx, re.I
    ):
        return True
    # Talent: „Mind Blast … gain an additional 15% of your bonus spell damage“
    if re.search(
        r"gain(?:s)?\s+an?\s+additional\s+\d+(?:\.\d+)?\s*%\s+of\s+"
        r"(?:your\s+)?bonus\s+spell\s+damage",
        desc, re.I,
    ) and match.group(0) and "bonus spell" in (match.group(0).lower() + ctx.lower()):
        return True
    return False


def _cp_mult(a, b):
    """CP-Faktoren 1–5 aus Tooltip-Zeilen; sonst 1 (kein Multiplikator)."""
    mul = 1
    for x in (a, b):
        if x is None:
            continue
        n = int(x)
        if 1 <= n <= 5:
            mul *= n
        else:
            # z. B. Tick-Anzahl ausserhalb 1–5 — nicht als CP werten
            pass
    return mul


def extract_dbc_power_coeffs(raw):
    """Liest SP/AP-Faktoren aus Spell.dbc-Formeln ($SP*0.24 → 24).

    Kein Aufloesen der $-Tokens im Katalogtext. Mana-only / Waffen-/14
    bleiben aussen vor. Finisher: max. effektiver Faktor (5 CP).
    """
    if not raw or ("$" not in raw and "SP" not in raw and "AP" not in raw):
        return {}
    # Reine Mana-Umwandlung (Life Tap) — kein Schadens-/Heilkoeffizient
    if re.search(r"health into|into\s+\$\{[^}]*\}\s*mana|mana returned", raw, re.I):
        if not re.search(r"\bdamage\b|\bheal", raw, re.I):
            return {}

    ap_fs, sp_fs = [], []

    for m in _RX_DBC_SP.finditer(raw):
        # Nicht greifen wenn unmittelbar Division folgt (selten)
        sp_fs.append(float(m.group(1)))
    for m in _RX_DBC_AP.finditer(raw):
        ap_fs.append(float(m.group(1)))
    for m in _RX_DBC_SP_CP.finditer(raw):
        sp_fs.append(float(m.group(1)) * int(m.group(2)))
    for m in _RX_DBC_AP_CP.finditer(raw):
        ap_fs.append(float(m.group(1)) * int(m.group(2)))

    for m in _RX_DBC_BOTH_L.finditer(raw):
        base = float(m.group(1))
        eff = base * _cp_mult(m.group(2), m.group(3))
        ap_fs.append(eff)
        sp_fs.append(eff)

    for m in _RX_DBC_BOTH_R.finditer(raw):
        # ($AP+$SP)*5*5*0.02 → Faktor 0.02 × CP 5 × 5
        cp1, cp2, factor_s = m.group(1), m.group(2), m.group(3)
        factor = float(factor_s)
        mul = _cp_mult(cp1, cp2)
        # Nur CP-Ziffer ohne echten Koeffizienten (kein Dezimal, 1–5)
        if mul == 1 and factor == int(factor) and 1 <= factor <= 5:
            continue
        eff = factor * mul
        ap_fs.append(eff)
        sp_fs.append(eff)

    out = {}
    # Prozent = Faktor * 100 (0.24 → 24). Cap 500 %% gegen Parser-Ausreisser.
    if ap_fs:
        pct = round(max(ap_fs) * 100, 4)
        if 0 < pct <= 500:
            out["ap"] = pct if pct != int(pct) else int(pct)
    if sp_fs:
        pct = round(max(sp_fs) * 100, 4)
        if 0 < pct <= 500:
            out["sp"] = pct if pct != int(pct) else int(pct)
    return out


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
    else:
        m = RX_WEAPON_BARE.search(d)
        if m:
            o["w"] = 100.0
            hand = (m.group(1) or "any").lower().replace(" ", "").replace("-", "")
            o["wh"] = {"mainhand": "mh", "offhand": "oh", "ranged": "ranged",
                       "melee": "any", "any": "any"}.get(hand, "any")
            sch = school_name(m.group(2) or m.group(4))
            if sch:
                o["sch"] = sch
            if m.group(3):
                v = num(m.group(3))
                o["flat"] = [v, v]
                fsch = school_name(m.group(4))
                if fsch:
                    o["fsch"] = fsch
        elif RX_WEAPON_OH.search(d):
            o["w"] = 100.0
            o["wh"] = "oh"
        else:
            m = RX_EXTRA_ATTACKS.search(d)
            if m:
                raw = m.group(1).lower()
                n_att = _WORD_N.get(raw) or int(raw)
                if n_att > 0:
                    o["w"] = float(n_att * 100)
                    o["wh"] = "any"

    m = RX_FLAT.search(d)
    if m:
        if "flat" not in o:
            o["flat"] = [num(m.group(1)), num(m.group(2))]
            sch = school_name(m.group(3))
            if sch:
                o["fsch"] = sch
    else:
        m = RX_FLAT_HYPHEN.search(d)
        if m:
            if "flat" not in o:
                o["flat"] = [num(m.group(1)), num(m.group(2))]
                sch = school_name(m.group(3))
                if sch:
                    o["fsch"] = sch
        else:
            m = RX_FLAT1.search(d)
            if m:
                if "flat" not in o:
                    o["flat"] = [num(m.group(1)), num(m.group(1))]
                    sch = school_name(m.group(2))
                    if sch:
                        o["fsch"] = sch
            else:
                m = RX_FLAT_OVER.search(d)
                if m:
                    if "flat" not in o:
                        o["flat"] = [num(m.group(1)), num(m.group(1))]
                        sch = school_name(m.group(2))
                        if sch:
                            o["fsch"] = sch
                else:
                    m = RX_FLAT_PLUS_OVER.search(d)
                    if m:
                        if "flat" not in o:
                            # Sofortanteil; DoT-Zusatz bleibt ungeteilt (kein Tick erfunden)
                            o["flat"] = [num(m.group(1)), num(m.group(1))]
                            sch = school_name(m.group(4))
                            if sch:
                                o["fsch"] = sch
                    else:
                        m = RX_FLAT_PLUS.search(d)
                        if m and "flat" not in o:
                            o["flat"] = [num(m.group(1)), num(m.group(1))]
                            sch = school_name(m.group(2))
                            if sch:
                                o["fsch"] = sch

    if "flat" not in o:
        m = RX_FLAT_ADDITIONAL.search(d)
        if m:
            o["flat"] = [num(m.group(1)), num(m.group(1))]
            sch = school_name(m.group(2))
            if sch:
                o["fsch"] = sch
        else:
            m = RX_FLAT_MELEE_BONUS.search(d)
            if m:
                v = num(m.group(1))
                o["flat"] = [v, v]

    if "flat" not in o:
        cps = RX_CP_FLAT.findall(d)
        if cps:
            best = max(cps, key=lambda x: int(x[0]))
            v = num(best[1])
            o["flat"] = [v, v]

    if "flat" not in o:
        m = RX_FLAT_PLUS_BARE.search(d)
        if m:
            v = num(m.group(1))
            o["flat"] = [v, v]

    m = RX_HEAL.search(d)
    if m:
        lo = num(m.group(1))
        hi = num(m.group(2)) if m.group(2) else lo
        o["heal"] = [lo, hi]
    elif "heal" not in o:
        m = RX_HEAL_ADD.search(d)
        if m:
            v = num(m.group(1) or m.group(2))
            o["heal"] = [v, v]
        else:
            m = RX_HEAL_RESTORE.search(d)
            if m:
                lo = num(m.group(1))
                hi = num(m.group(2)) if m.group(2) else lo
                o["heal"] = [lo, hi]

    m = RX_HEAL_PCT.search(d)
    if m:
        o["healpct"] = float(m.group(1))

    m = RX_ABSORB.search(d)
    if m:
        v = num(m.group(1))
        o["absorb"] = [v, v]
        asch = school_name(m.group(2))
        if asch and asch.lower() != "spell":
            o["asch"] = asch

    m = RX_ECHO.search(d)
    if m:
        o["echo"] = [float(m.group(1)), school_name(m.group(2)) or m.group(2)]
    else:
        m = RX_ECHO_BARE.search(d)
        if m:
            ctx = d[max(0, m.start() - 48):m.start()]
            sch = None
            sm = re.search(
                r"(" + SCHOOL + r")\s+energy\s*$|"
                r"blast\s+of\s+(" + SCHOOL + r")\s*$",
                ctx, re.I)
            if sm:
                sch = school_name(sm.group(1) or sm.group(2))
            o["echo"] = [float(m.group(1)), sch or "Physical"]

    m = RX_RELPCT.search(d)
    if m:
        src = re.sub(r"\s+", " ", m.group(2)).strip(" ,.")
        if src and not re.search(r"health|hit\s*points?", src, re.I):
            o["relpct"] = float(m.group(1))
            o["relsrc"] = src[:48]

    m = RX_DOT.search(d)
    if m:
        o["dot"] = int(m.group(1))

    m = RX_TICK.search(d)
    if m:
        o["tick"] = num(m.group(1))
    elif "flat" not in o and "tick" not in o:
        # Gesamtschaden ueber Dauer als flat (keine Tickrate erfinden)
        m = RX_DOT_TOTAL.search(d)
        if m:
            v = num(m.group(1))
            o["flat"] = [v, v]
            sch = school_name(m.group(2))
            if sch:
                o["fsch"] = sch
            if "dot" not in o:
                o["dot"] = int(m.group(3))

    m = RX_AP_OR_SP.search(d)
    if m and not _pct_is_conversion(d, m) and not _ap_sp_is_non_damage(d, m):
        pct = float(m.group(1))
        o["ap"] = pct
        o["sp"] = pct
    else:
        m = RX_AP.search(d)
        if m and not _pct_is_conversion(d, m) and not _ap_sp_is_non_damage(d, m):
            o["ap"] = float(m.group(1))
        elif "ap" not in o and RX_APB.search(d):
            o["apb"] = 1

        m = RX_SP.search(d)
        if m and not _pct_is_conversion(d, m) and not _ap_sp_is_non_damage(d, m):
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
    m = RX_BLEED_VULN.search(d)
    if m:
        what = "damage from " + m.group(2).lower()
        inc.append([float(m.group(1)), what, "dmg"])
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

    # Optionale DBC-Mine: SP/AP-Faktoren aus Tooltip-Formeln (Spell.dbc).
    # Ohne Client bleiben Text-Parser-Ergebnisse stehen.
    dbc_filled = 0
    ids_path = os.path.join(DATA, "spellids.json")
    if os.path.isfile(ids_path):
        try:
            from sync_tooltips import SpellDB  # gleiche DBC-Pfade
            ids = json.load(io.open(ids_path, encoding="utf-8"))
            assert len(ids) == len(cat)
            db = SpellDB()
            for i, o in enumerate(out):
                if "ap" in o and "sp" in o:
                    continue
                sid = ids[i][0]
                raw = db.raw_desc(sid) if sid in db.by_u else ""
                coeffs = extract_dbc_power_coeffs(raw or "")
                if not coeffs:
                    continue
                added = False
                if "ap" not in o and "ap" in coeffs:
                    o["ap"] = coeffs["ap"]
                    if "apb" in o:
                        del o["apb"]
                    added = True
                if "sp" not in o and "sp" in coeffs:
                    o["sp"] = coeffs["sp"]
                    if "spb" in o:
                        del o["spb"]
                    added = True
                if added:
                    dbc_filled += 1
        except Exception as ex:
            print("DBC-Koeffizienten uebersprungen:", ex)

    io.open(os.path.join(DATA, "scaling.json"), "w", encoding="utf-8").write(
        json.dumps(out, separators=(",", ":"))
    )

    keys = {}
    for o in out:
        for k in o:
            keys[k] = keys.get(k, 0) + 1
    print("Eintraege gesamt:", len(out))
    print("mit irgendeiner Skalierung:", sum(1 for o in out if o))
    print("DBC SP/AP nachgezogen:", dbc_filled)
    for k in sorted(keys, key=lambda x: -keys[x]):
        print("  %-6s %5d" % (k, keys[k]))

    print("\nStichproben Waffenskalierung:")
    n = 0
    for i, o in enumerate(out):
        if "w" in o and n < 6:
            print("   %-22s %5.0f%% %-7s %s" % (cat[i][0][:22], o["w"],
                                                o.get("wh", ""), o.get("sch", "physisch")))
            n += 1
    print("\nStichproben SP/AP (DBC oder Text):")
    n = 0
    for i, o in enumerate(out):
        if ("ap" in o or "sp" in o) and n < 10:
            print("   %-24s ap=%s sp=%s" % (
                cat[i][0][:24], o.get("ap", "-"), o.get("sp", "-")))
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
