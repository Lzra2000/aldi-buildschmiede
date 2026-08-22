# NOTES — Harte Path-Requires (`D.preq`)

Stand: 2026-08-22. Ethical Ascension RE — **keine** erfundenen Paths.
Skript: `pipeline/pathreq.py` → `data/pathreq.json` → assemble `preq`.

## Require vs. Hinweis

| Quelle | Produkt | Bedeutung |
|---|---|---|
| CatalogData / Katalog `Requires Path of X` / `Requires Primary Stat: X` | `D.preq.req` | **Hart** — ohne den Path bleibt der Eintrag tot |
| `relations.json` Gate Art `Pfad` / `Stat` | dasselbe (Bestätigung) | Hart, wenn auf einen der fünf Paths mappbar |
| `SpellStatSuggestions.dbc` | `D.ssug` | **Nur Hinweis** — nie als Sperre lesen |

Duality steht in keinem Requires-Text. SpellStatSuggestions hat Duality nicht.
Might / Finesse werden **nicht** auf Strength / Agility geraten → `raw`.

Bonus- oder Malustexte zählen nicht: *while your Primary Stat is Spirit*,
*While in Path of Agility or Duality*, *Does not work when Primary Stat is Spirit*.

## Mapping (nur gemessene Aliase)

| Text | Key |
|---|---|
| Path of Healing / Healing / Spirit | `heal` |
| Path of Strength / Strength | `str` |
| Path of Agility / Agility | `agi` |
| Path of Intelligence / Intelligence / Intellect | `int` |
| Path of Duality / Duality | `dua` |

## Layout

```
{ "v": 1, "req": { "60": "heal", "2472": "agi" }, "raw": { "2721": "…" }, "meta": {…} }
```

Sparse, Index als String. `req[i] = "heal"` oder `"agi+str"` (ODER).
Leer = keine harte Sperre. Stufe spielt keine Rolle — gilt 10–59 und L60.

## Zahlen (gemessen 2026-08-22)

Katalog 3071. CatalogData 3071 Zeilen, Match über spellId 3071/3071.

| | n |
|---|---:|
| Hartes Require | **41** |
| Healing | 37 |
| Strength | 2 (Divinity, Perforating Shots) |
| Agility | 2 (Careful Aim, Mental Dexterity) |
| Intelligence / Duality | 0 |
| Unmapped `raw` | 1 (Power of Light: Might or Finesse) |
| `D.ssug` Hinweise (kein Require) | 505 |

`catalog.json` trägt nur 21 der Requires vollständig (Truncation /
`:84864:req@` bei Divinity). CatalogData ist die volle Quelle.
relations: 37× `Pfad` Healing + 4× `Stat` (davon Might → raw).

Anker: Potion Toss → heal; Careful Aim → agi; Perforating Shots → str;
Grove Ranger's Agility → heal. Charge / Frostbolt / Backstab / Renew
bleiben leer. Power of Light bleibt raw.

## Builder

`pathReqKeys` / `pathReqLegal` in `src/builder-app.js`:

- Path-Score (`scorePaths`): Pflicht zählt 8 Punkte, ssug bleibt max +2
- Befund (`charIssues`): **kritisch**, wenn importierter Path nicht passt
- Generator / KI-Shortlist: keine path-illegalen Picks
- Vorschläge: `gate[0] === "Pfad"` (war `"Path"` — tot) plus `preq`
- Katalog: Badge „braucht Healing“, Filter unter Weitere Filter
- Verwandte / Ketten: andere Path-Sperre nicht frei tauschbar

## Regen / Verify

```bash
python3 pipeline/pathreq.py
python3 pipeline/pathreq.py --verify
```

Kein Client. Fehlt CatalogData, bleibt die vorhandene JSON und wird geprüft.

## Nicht

- ssug als Require lesen
- Might/Finesse auf Strength/Agility mappen
- Bonus-„while Primary Stat is“ als Sperre markieren
- Den ganzen Katalog sperren
