# NOTES — Shared GCD vs. geteilter Ability-CD

Stand: 2026-08-22. Ethical Ascension RE — **keine** erfundenen Koeffizienten,
keine erfundenen GCD-Slots. Levelrun 10–59 und L60/Endgame sind first-class.

Zwei Mechanismen, nicht vermischen. Quelle der Wahrheit für beide bleibt
`relations.json` (Season10Builder-Seed) plus Katalogtext — nicht DBC-Heuristik.

```
REL[i] = [baseIdx, needsIdx, refs[], dupGroup, gate, cdGroup]
```

| Feld | Payload | UI | Was es ist | Was es nicht ist |
|---|---|---|---|---|
| `[3]` dupGroup | `relations.json` | „Gleicher GCD — ein Slot“ | Dieselbe Fähigkeit / derselbe GCD-Slot = **eine** GCD | Talentvererbung |
| `[5]` cdGroup | + `cdgroups.json` Namen | „Geteilter Cooldown“ | Category-CD (Ability-CD) | der GCD |

`cdgroups.json` ist **kein** Generator, sondern die Namensliste zum Index
`REL[i][5]`. Zehn feste Slots; leere Slots nach einem Merge nicht umsortieren
(Indizes würden sonst verrutschen).

Produktmandat (`.cursor/rules/ascension-calc-re.mdc`, `AGENTS.md` →
Spielmechanik): Duplicate abilities always share the GCD. Analyse, Ketten,
Methods-Tempo und Generator dürfen Schulvarianten **nicht** als parallelen
Takt addieren.

---

## Talentvererbung ≠ Shared GCD ≠ geteilter CD

| Regel | Quelle | Heißt | Heißt nicht |
|---|---|---|---|
| **Talentvererbung** | `REL[i][0]` / `usesbase` | Variante erbt die **Talente** der Basis („uses Slam modifiers“) | Die Basis muss im Build stehen; Variante teilt automatisch den GCD |
| **Shared GCD** | `REL[i][3]` | Mehrere Katalogeinträge **einer** Fähigkeit = ein GCD-Slot | Jede uses-X-Fähigkeit ist dieselbe Taste |
| **Geteilter CD** | `REL[i][5]` + `cdg` | Ein Ability-Cooldown („shares a cooldown with …“) | Dasselbe wie der GCD |

Water Nova „uses Frost Nova modifiers“ erbt Frost-Nova-Talente. Sie steht
**nicht** in einer `dupGroup` mit Frost Nova — das wäre erfunden. Thunder Slam
und Loa's Assault nutzen Slam-Talente, sind aber andere Abilities (andere
Stufe, anderer Name) und bleiben außerhalb der Slam-Schulgruppe.

---

## So arbeitet `cdGroup` / `cdgroups.json`

Season10 hat den Tooltip-Satz „This ability shares a cooldown with X“ in ein
Gruppen-**Label** und einen Index geschrieben. Der Label-Text ist oft
`other <Familie>` — „other“ heißt „mit den übrigen dieser Familie“, nicht
„eigene Gruppe“.

Vor der Reparatur (Katalog ∩ `cdGroup ≥ 0`): 25 Spells, 10 Labels, nur
**4** Gruppen mit ≥2 Mitgliedern.

| Index | Label (`cdgroups.json`) | Mitglieder (nach Patch) |
|---:|---|---|
| 0 | Shaman Shock spells | Frostflame Shock, Earth Shock, Flame Shock, **Frost Shock** |
| 1 | Glaive Toss | Zandalari Glaive, **Glaive Toss** |
| 2 | other interrupts | Silence in the Library, Shield Bash, Kick, Counterspell, Pummel, Wind Shear, Mind Freeze, Silencing Shot |
| 3 | other single target taunt … | nur Dark Apotheosis (Katalog nennt keinen Taunt-Peer) |
| 4 | other Shaman Shock spells | *leer* — Frost Shock nach 0 verschoben |
| 5 | other Seismic spells | Seismic Wave, Seismic Tremor |
| 6 | other Gavels | nur Gavel of Wrath (kein zweiter Gavel im Katalog) |
| 7 | other Tonics | sechs Tonics |
| 8 | other Feral Charges | nur Feral Charge |
| 9 | other Force of Nature spells | nur Force of Nature |

DBC (nur Gegenprobe, nicht die Gruppenquelle): Tonics teilen
`CategoryRecoveryTime = 180000`; Shocks `6000`. UI zeigt „Geteilter
Cooldown“ — kein zweiter paralleler CD.

Nicht erfunden: Interrupts ohne den Share-Satz (Halt, Crushing Dissonance,
Silence), Taunts zu Dark Apotheosis, ein zweiter Gavel / Feral Charge /
Force of Nature. Die Singleton-Labels bleiben stehen, bis der Katalog
einen Peer nennt.

---

## So arbeitet `dupGroup` (Shared GCD)

Season10 liefert 60 Cliquen. Sechs-Schul-Familien (Riposte, Slash, Maul,
Rake, …) sind oft schon vollständig. Manche Familien waren **gesplittet**
(4+2, 3+2) oder um eine Schule zu kurz — dieselbe Clique, nur unvollständig
zugeordnet.

Gemessen vor dem Patch: 60 Multi-Gruppen, 234 Mitglieder. Alle Multi, keine
Singletons.

`StartRecoveryCategory` in Spell.dbc ist **kein** Slot-Beweis: Kategorie 12
ist der normale GCD. Fast jeder Instant-Spell liegt dort. Die Slot-Regel
kommt aus `dupGroup` + Produktmandat, nicht aus der DBC-Kategorie.

---

## Was `pipeline/sharedgcd.py` darf (ohne Raten)

```bash
python3 pipeline/sharedgcd.py          # schreibt data/relations.json
python3 pipeline/sharedgcd.py --dry    # nur Report
python3 pipeline/sharedgcd.py --check  # Exit 1, wenn ein Patch nötig wäre
python -m unittest tests.test_sharedgcd -v
```

Nur `REL[i][3]` und `REL[i][5]` ändern. Basis, Needs, Refs, Gate bleiben.
Idempotent. `cdgroups.json` wird nicht umsortiert — zehn englische
Season10-Labels, leerer Slot 4 bleibt stehen (Index 0–9). Die UI wrappt
sie auf Deutsch („Geteilter Cooldown“), die JSON-Namen bleiben der Index.

### Shared GCD (`dupGroup`)

**Merge**, wenn zwei bestehende Season10-Gruppen intern denselben Schlüssel
haben:

```
(letzter Namensstamm, uses-X-Phrase oder leer, Katalogstufe, Form-Klammer)
```

Beispiel: Frozen/Storm Slam (49) und Arcane/Shadow/Burning/Brilliant Slam (50)
— alle `uses Slam`, Stufe 1, Stamm Slam. Cat- und Bear-Swipe bleiben getrennt
(`(Cat)` / `(Bear)`). Shield Slam bleibt von Slam getrennt (uses-Phrase
`Shield Slam`). Gruppen mit gemischten Schlüsseln (Charred Bite + Venomous
Fury) werden nicht angefasst.

**Geschwister ergänzen**, wenn der Katalog eine Ability derselben Clique
führt, die Season10 weggelassen hat:

1. Gleicher Schlüssel wie eine schon vorhandene Multi-Gruppe
2. Name hat ein Schul-Präfix (nicht die nackte Basis „Slam“ / „Rupture“)
3. Präfix kommt in einer bestehenden gemeinsamen-Stamm-`dupGroup` vor
   **oder** die Gruppe hat genau 5 Mitglieder (fehlende 6. Schule —
   Ghostly Finish)

Nicht ergänzt (wäre erfunden):

- Basis-Abilities (Slam, Riposte, Maul, Rupture, …)
- uses-X ohne Schulmuster (Water Nova, Thunder Slam, Eclipse Strike,
  Blind Revenge, Ice Lash, …)
- Ferocious / Frostfang Bite an die Duskfang-Clique
- Eclipse Strike an die Aether/Void/…-Strike-Familie (die 6er-Gruppe
  ist schon voll; Eclipse ist ein anderer Name)

### Geteilter CD (`cdGroup`)

1. Tooltip-Phrase normalisieren: Color-Codes weg, führendes `other `
   weg. „other Shaman Shock spells“ = „Shaman Shock spells“ → Frost Shock
   in Gruppe 0.
2. Ist die Phrase **genau** ein Ability-Name im Katalog (eine kind-0-
   Treffer), den Peer in dieselbe Gruppe hängen: Glaive Toss neben
   Zandalari Glaive („shares a cooldown with Glaive Toss“).

Kein neuer Index, kein umsortiertes `cdgroups.json`.

---

## Plausibilität nach Lauf (2026-08-22)

| | vorher | nachher |
|---|---:|---:|
| `dupGroup` Multi-Gruppen | 60 | 55 |
| `dupGroup` Mitglieder | 234 | 252 |
| `cdGroup` zugeordnet | 25 | 26 |
| `cdGroup` Multi-Gruppen | 4 | 5 |

Merges: Slam 49←50, Finish 23←24, Breaker 54←55, Execution 16←17,
Spike 13←14.

Ergänzt (18): Ghostly Finish; Shadowy Execution; Dusk Spike; Freezing
Bloodstrike; Void Spree; Dusk Mangle; Aether/Shadow/Glacial/Lightning
Rupture; Rime/Storm/Dusk/Dawn Revenge; Flame/Shadow/Dawn/Aether Counter.

CD: Frost Shock → Gruppe 0; Glaive Toss → Gruppe 1.

Zweiter Lauf ist ein No-Op. `--check` ist grün.

### Gemessen, bewusst nicht ergänzt

Kein Raten — der Katalog nennt hier keinen Peer derselben Clique bzw.
keinen Share-Satz.

| Fall | Warum draußen |
|---|---|
| Ice Lash (Stufe 20) neben Rime/Lightning/… Lash (Stufe 1) | anderer `variant_key` (Stufe); uses-X allein ist Talentvererbung |
| Thunder Slam (Stufe 30) neben der Slam-Schulgruppe (Stufe 1) | anderer Name + andere Stufe; nur Slam-Talente |
| Water Nova neben Frost Nova | uses Frost-Nova-**Talente**, kein gemeinsamer GCD-Slot |
| Shield-Slam-Familie (5) | keine sechste Schule im Katalog |
| Dark Apotheosis / Slot 3 | aktueller Katalogtext hat keinen Share-Satz; Label nennt Distracting Shot, der Spell nicht — Peer nicht anhängen |
| Gavel / Feral Charge / Force of Nature | Singleton; Katalog führt keinen zweiten Share-Peer |
| Halt, Crushing Dissonance, Silence | Interrupts ohne den Share-Satz |
| Seismic Tremor-Tooltip `other S` | abgeschnitten; Season10 hat ihn schon in Slot 5 gelegt |

`cdgroups.json` Slot 4 (`other Shaman Shock spells`) ist leer, seit Frost
Shock in Slot 0 hängt. Nicht löschen, nicht umsortieren.

Synergien-Kompendium (`src/synergien-source.html`) zitiert die gemessenen
Zahlen 55 / 252 (`nDupG` / `nDupM`), nicht mehr den Seed 60 / 234.

---

## Pipeline / UI

Die Seite liest weiter `REL[i][3]` / `REL[i][5]` (`analyse`, `chainOf`,
Generator). `methods.py` zählt `tempo.dupGroups` aus dem gepatchten Seed.
Dieses Skript ändert methods/mechanics/modifiers/pathtags nicht.

Nach Relations-Refresh aus Season10: `python3 pipeline/sharedgcd.py`
erneut laufen lassen, danach `--check`.

Assembler: `D.rel` + `D.cdg` — kein neues Payload. Assemble nach dem
Patch, wenn die gebauten HTML-Dateien mitgehen sollen.

Verwandt: `NOTES-basemods.md` (nur Talente), `NOTES-wirkungsketten.md`
(Ketten-Zeilen), `NOTES-dbc-ascension.md` §11 (DBC-Gegenprobe).
