# -*- coding: utf-8 -*-
"""Gleicht Katalog-Tooltips an die Beschreibungen aus Spell.dbc an.

Neu laufen (DBC-Pfade oben im Skript muessen stimmen)::

    python pipeline/sync_tooltips.py
    python pipeline/scaling.py
    python pipeline/mechanics.py
    python pipeline/assemble.py

Die Season10Builder-Texte in catalog.json[i][5] sind teils veraltet.
Im Client steht der aktuelle Tooltip in Spell.dbc Feld 170; einfache
Effekt-Referenzen ($sN / $12345s2) werden dort ueber EffectBasePoints
aufgeloest (Anzeige = basePoints+1, bei Prozenten der Betrag).

Was dieses Skript bewusst NICHT anfasst:
  - ${...}-Formeln mit SP/AP/PL/RAP/$f — Zahlen nicht erfinden
  - reine $m/$s/$d/$t/$b/$e/$i-Arithmetik in ${...} ist erlaubt (DBC)
  - $<mult>=1, $<glyph>=0 (untalentiert/unglypht); sonstige $<…> ohne DBC
  - $i/$n aus MaxAffectedTargets/ProcCharges; Salvage nur als Fallback
    ($o aus BasePoints*Ticks, $q aus EffectMiscValue, $r aus SpellRange — ok)
  - SP/AP-Koeffizienten aus Formeln liest scaling.py separat in scaling.json
    (Faktor*100), ohne den Katalogtext umzuschreiben

Eintraege, bei denen nach der Aufloesung noch $-Tokens uebrig sind,
bleiben unveraendert (besser ein alter Klartext als ein $-Rest im UI).

Ausgabe: schreibt catalog.json neu. Danach scaling/mechanics/assemble
neu laufen lassen (siehe oben).
"""
from __future__ import print_function

import io
import json
import os
import re
import struct

HERE = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(os.path.dirname(HERE), "data")
DBC_DIR = r"C:\Users\x\Documents\AscensionDBC\DBFilesClient"
SPELL = r"C:\Users\x\Documents\AscensionDBC\patch-T\DBFilesClient\Spell.dbc"

F_PROC = 35
F_PROC_CHARGES = 36   # ProcCharges → $n (Lightning Shield / Inner Fire)
F_DURATION = 40
F_RANGE = 46
F_STACK = 49    # StackAmount (an Ursine Frenzy / Lacerate verifiziert)
F_NAME = 136
F_DESC = 170
F_DIESIDES = 74
F_BASEPOINTS = 80
F_RADIUS = 92   # EffectRadiusIndex[3]
F_AMPLITUDE = 98  # EffectAmplitude[3], ms
F_MULTIPLE = 101  # EffectMultipleValue float[3] → $e (Mana Shield 1.5)
F_CHAIN = 104   # EffectChainTargets[3] (Multi-Shot $x1 == 3)
F_MISC = 110    # EffectMiscValue[3] → $q (Rebirth mana 700)
F_COMBO = 119   # EffectPointsPerComboPoints float[3] → $b
F_MAX_TARGETS = 212  # MaxAffectedTargets → $i (Intimidating Shout 5)


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
    return strings[off:end].decode("utf-8", "replace")


def load_radius():
    path = os.path.join(DBC_DIR, "SpellRadius.dbc")
    rc, fc, rs, data, _sb = read_dbc(path)
    out = {}
    for i in range(rc):
        # id uint, radius float, ...
        row = struct.unpack_from("<I" + "f" * (fc - 1), data, i * rs)
        out[row[0]] = row[1]
    return out


def load_duration():
    path = os.path.join(DBC_DIR, "SpellDuration.dbc")
    rc, fc, rs, data, _sb = read_dbc(path)
    out = {}
    for i in range(rc):
        row = struct.unpack_from("<%di" % fc, data, i * rs)
        out[row[0] & 0xFFFFFFFF] = row[1]
    return out


def load_range():
    """SpellRange.dbc: id -> max range in yards (float fields 3/4)."""
    path = os.path.join(DBC_DIR, "SpellRange.dbc")
    rc, fc, rs, data, _sb = read_dbc(path)
    out = {}
    for i in range(rc):
        row = struct.unpack_from("<I" + "f" * (fc - 1), data, i * rs)
        # Hostile/friend max sit at indices 3 and 4 (0-based in the float pack).
        mx = max(row[3], row[4]) if fc > 4 else 0.0
        out[row[0]] = mx
    return out


def fmt_duration(ms, long_word=False):
    """Client-nahe Daueranzeige."""
    if ms is None:
        return None
    if ms <= 0:
        return "until cancelled"
    # Runden auf sinnvolle Anzeige
    if ms >= 3600000:
        h = int(round(ms / 3600000.0))
        if long_word:
            return "%d %s" % (h, "hour" if h == 1 else "hours")
        return "%d hour%s" % (h, "" if h == 1 else "s")
    if ms >= 60000:
        m = int(round(ms / 60000.0))
        if long_word:
            return "%d %s" % (m, "minute" if m == 1 else "minutes")
        return "%d min" % m
    sec = ms / 1000.0
    if abs(sec - round(sec)) < 0.05:
        sec_i = int(round(sec))
        if long_word:
            return "%d %s" % (sec_i, "second" if sec_i == 1 else "seconds")
        return "%d sec" % sec_i
    sec_r = round(sec, 2)
    if long_word:
        return "%g seconds" % sec_r
    return "%g sec" % sec_r


def fmt_number(val):
    if val == int(val):
        return str(int(val))
    return ("%g" % val)


def strip_colors(text):
    text = re.sub(r"\|c[0-9A-Fa-f]{8}", "", text)
    text = text.replace("|r", "")
    text = re.sub(r"\|T[^|]*\|t", "", text)
    return text


def strip_conditionals_and_ext(text):
    """$?… und @ext:…:ext@ — Inhalt von @ext behalten."""
    prev = None
    while prev != text:
        prev = text
        text = re.sub(
            r"\$\?s\d+\[(.*?)\]\[(.*?)\]",
            lambda m: m.group(2),
            text,
            flags=re.S,
        )
    prev = None
    while prev != text:
        prev = text
        text = re.sub(r"@ext:(.*?):ext@", r"\1", text, flags=re.S)
    return text


def strip_req_markers(text):
    text = re.sub(r"@req:\d+@", "", text)
    text = re.sub(r"@unlockby:\d+@", "", text)
    text = re.sub(r"@wflocation:\w+@", "", text)
    text = re.sub(r"@[a-zA-Z_]+\b", "", text)
    return text


def normalize_ws(text):
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\n", " ")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r" +([.,;:])", r"\1", text)
    text = re.sub(r"\.\s*\.", ".", text)
    return text.strip()


class SpellDB(object):
    def __init__(self):
        rc, fc, rs, data, strings = read_dbc(SPELL)
        self.fc = fc
        self.strings = strings
        self.radius = load_radius()
        self.duration = load_duration()
        self.range_max = load_range()
        self.by_u = {}
        self.by_s = {}
        for i in range(rc):
            vu = struct.unpack_from("<%dI" % fc, data, i * rs)
            vs = struct.unpack_from("<%di" % fc, data, i * rs)
            self.by_u[vu[0]] = vu
            self.by_s[vu[0]] = vs
        print("Spell.dbc: %d Eintraege, %d Felder" % (rc, fc))

    def name(self, sid):
        v = self.by_u.get(sid)
        return sref(self.strings, v[F_NAME]) if v else ""

    def raw_desc(self, sid):
        v = self.by_u.get(sid)
        return sref(self.strings, v[F_DESC]) if v else ""

    def effect_points(self, sid, index1):
        """1-basierter Effektindex -> (lo, hi) mit lo=bp+1."""
        vs = self.by_s.get(sid)
        if not vs or not (1 <= index1 <= 3):
            return None
        e = index1 - 1
        bp = vs[F_BASEPOINTS + e]
        sides = vs[F_DIESIDES + e]
        lo = bp + 1
        hi = bp + max(sides, 1)
        return lo, hi

    def effect_display(self, sid, index1, as_percent=False, want_range=False):
        pts = self.effect_points(sid, index1)
        if pts is None:
            return None
        lo, hi = pts
        # Prozente und Reduktionen zeigt der Client als Betrag.
        if as_percent or lo < 0:
            lo, hi = abs(lo), abs(hi)
        if want_range and hi != lo:
            return "%s to %s" % (fmt_number(lo), fmt_number(hi))
        return fmt_number(lo)

    def effect_total(self, sid, index1):
        """$oN: BasePoints * Ticks (Duration/Amplitude), Betrag.

        Auch bp==0 (Anzeige 1) ist erlaubt, wenn Amplitude+Dauer Ticks
        liefern — Fireball-DoT ist echt ($o2=2). Ohne Ticks bleibt None
        (Schulvarianten-Stummel ohne DoT-Takt).
        """
        pts = self.effect_points(sid, index1)
        if pts is None:
            return None
        lo, hi = pts
        if lo == 0 and hi == 0:
            return None
        vs = self.by_s.get(sid)
        amp = vs[F_AMPLITUDE + (index1 - 1)]
        ms = self.dur_ms(sid)
        if amp is None or amp <= 0 or ms is None or ms <= 0:
            return None
        ticks = int(ms // amp)
        if ticks <= 0:
            return None
        return abs(lo) * ticks, abs(hi) * ticks

    def proc_charges(self, sid):
        """$n — ProcCharges (nicht StackAmount)."""
        vs = self.by_s.get(sid)
        if not vs:
            return None
        n = vs[F_PROC_CHARGES]
        if n > 0:
            return str(n)
        return None

    def multiple_value(self, sid, index1):
        """$eN — EffectMultipleValue als Float (Mana Shield / Death Coil)."""
        vu = self.by_u.get(sid)
        if not vu or not (1 <= index1 <= 3):
            return None
        raw = vu[F_MULTIPLE + (index1 - 1)] & 0xFFFFFFFF
        if raw == 0:
            return None
        val = struct.unpack("<f", struct.pack("<I", raw))[0]
        if abs(val) < 1e-6:
            return None
        return fmt_number(val)

    def misc_value(self, sid, index1):
        """$qN — EffectMiscValue (Resurrect-Mana u.ae.)."""
        vs = self.by_s.get(sid)
        if not vs or not (1 <= index1 <= 3):
            return None
        n = vs[F_MISC + (index1 - 1)]
        if n != 0:
            return str(abs(n))
        return None

    def combo_points(self, sid, index1):
        """$bN — EffectPointsPerComboPoints (Float)."""
        vu = self.by_u.get(sid)
        if not vu or not (1 <= index1 <= 3):
            return None
        raw = vu[F_COMBO + (index1 - 1)] & 0xFFFFFFFF
        if raw == 0:
            return None
        val = struct.unpack("<f", struct.pack("<I", raw))[0]
        if abs(val) < 1e-6:
            return None
        return fmt_number(val)

    def max_targets(self, sid):
        """$i — MaxAffectedTargets."""
        vs = self.by_s.get(sid)
        if not vs:
            return None
        n = vs[F_MAX_TARGETS]
        if n > 0:
            return str(n)
        return None

    def dur_ms(self, sid):
        vu = self.by_u.get(sid)
        if not vu:
            return None
        return self.duration.get(vu[F_DURATION])

    def dur_sec_number(self, sid):
        """Numerische Dauer in Sekunden fuer Formeln (${$d/3})."""
        ms = self.dur_ms(sid)
        if ms is None or ms <= 0:
            return None
        sec = ms / 1000.0
        if abs(sec - round(sec)) < 0.05:
            return float(int(round(sec)))
        return round(sec, 2)

    def radius_yards(self, sid, index1):
        vs = self.by_s.get(sid)
        if not vs or not (1 <= index1 <= 3):
            return None
        idx = vs[F_RADIUS + (index1 - 1)] & 0xFFFFFFFF
        r = self.radius.get(idx)
        if r is None or r <= 0:
            return None
        if abs(r - round(r)) < 0.05:
            return str(int(round(r)))
        return "%g" % r

    def amplitude_sec(self, sid, index1):
        vs = self.by_s.get(sid)
        if not vs or not (1 <= index1 <= 3):
            return None
        amp = vs[F_AMPLITUDE + (index1 - 1)]
        if amp <= 0:
            return None
        sec = amp / 1000.0
        if abs(sec - round(sec)) < 0.05:
            return str(int(round(sec)))
        return "%g" % round(sec, 2)

    def amplitude_ms(self, sid, index1):
        vs = self.by_s.get(sid)
        if not vs or not (1 <= index1 <= 3):
            return None
        amp = vs[F_AMPLITUDE + (index1 - 1)]
        if amp <= 0:
            return None
        return amp

    def proc_chance(self, sid):
        vu = self.by_u.get(sid)
        if not vu:
            return None
        p = vu[F_PROC]
        # 101 = „immer" in der DBC; 1..100 sind echte Tooltip-Prozente.
        if 1 <= p <= 100:
            return str(p)
        return None

    def stack_amount(self, sid):
        vs = self.by_s.get(sid)
        if not vs:
            return None
        n = vs[F_STACK]
        if n > 1:
            return str(n)
        return None

    def chain_targets(self, sid, index1):
        vs = self.by_s.get(sid)
        if not vs or not (1 <= index1 <= 3):
            return None
        n = vs[F_CHAIN + (index1 - 1)]
        if n > 0:
            return str(n)
        return None

    def range_yards(self, sid):
        vu = self.by_u.get(sid)
        if not vu:
            return None
        rid = vu[F_RANGE]
        r = self.range_max.get(rid)
        if r is None or r <= 0:
            return None
        if abs(r - round(r)) < 0.05:
            return str(int(round(r)))
        return "%g" % r


def expand_spell_links(db, text, depth):
    """@s:spellId:rank@ → Name + aufgeloeste Beschreibung (eine Ebene)."""
    def repl(m):
        link_id = int(m.group(1))
        name = db.name(link_id)
        raw = db.raw_desc(link_id)
        if not raw:
            return (" " + name) if name else ""
        body, _ok = resolve_desc(db, link_id, raw, depth=depth + 1, old_text="")
        body = body.strip()
        if name and body:
            return " %s %s" % (name, body)
        return (" " + (name or body)).rstrip()

    return re.sub(r"@s:(\d+):\d+@", repl, text)


def salvage_simple_tokens(text, old_text):
    """Fallback nur wenn DBC keinen Wert liefert ($i/$n/$u)."""
    if not old_text:
        return text

    def take(patterns):
        for pat in patterns:
            m = re.search(pat, old_text, re.I)
            if m:
                return m.group(1)
        return None

    if re.search(r"\$i\b", text):
        n = take([r"up to (\d+)", r"(\d+) nearby", r"(\d+) enemies"])
        if n:
            text = re.sub(r"\$i\b", n, text)
    if re.search(r"\$n\b", text):
        n = take([
            r"surrounded by (\d+)",
            r"until (\d+) stacks",
            r"next (\d+) ",
            r"up to (\d+) stars",
            r"(\d+) charges?",
            r"max(?:imum)? (\d+)",
        ])
        if n:
            text = re.sub(r"\$n\b", n, text)
    # $u / $123u
    def salv_u(m):
        n = take([r"stacks up to (\d+)", r"up to (\d+) times"])
        return n if n else m.group(0)

    text = re.sub(r"\$\d*u\b", salv_u, text)
    return text


# $m/$s/$d/$t/$b/$e + Zahlen/Ops. SP/AP/PL und $f bleiben unaufgeloest.
_RX_SAFE_REF = re.compile(r"\$(\d*)([mMsS])(\d)")
_RX_SAFE_COMBO = re.compile(r"\$(\d*)[bB](\d)")
_RX_SAFE_MULTV = re.compile(r"\$(\d*)[eE](\d?)")
_RX_SAFE_DUR = re.compile(r"\$(\d*)[dD](?![a-zA-Z])")
_RX_SAFE_AMP = re.compile(r"\$(\d*)[tT](\d)")
_RX_SAFE_EXPR = re.compile(r"^[\d.\s+\-*/()]+$")


def try_resolve_safe_formula(db, sid, inner):
    """Wertet ${$m1/1000} / ${$b1*1+$m1} / ${$m1*5*$<mult>} aus.

    None bei SP/AP/PL/$f oder unbekanntem $<…>. $<mult>=1 (untalentiert),
    $<glyph>=0 (ohne Glyphe), $<dur> aus SpellDuration — Client-Default/DBC.
    $i (MaxAffectedTargets) in Formeln erlaubt. SP/AP bleiben ehrlich offen.
    """
    if re.search(
        r"(?i)\b(?:SP|AP|RAP|PL|BH|SPH|SPS|STA|MW|SPFI|SPFR|SPN)\b"
        r"|\$[fF]\d|\$ppl|\$mw\b|\$sp[a-z]*\b",
        inner,
    ):
        return None
    if re.search(r"\$<(?!mult>|dur\d*|glyph>)", inner, flags=re.I):
        return None

    # Untalentierte / unglyphte Basis
    inner = re.sub(r"\$<mult>", "1", inner, flags=re.I)
    inner = re.sub(r"\$<glyph>", "0", inner, flags=re.I)

    def repl_ref(m):
        ref = int(m.group(1)) if m.group(1) else sid
        kind = m.group(2)
        idx = int(m.group(3))
        pts = db.effect_points(ref, idx)
        if pts is None:
            return m.group(0)
        # $m/$s = Minimum (bp+1); $M/$S = Maximum (bp+sides)
        return fmt_number(pts[1] if kind in "MS" else pts[0])

    def repl_combo(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2))
        b = db.combo_points(ref, idx)
        return b if b is not None else m.group(0)

    def repl_multv(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2)) if m.group(2) else 1
        e = db.multiple_value(ref, idx)
        return e if e is not None else m.group(0)

    def repl_dur(m):
        ref = int(m.group(1)) if m.group(1) else sid
        sec = db.dur_sec_number(ref)
        if sec is None:
            return m.group(0)
        return fmt_number(sec)

    def repl_amp(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2))
        a = db.amplitude_sec(ref, idx)
        return a if a is not None else m.group(0)

    def repl_imax(m):
        ref = int(m.group(1)) if m.group(1) else sid
        n = db.max_targets(ref)
        return n if n is not None else m.group(0)

    def repl_dur_var(_m):
        sec = db.dur_sec_number(sid)
        return fmt_number(sec) if sec is not None else _m.group(0)

    expr = re.sub(r"\$<dur\d*>", repl_dur_var, inner, flags=re.I)
    expr = _RX_SAFE_REF.sub(repl_ref, expr)
    expr = _RX_SAFE_COMBO.sub(repl_combo, expr)
    expr = _RX_SAFE_MULTV.sub(repl_multv, expr)
    expr = _RX_SAFE_DUR.sub(repl_dur, expr)
    expr = _RX_SAFE_AMP.sub(repl_amp, expr)
    expr = re.sub(r"\$(\d*)i\b", repl_imax, expr)
    # Client-Tippfehler ${$m1+0)} — eine ueberzaehlige schliessende Klammer
    if expr.count(")") == expr.count("(") + 1:
        expr = re.sub(r"\)([^()]*)$", r"\1", expr)
    if "$" in expr or not _RX_SAFE_EXPR.match(expr):
        return None
    try:
        val = float(eval(expr, {"__builtins__": {}}, {}))  # noqa: S307 — nur Ziffern/Ops
    except Exception:
        return None
    return fmt_number(abs(val))


def resolve_desc(db, sid, text, depth=0, old_text=""):
    """Loest einfache Tokens auf. Gibt (text, ok) zurueck — ok=False bei Rest-$."""
    if not text:
        return "", True
    if depth > 3:
        text = normalize_ws(strip_req_markers(strip_colors(text)))
        return text, "$" not in text

    text = strip_colors(text)
    text = strip_conditionals_and_ext(text)
    text = expand_spell_links(db, text, depth)
    text = strip_req_markers(text)

    # ${...}: sichere $m/$s/$d/$t/$b/$e-Arithmetik; Rest schuetzen (kein SP/AP)
    protected = []

    def repl_or_hide(m):
        full = m.group(0)
        inner = m.group(1)
        got = try_resolve_safe_formula(db, sid, inner)
        if got is not None:
            return got
        protected.append(full)
        return "\x01FORM%d\x01" % (len(protected) - 1)

    text = re.sub(r"\$\{([^{}]*)\}", repl_or_hide, text)

    # Multiplikation vor dem Effekt: $*4;s2 / $*3;s1%
    def repl_mul(m):
        mul = float(m.group(1))
        ref = int(m.group(2)) if m.group(2) else sid
        idx = int(m.group(3))
        pct = m.group(4) or ""
        pts = db.effect_points(ref, idx)
        if pts is None:
            return m.group(0)
        val = abs(pts[0]) * mul
        return fmt_number(val) + pct

    text = re.sub(
        r"\$\*(\d+(?:\.\d+)?);(\d*)[sSmM](\d)(%?)",
        repl_mul,
        text,
    )

    # Division vor dem Effekt: $/10;s2, $/10;o1, $/1000;t1, $/77;m1
    def repl_div(m):
        div = float(m.group(1))
        ref = int(m.group(2)) if m.group(2) else sid
        kind = m.group(3).lower()
        idx = int(m.group(4))
        if kind == "o":
            tot = db.effect_total(ref, idx)
            if tot is None:
                return m.group(0)
            val = tot[0] / div
        elif kind == "t":
            amp = db.amplitude_ms(ref, idx)
            if amp is None:
                return m.group(0)
            # $/1000;t1 → Sekunden; sonst Rohwert/Divisor
            val = amp / div
        else:
            pts = db.effect_points(ref, idx)
            if pts is None:
                return m.group(0)
            val = abs(pts[0]) / div
        return fmt_number(val)

    text = re.sub(
        r"\$/(\d+(?:\.\d+)?);(\d*)([sSmMoOtT])(\d)",
        repl_div,
        text,
    )

    # $12345s2% / $s1% / $S2% / $m1 / $123m2 / $M1 (Max)
    def repl_effect(m):
        ref = int(m.group(1)) if m.group(1) else sid
        kind = m.group(2)  # s/S/m/M
        idx = int(m.group(3))
        pct = m.group(4)  # '%' or ''
        as_pct = pct == "%"
        pts = db.effect_points(ref, idx)
        if pts is None:
            return m.group(0)
        lo, hi = pts
        # $s/$S ohne %: Spanne wenn Wuerfel; $M allein = Maximum
        if kind == "M" and not as_pct:
            return fmt_number(abs(hi) if (as_pct or lo < 0) else hi) + pct
        want_range = (not as_pct) and kind.lower() == "s"
        if want_range and hi != lo and lo > 0:
            return "%s to %s%s" % (fmt_number(lo), fmt_number(hi), pct)
        val = db.effect_display(ref, idx, as_percent=as_pct, want_range=False)
        if val is None:
            return m.group(0)
        return val + pct

    text = re.sub(
        r"\$(\d*)([sSmM])(\d)(%?)",
        repl_effect,
        text,
    )

    # $o1 / $o / $123o2% — Gesamtschaden ueber die Dauer (bp * ticks)
    def repl_over(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2)) if m.group(2) else 1
        pct = m.group(3) or ""
        tot = db.effect_total(ref, idx)
        if tot is None:
            return m.group(0)
        lo, hi = tot
        if hi != lo and not pct:
            return "%s to %s%s" % (fmt_number(lo), fmt_number(hi), pct)
        return fmt_number(lo) + pct

    text = re.sub(r"\$(\d*)[oO](\d?)(%?)", repl_over, text)

    # Dauer: $donds / $123donds / $Donds → "N seconds"; sonst $d / $D / $123d
    def repl_dur_long(m):
        ref = int(m.group(1)) if m.group(1) else sid
        ms = db.dur_ms(ref)
        if ms is None:
            return m.group(0)
        return fmt_duration(ms, long_word=True)

    text = re.sub(r"\$(\d*)[dD]onds", repl_dur_long, text)

    def repl_dur(m):
        ref = int(m.group(1)) if m.group(1) else sid
        ms = db.dur_ms(ref)
        if ms is None:
            return m.group(0)
        return fmt_duration(ms, long_word=False)

    text = re.sub(r"\$(\d*)[dD](?![a-zA-Z])", repl_dur, text)

    # Radius $a1 / $A1 / $a (ohne Index → Effekt 1)
    def repl_radius(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2)) if m.group(2) else 1
        r = db.radius_yards(ref, idx)
        return r if r is not None else m.group(0)

    text = re.sub(r"\$(\d*)[aA](\d?)", repl_radius, text)

    # Tick-Intervall $t1 / $T1 / $t (ohne Index → Effekt 1)
    def repl_amp(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2)) if m.group(2) else 1
        a = db.amplitude_sec(ref, idx)
        return a if a is not None else m.group(0)

    text = re.sub(r"\$(\d*)[tT](\d?)", repl_amp, text)

    # Proc $h% / $16961h% / $h1% (Ziffer nach h ist Client-Rauschen)
    def repl_proc(m):
        ref = int(m.group(1)) if m.group(1) else sid
        p = db.proc_chance(ref)
        return (p + (m.group(2) or "")) if p is not None else m.group(0)

    text = re.sub(r"\$(\d*)[hH]\d?(%?)", repl_proc, text)

    # Stacks $u / $123u
    def repl_stacks(m):
        ref = int(m.group(1)) if m.group(1) else sid
        n = db.stack_amount(ref)
        return n if n is not None else m.group(0)

    text = re.sub(r"\$(\d*)u\b", repl_stacks, text)

    # Chain targets $x1 / $123x1
    def repl_chain(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2)) if m.group(2) else 1
        n = db.chain_targets(ref, idx)
        return n if n is not None else m.group(0)

    text = re.sub(r"\$(\d*)[xX](\d?)", repl_chain, text)

    # Max range $r / $r1 / $123r1
    def repl_range(m):
        ref = int(m.group(1)) if m.group(1) else sid
        r = db.range_yards(ref)
        return r if r is not None else m.group(0)

    text = re.sub(r"\$(\d*)[rR]\d?", repl_range, text)

    # ProcCharges $n / $123n (vor Salvage)
    def repl_charges(m):
        ref = int(m.group(1)) if m.group(1) else sid
        n = db.proc_charges(ref)
        return n if n is not None else m.group(0)

    text = re.sub(r"\$(\d*)n\b", repl_charges, text)

    # EffectMultipleValue $e / $e1 / $123e1
    def repl_multv(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2)) if m.group(2) else 1
        e = db.multiple_value(ref, idx)
        return e if e is not None else m.group(0)

    text = re.sub(r"\$(\d*)[eE](\d?)", repl_multv, text)

    # EffectMiscValue $q / $q1 / $3026q1 (Resurrect-Mana)
    def repl_misc(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2)) if m.group(2) else 1
        q = db.misc_value(ref, idx)
        return q if q is not None else m.group(0)

    text = re.sub(r"\$(\d*)[qQ](\d?)", repl_misc, text)

    # EffectPointsPerCombo $b1 / $123b2
    def repl_combo(m):
        ref = int(m.group(1)) if m.group(1) else sid
        idx = int(m.group(2))
        b = db.combo_points(ref, idx)
        return b if b is not None else m.group(0)

    text = re.sub(r"\$(\d*)[bB](\d)", repl_combo, text)

    # MaxAffectedTargets $i / $5246i
    def repl_imax(m):
        ref = int(m.group(1)) if m.group(1) else sid
        n = db.max_targets(ref)
        return n if n is not None else m.group(0)

    text = re.sub(r"\$(\d*)i\b", repl_imax, text)

    # $<total> — DoT/HoT-Gesamtwert Effekt 1 (Renew)
    def repl_total(_m):
        tot = db.effect_total(sid, 1)
        if tot is None:
            return _m.group(0)
        return fmt_number(tot[0])

    text = re.sub(r"\$<total>", repl_total, text, flags=re.I)

    # Gender $ghis:her; / $Ghim:her; — erste Form (maennlich) wie Client-Default
    text = re.sub(r"\$[gG]([^:]+):([^;]+);", r"\1", text)

    # Pluralisierung $lpoint:points; / $Lsecond:seconds; — Zahl davor entscheidet
    def repl_plural(m):
        before = text[:m.start()]
        left = re.search(r"(\d+)(?:\s*to\s*\d+)?\s*$", before)
        if not left:
            return m.group(2)  # Mehrzahl als Fallback
        n = int(left.group(1))
        return m.group(1) if n == 1 else m.group(2)

    text = re.sub(r"\$[lL]([^:]+):([^;]+);", repl_plural, text)

    text = salvage_simple_tokens(text, old_text)

    # Geschuetzte Formeln wieder einsetzen — wenn noch da, Eintrag ueberspringen
    for i, formula in enumerate(protected):
        text = text.replace("\x01FORM%d\x01" % i, formula)

    text = normalize_ws(text)
    ok = ("$" not in text)
    return text, ok


def meaningful_diff(a, b):
    """Ignoriert reine Whitespace-/Satzzeichenunterschiede."""
    def norm(s):
        s = (s or "").strip().lower()
        s = re.sub(r"\s+", " ", s)
        s = re.sub(r"\s+([.,;:])", r"\1", s)
        s = re.sub(r"(\d+)\.0+\b", r"\1", s)  # 1.50 -> 1
        s = re.sub(r"(\d+\.\d*?)0+\b", r"\1", s)
        s = s.rstrip(".")
        return s
    return norm(a) != norm(b)


def main():
    cat_path = os.path.join(DATA, "catalog.json")
    ids_path = os.path.join(DATA, "spellids.json")
    cat = json.load(io.open(cat_path, encoding="utf-8"))
    ids = json.load(io.open(ids_path, encoding="utf-8"))
    assert len(cat) == len(ids), (len(cat), len(ids))

    db = SpellDB()

    same = updated = missing = skipped = 0
    leftover_tokens = 0
    samples = []

    for idx, rec in enumerate(cat):
        sid = ids[idx][0]
        if sid not in db.by_u:
            missing += 1
            continue
        raw = db.raw_desc(sid)
        if not raw:
            missing += 1
            continue

        old = rec[5] or ""
        resolved, ok = resolve_desc(db, sid, raw, old_text=old)

        if not ok:
            leftover_tokens += len(re.findall(r"\$[^\s]*", resolved))
            skipped += 1
            continue

        if not meaningful_diff(old, resolved):
            same += 1
            continue

        rec[5] = resolved
        updated += 1
        if len(samples) < 12:
            samples.append((rec[0], old[:90], resolved[:90]))

    io.open(cat_path, "w", encoding="utf-8").write(
        json.dumps(cat, ensure_ascii=False, separators=(",", ":"))
    )

    # Voltaic Bite Gegenprobe
    vb = cat[0]
    print("\nGegenprobe Voltaic Bite:")
    print("  ", vb[5])
    pts = db.effect_points(277107, 2)
    print("  EffectBasePoints spell 277107 eff2 ->", pts, "(erwartet lo=150)")

    # Stichproben mit bekannten Diffs
    for name in ("Thunder Slam", "Ursine Frenzy", "Ward of Light", "Bear Form"):
        i = next(j for j, r in enumerate(cat) if r[0] == name)
        print("\nStichprobe %s:" % name)
        print("  ", cat[i][5][:200])

    print("\nErgebnis:")
    print("  gleich      %5d" % same)
    print("  aktualisiert%5d" % updated)
    print("  fehlend     %5d" % missing)
    print("  uebersprungen (Rest-$): %5d" % skipped)
    print("  Rest-$-Tokens in uebersprungenen Texten: %5d" % leftover_tokens)

    if samples:
        print("\nBeispiele (alt -> neu):")
        for name, old, new in samples:
            print("  -", name)
            print("      ALT:", old)
            print("      NEU:", new)


if __name__ == "__main__":
    main()
