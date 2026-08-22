# Abgeleitete Methoden

`pipeline/methods.py` liest nur vorhandene `data/*.json` und schreibt
`data/methods.json`. Kein Client, keine erfundenen Koeffizienten.
Eingebettet als `D.meth` über `assemble.py`.

```bash
python3 pipeline/methods.py
python3 pipeline/assemble.py
```

## 1. Levelrun-Tempo-Score (`tempo`)

**Frage:** Welche Abilities lohnen sich beim Leveln 10–59, gemessen an
ehrlichen Tooltip-/DBC-Zahlen?

**Formel:** `Score = messbarer Anteil / effektiver CD`

| Anteil | Quelle |
|---|---|
| Waffen-% (`w`) | `scaling.json` aus Tooltip |
| AP-% / SP-% | nur wenn der Tooltip den Prozentwert nennt |
| CD | `mechanics.json`: Spell.dbc-CD, sonst bei Charges `chr/ch`, sonst GCD 1,5 s |

**Vertrauen (`conf`):**

| Stufe | Bedeutung |
|---|---|
| `high` | Waffen-% + DBC-Cooldown **oder** Waffen-% + Charges (`ch`/`chr`) |
| `mid` | Waffen-% ohne DBC-CD (GCD geschätzt) **oder** Flat + genannter AP/SP-% |
| `low` | Flat-Schaden ohne SP/AP-Koeffizienten — **nicht gerankt**, nur gelistet |

Flat ohne Koeffizient bekommt **keinen** Tempo-Score. Die Seite sagt
„Zahl fehlt“, statt einen SP-Anteil zu erfinden.

## 2. Modifier-Ketten-Hitze (`modheat`)

**Frage:** Welches Talent verstärkt die meisten gewählten Schulvarianten?

Ascension-Regel: „This uses Slam modifiers“ erbt die **Talente** der Basis,
nicht die Basisfähigkeit selbst (`basemods.json` + `relations.json`).

- **Talent-Hitze** = Anzahl Katalog-Abilities mit derselben Basis
  (Basis + alle Schulvarianten).
- **Basis-Hitze** = Varianten × bekannte Modifier-Talente.
- **Orphan** = Variantenfamilie (≥3) ohne Eintrag in `basemods` — hier greift
  kein bekanntes Talent-Netz.

## 3. Ehrliche Zahlenlücken (`gaps`)

**Frage:** Wo behauptet der Katalog Schaden/Heilung, liefert `scaling.json`
aber keine messbare Zahl?

Treffer nur bei Deal-/Weapon-/Heal-Formulierungen. Treffer ohne `w` / `flat` /
`ap` / `sp` / `heal` / `tick` landen hier — inkl. Kurzgrund
(`schadenstext_ohne_zahl`, `nur_multiplikator_kein_basisschaden`, …).

Parser-Nachzug in `scaling.py` (ohne SP/AP zu erfinden): bare `weapon damage`
(=100%), `weapon damage plus N`, `N to M additional`, armor-piercing Flats,
CP-Finisher-Zahlen, `N plus M over T` (nur Sofortanteil), Heil-Zusatzformen.
`sync_tooltips.py` gegen AscensionDBC: Katalog bereits aktuell (0 Diffs);
512 Eintraege bleiben wegen SP/AP/PL-`$`-Formeln bewusst unaufgeloest.

**Assemble:** bei parallelen `src/`-Aenderungen anderer Lanes nur
`data/scaling.json` + `data/methods.json` committen; `pipeline/assemble.py`
spaeter von der src-Lane oder nach Merge — sonst Index-Konflikt.

## Zusatz: Ressourcenkarte (`resmap`)

DBC-Kosten je Pool (`Wut`, `Energie`, `Mana`, …). Mehrere Pools im selben
Build sind erlaubt (AGENTS.md). Kein Druck-Score erfunden — nur Zählung und
Stichproben.

## SpellTags-Struktur (`stags` / `tagn`)

`pipeline/_method_spelltags.py` → `data/method-spelltags.json`, eingebettet
als `D.stags`. Offizielle Ascension-Taxonomie (SpellTags.dbc ∩ Katalog,
~2504/3071). Felder: `facets` (inkl. `weight`), `roles`, `schools`,
`entries[{i,spellId,facets,schools,roles,tagCount}]`.

`pipeline/tagnames.py` → `data/tagnames.json` als `D.tagn`: alle 200
SpellTagTypes mit Name/Kategorie plus `bySpell` (spellId → Tag-IDs).

```bash
python3 pipeline/_method_spelltags.py
python3 pipeline/tagnames.py
python3 pipeline/assemble.py
```

Charges (`ch`/`chr`) stecken in `mechanics.json` (`pipeline/mechanics.py`).
Tempo nutzt bei Charges `chr/ch` als effektiven Takt (`cdSrc=charges`).
Item-Icons: `pipeline/itemicons.py` → `D.iic` (kompakt ohne `--all`).
DBC-Notes: `pipeline/NOTES-dbc-ascension.md`.

## Offline-Path (`ssug`)

`pipeline/statsuggest.py` → `data/statsuggest.json` → `D.ssug`.
SpellStatSuggestions.dbc, 505 Katalog-Treffer. DBC-Codes 0/1/3/4 =
Strength/Agility/Intelligence/Healing (≠ Enum.PrimaryStat).

```bash
python3 pipeline/statsuggest.py
```

## Related-Spell-Graph (`ssugsp`)

`pipeline/spellsuggest.py` → `data/spellsuggest.json` → `D.ssugsp`.
SpellSpellSuggestions.dbc (`rowId, spellId, relatedSpellId, weight`), nur
Katalog↔Katalog, Top-12 nach weight. Parallelarray `rel[i]` =
`[catalogIndex, weight, …]`. **Nicht** `D.ssug` (das sind Path-Hints).
Website-Agent: Graph lesen, keine Kanten nachrechnen.

```bash
python3 pipeline/spellsuggest.py
```

## Rollgate (`rollgate` in `meth` / `D.des`)

`desiredEligible=false` aus CatalogData (104 Einträge) — Zusammenfassung
in `methods.json`; Parallelarray `desireelig.json` → `D.des`.

## UI

Reiter **Wissen → Methoden** (`D.meth`). SpellTags (`D.stags` / `D.tagn`),
Path-Hints (`D.ssug`) und Related-Spells (`D.ssugsp`) für Website-Agent.
Daten nur lesen, nichts nachrechnen, was die Pipeline nicht ausgewiesen hat.
