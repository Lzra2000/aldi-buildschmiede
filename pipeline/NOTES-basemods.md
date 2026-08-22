# NOTES — Talent-/Basis-Modifier (basemods)

Stand: 2026-08-22. Ethical Ascension RE — **keine** erfundenen Talent-% oder
SP/AP-Koeffizienten. `scaling.py` bleibt unberührt; hier nur Vererbungs-Graph.

## Regel (bereits in AGENTS)

„This uses Slam modifiers“ heißt: die Schulvariante erbt die **Talente** der
Basis Slam. Ob Slam selbst im Build steht, ist egal. Das ist **nicht** derselbe
Punkt wie Shared GCD.

## Lücke (vorher)

`modifiers.py` nahm nur `relations.json[i][0]` als Basis. Viele Schulvarianten
haben dort `null`, tragen im Katalog aber explizit `This uses X modifiers`
(z. B. Burning Slam → Slam, Fire Swipe (Cat) → Swipe). Slam lag deshalb **nicht**
in `basemods.json`, obwohl ~30 Talente „Slam“ nennen — Befund/Ketten/Generator
sahen keine Vererbung.

Gemessen am Katalog (3071 Einträge):

| Signal | Anzahl |
|---|---|
| `This uses … modifiers` | 316 |
| davon mit `relations[i][0]` | 225 |
| davon nur Text (`relations` null) | 91 |
| Phrase ↔ Katalogname 1:1 | 301 Treffer |
| Phrase braucht Alias / Skip | siehe unten |

## Pipeline

```bash
python3 pipeline/modifiers.py   # → basemods.json + usesbase.json
python3 pipeline/methods.py     # modheat nutzt usesbase für Variantenketten
python3 pipeline/assemble.py    # bettet bm + ub ein
```

| Datei | Inhalt |
|---|---|
| `data/basemods.json` | `{ basisIndex: [talentIndex, …] }` — Talente, deren Text die Basis (oder die uses-Phrase) namentlich nennt |
| `data/usesbase.json` | `{ variantenIndex: basisIndex }` — nur aufgelöste uses-X-Phrasen |

UI (`inheritBase`): `REL[i][0]` hat Vorrang, sonst `D.ub`. Keine %-Zahlen.

### Namensauflösung (ohne Raten)

1. Exakter Katalogname (Ability kind 0 bevorzugt)
2. Gemessene Aliase nur wo Phrase ≠ Katalogname:
   - `Swipe` → `Swipe (Cat)` (kein bare „Swipe“; Bear-Varianten nutzen dieselbe Phrase)
   - `Feral Spirits` → `Feral Spirit`
3. Skip: `crate` („Stealth“-Witz, kein Talentziel)
4. Unaufgelöst gelassen (kein Eintrag erfinden): **Claw** — Serpent Strike sagt
   „uses Claw modifiers“, im Katalog gibt es keine Ability „Claw“ (nur Talente/
   Glyph mit Claw im Namen). Nicht auf Rake o. Ä. mappen.

Talent-Treffer suchen mit Wortgrenzen über **Katalogname und alle Phrasen**,
die auf dieselbe Basis zeigen — sonst trifft „Swipe“ nicht auf Basis
`Swipe (Cat)`.

## Koordination mit scaling

`scaling.py` liest Tooltip-Schadenszahlen. Modifier-Vererbung ändert keine
Koeffizienten und darf scaling nicht anfassen. Methods-`modheat` und Builder-
Befund nutzen denselben Graph; Gaps/Tempo bleiben scaling-getrieben.

## Plausibilität nach Lauf

Vorher typisch: ~88 Basen / ~811 Talent-Verweise (nur Relations-Basen).
Nachher: mehr Basen inkl. Slam/Rake/Shred/…; usesbase ≈ 300 Einträge;
unresolved nur Claw (ggf. erneut prüfen wenn Katalog nachzieht).
