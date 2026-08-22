# Form-Familien (`D.frm`)

Stand: 2026-08-22. Skript: `pipeline/formtags.py` → `data/formtags.json`
→ assemble `D.frm` (OPTIONAL, nur wenn die Datei ≤ 64 KB).

Ethical Ascension RE — **keine** erfundenen Kampfzahlen, keine DBC.
Nur Katalog **Name + Beschreibung** (Felder 0 und 5).

Der Generator liest `D.frm` in `formInfo()` (`FRM`). Leerer Slot fällt
auf Name+Beschreibung zurück. Shared GCD und Talentvererbung bleiben
eigene Regeln, nicht Form-Identität.

## Wofür

Viele Wildcard- und Klassenfähigkeiten gelten nur in einer Form, Stance
oder Presence — oder sind bewusst **formlos nutzbar** („usable while
shapeshifted“). Ein kurzer Code pro Katalogindex macht das filterbar,
ohne Tooltip-Prosa jedes Mal neu zu parsen.

## Format

Paralleles Array zum Katalog, `""` wenn kein Form-Signal.

Mehrere Familien an einem Eintrag: `+` in fester Reihenfolge
(`bear+cat`, `travel+humanoid`, `presence_blood+presence_unholy`).

| Code | Signal im Text (Beispiele) |
|---|---|
| `bear` | Bear Form, Dire Bear, `(Bear)` |
| `cat` | Cat Form, `(Cat)`, Cat-Abilities |
| `moonkin` | Moonkin Form; Name *Owlkin Frenzy* |
| `tree` | Tree of Life, Tree of Wrath |
| `worgen` | Worgen Form |
| `travel` | Travel / Aquatic / Flight Form |
| `shadowform` | Shadowform |
| `meta` | Metamorphosis |
| `ghostwolf` | Ghost Wolf |
| `presence_blood` / `_frost` / `_unholy` | Blood / Frost / Unholy Presence |
| `stance_battle` / `_defensive` / `_berserker` | Battle / Defensive / Berserker Stance |
| `humanoid` | *while not shapeshifted*, *does not work while shapeshifted* |
| `ushift` | *usable while shapeshifted*, generisches Shapeshift, andere `* Form` |

`ushift` fällt weg, sobald eine konkrete Familie steht.

`(Feral)` im Namen oder als Verweis (Faerie Fire (Feral)) ist die
Katalogkonvention für **beide** Kampf-Formen → `bear+cat`, nicht `ushift`.

## Regeln (kein Raten)

1. **Name-Identität:** Heißt der Eintrag selbst *Bear Form*, *Worgen Form*,
   *Improved Shadowform* usw., gewinnt dieser Code. „allows Cat Form
   abilities“ in Worgen Form macht daraus **kein** `cat`.
2. **Listen:** „Cat, Bear, Moonkin or Tree of Life Shapeshifts“ und
   „Blood or Unholy Presence“ setzen alle genannten Familien.
3. **Andere Formen** (Serpent, Ethereal, Hellfire, Lich, Golem) → `ushift`.
   Keine neuen Codes erfinden.
4. **Keine Zieltypen:** Track Humanoids, „Humanoid targets“, Crusade gegen
   Humanoids — nicht `humanoid`.
5. **Keine falschen Presences:** Presence of Mind, Elune’s Presence,
   Commanding / Netherwind / Threatening Presence bleiben leer.
6. **Feral** ohne Cat/Bear-Namen und ohne `(Feral)` → `ushift`
   (Feral Aggression: „Feral forms“).
7. **Verneinung:** „does not work while in Cat, Bear Form“ setzt **keine**
   Familie (Weapon Command bleibt leer).
8. **Abbruch:** „Canceled if you shapeshift“ / „removed upon shapeshifting“
   / „Shapeshifting … cancels“ ist **kein** `ushift` (Starfall, Divine Steed,
   Shadowfall). Der Text nennt keine Moonkin-Form — nicht raten.

## Embed / Länge

| | |
|---|---|
| Katalog | 3071 |
| Array | 3071 Strings, `""` wenn unbekannt |
| Mit Code | 250 (8,1 %) |
| Leer | 2821 |
| Datei | 10,6 KB, kompakt `separators=(",",":")` |
| Assemble | `OPTIONAL_PAYLOAD` `frm` — Deckel 64 KB |

Kein Client nötig.

```bash
python3 pipeline/formtags.py   # → data/formtags.json
```

## Zahlen (gemessen 2026-08-22)

Familien (ein Eintrag kann mehrere zählen):

| Familie | n |
|---|---|
| ushift | 122 |
| bear | 51 |
| cat | 50 |
| moonkin | 6 |
| tree | 5 |
| travel | 5 |
| shadowform | 5 |
| meta | 5 |
| presence_frost | 5 |
| presence_unholy | 4 |
| stance_defensive | 4 |
| worgen | 3 |
| presence_blood | 3 |
| stance_berserker | 3 |
| ghostwolf | 2 |
| stance_battle | 1 |
| humanoid | 7 |

Häufigste Ketten: `ushift` 122, `bear` 26, `cat` 25, `bear+cat` 23,
`humanoid` 6. Zwei Viererketten `bear+cat+moonkin+tree` (Master Shapeshifter,
Arcane Power). Eine `travel+humanoid` (Improved Barkskin). Eine
`presence_blood+presence_unholy` (Subversion).

Anker (gemessen, nicht geraten):

| Index | Name | Code |
|---|---|---|
| 13 | Bear Form | `bear` |
| 32 | Improved Barkskin | `travel+humanoid` |
| 117 | Serpent Form | `ushift` |
| 121 | Worgen Form | `worgen` |
| 481 | Track Humanoids (Cat Form) | `cat` |
| 516 | Faerie Fire (Feral) | `bear+cat` |
| 525 | Track Humanoids | *(leer — Zieltyp)* |
| 656–658 | Frost / Unholy / Blood Presence | `presence_*` |
| 1209 | Arcane Power | `bear+cat+moonkin+tree` |
| 1229 | Shadowform | `shadowform` |
| 1291 | Metamorphosis | `meta` |
| 1616 | Swashbuckling Duelist | `humanoid` |
| 1759 | Faerie Swarm | `bear+cat` |
| 2657 | Subversion | `presence_blood+presence_unholy` |

## Bewusst leer

Resistance-Auren/Totems (sofern nicht „usable while shapeshifted“),
Presence of Mind, Elune’s / Commanding / Netherwind / Threatening Presence,
Hunter Track Humanoids, Polymorph „normal form“, Lunar Synergy (nennt nur
Owlkin Frenzy, nicht Moonkin Form), Weapon Command (Verneinung),
Starfall / Shadowfall / Divine Steed (Abbruch beim Wechsel, kein Form-Zwang
im Text).
