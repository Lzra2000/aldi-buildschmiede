# Ascension-DBC Notes (Full Probe)

Generiert von `pipeline/probe_dbc_ascension.py` am 2026-08-22.
Nur bereits extrahierte DBC unter `Documents/AscensionDBC`.
Kein Exe-Decompile, keine Injection, kein FrameXML im Repo.

## 1. Header-Inventar

| Datei | records | fields | recordSize | stringBlock |
|---|---:|---:|---:|---:|
| `SpellAddon.dbc` | 5622 | 23 | 92 | 0 |
| `SpellCustomAttr.dbc` | 58633 | 11 | 44 | 0 |
| `SpellCharges.dbc` | 414 | 2 | 8 | 0 |
| `SpellChargesCategory.dbc` | 108 | 3 | 12 | 0 |
| `SpellAlternativeCost.dbc` | 0 | 3 | 12 | 0 |
| `SpellAlternativePowerType.dbc` | 4 | 19 | 76 | 63 |
| `SpellRank.dbc` | 23228 | 4 | 16 | 0 |
| `SpellAffect.dbc` | 36834 | 3 | 12 | 0 |
| `SpellTags.dbc` | 488662 | 3 | 12 | 0 |
| `SpellTagTypes.dbc` | 200 | 61 | 244 | 10396 |
| `SpellStatSuggestions.dbc` | 1121 | 4 | 16 | 0 |
| `SpellSpellSuggestions.dbc` | 353193 | 4 | 16 | 0 |
| `SpellDescriptionVariables.dbc` | 31 | 2 | 8 | 2611 |
| `Item.dbc` | 563620 | 8 | 32 | 0 |
| `ItemAddon.dbc` | 563620 | 48 | 192 | 6962167 |
| `ItemDisplayInfo.dbc` | 129627 | 25 | 100 | 3593267 |
| `ItemSpells.dbc` | 131722 | 37 | 148 | 0 |
| `ItemStat.dbc` | 1513931 | 39 | 156 | 0 |
| `ItemClass.dbc` | 18 | 20 | 80 | 172 |
| `ItemSubClass.dbc` | 121 | 44 | 176 | 1247 |
| `Spell.dbc` | 209334 | 234 | 936 | 13379233 |

## 2. SpellCharges (Mechanik-Facette)

Layout gemessen:

- `SpellCharges.dbc`: `spellId`, `categoryId` (414 Zeilen)
- `SpellChargesCategory.dbc`: `id`, `maxCharges`, `rechargeMs`
- `SpellRank.dbc`: `rowId`, `firstSpellId`, `spellId`, `rank` — Fallback, falls
  nur Folge-Ränge in `SpellCharges` stehen (gleiche Category)

### Katalog-Schnittmenge = Deckel

| | n |
|---|---:|
| `SpellCharges` gesamt | 414 |
| Katalog-Treffer (spellId = `spellids.json[i][0]`) | **18** |
| Zusätzliche Treffer via SpellRank-Sibling | **0** |
| Nicht-Katalog (Raenge / andere Spells) | 396 |

**18 ist die harte Obergrenze** der aktuellen Extracts: es gibt keine weiteren
Katalog-spellIds in `SpellCharges`. Rank-Siblings (60 Zeilen) gehoeren alle zu
denselben 18 First-Ranks — sie verdoppeln die Coverage nicht.

`spellids.json`-Zeile = `[spellId, castMs, minRange, maxRange, passive, entryId]`.
Nur Index 0 ist eine Spell-ID; castMs darf nie als Spell-ID gegen Charges/Kosten
gelesen werden.

### Katalog mit `ch` / `chr` (DBC = Quelle)

| Spell | spellId | max | Recharge | Tooltip-Recharge |
|---|---:|---:|---:|---|
| Unrelenting Wrath | 272318 | 2 | 120.0s | (kein Zahlenpaar) |
| Dark Transfusion | 274210 | 3 | 10.0s | (kein Zahlenpaar) |
| Synchronize | 276345 | 2 | 6.0s | OK |
| Shadow Artillery | 276816 | 2 | 15.0s | OK |
| Temporal Rift | 284758 | 3 | 10.0s | OK |
| Hydricles | 284854 | 3 | 8.0s | OK |
| Bone Arrow | 284879 | 2 | **20.0s** | tip 30s → **DIFF, DBC** |
| Quick Draw | 285612 | 3 | 20.0s | OK |
| Templar's Slash | 278742 | 3 | 8.0s | OK |
| Angelic Feather | 760053 | 3 | 20.0s | OK |
| Ironfur | 760100 | 3 | 10.0s | OK |
| Barbed Shot | 984828 | 2 | **10.0s** | tip 12s → **DIFF, DBC** |
| Rocket Boots | 280030 | 3 | 30.0s | OK |
| Rock Barrier | 280295 | 2 | 20.0s | OK |
| Veilwalk | 280340 | 2 | 60.0s | OK |
| Chaos Rush | 280350 | 2 | 10.0s | OK |
| Quake | 280885 | 2 | 8.0s | OK |
| Build: Firepot Drone | 289190 | 3 | 10.0s | OK |

Bei Tooltip≠DBC gewinnt die DBC (gemessen, nicht geraten). Buff-/Schild-„charges“
im Tooltip (Earth Shield, Holy Shield, Mana Gem, Talent-Stacks) sind **kein**
`SpellCharges`-System — kein `ch`/`chr` erfinden.

Produkt: Felder `ch` / `chr` in `mechanics.json` (`pipeline/mechanics.py`).
Website: Ability-Karten zeigen Badges „N Ladungen“ / „Aufladung Xs“ wenn gesetzt
(`src/builder-app.js`); fehlende Keys = keine Badge (nichts erfinden).

## 2b. Power-Kosten (DBC) vs Regen (Tooltip)

### Wer liefert was

| Wert | Quelle | Produkt |
|---|---|---|
| Verbrauch (`cost` / `res`) | `Spell.dbc` manaCost + powerType | `mechanics.json` |
| Gewinn / Regen (`gen`) | Beschreibungstext | `scaling.json` via `scaling.py` |
| Schadenszahlen | Beschreibungstext | `scaling.json` |
| CD / Cast / Range / Dauer / Proc | DBC | `mechanics.json` |
| Ladungen / Recharge | `SpellCharges*` | `mechanics.json` `ch`/`chr` |

Tooltips sagen praktisch nie „costs N rage“ (0 Treffer im Katalog gegen
`costs|requires N rage|energy|…`). DBC liefert 367 Katalog-Eintraege mit
`manaCost > 0`. Umgekehrt kennt die DBC keinen Ressourcen-Gewinn — Charge
„generate 12 rage“ steht nur im Text → `scaling.gen`.

### powerType + Zehntel-Regel (verifiziert)

| powerType | Label | manaCost-Skalierung | Katalog mit cost |
|---:|---|---|---:|
| 0 | Mana | absolut | 25 |
| 1 | Wut | **÷10** (Zehntel) | 192 |
| 3 | Energie | absolut | 148 |
| 6 | Runenmacht | **÷10** | 1 |
| −2 | Leben | absolut (signed) | 1 |
| 5 | Runen | manaCost meist 0 | — |

Anker (raw → Anzeige), Pool-Cap Wut = 100:

| Spell | raw manaCost | nach /10 | res |
|---|---:|---:|---|
| Heroic Strike | 150 | 15 | Wut |
| Mortal Strike | 300 | 30 | Wut |
| Whirlwind | 250 | 25 | Wut |
| Dancing Rune Weapon | 600 | 60 | Wut |
| Frost Strike | 400 | 40 | Wut |
| Rune Strike | 200 | 20 | Wut |
| Sinister Strike | 45 | 45 (kein /10) | Energie |

Alle 192 Wut-Kosten liegen nach `/10` in `≤ 100`. Ohne Zehntel waeren 159
Eintraege `raw > 100` — das waere Parserfehler, kein Spielwert.

**Ascension-Eigenheit:** klassische Runenmacht-Spender (Frost Strike, Dancing
Rune Weapon, Rune Strike) stehen hier mit `powerType = 1` (Wut) und Zehnteln,
nicht mit Typ 6. Anzeige folgt der DBC (`res: Wut`); nichts umbiegen.

`manaCostPercentage` (Feld 44): 3 Katalog-Treffer (Health Funnel, Testament of
Fortitude, Voidborne). **Kein Produktfeld** — Semantik Prozent-vom-Pool nicht
ohne zweite Evidence einbetten.

Klassische Mana-Spells (Frostbolt, Fireball, …) haben im Ascension-`Spell.dbc`
oft `manaCost = 0` — fehlende Kosten weglassen, nicht aus dem Tooltip schaetzen.

## 3. SpellTagTypes / SpellTags

Katalog-Spells mit ≥1 Tag: **2504** / 3071.

Namensfelder in `SpellTagTypes` (verifiziert): Feld 27 = Name, Feld 44 = Kategorie, Feld 2 = Gruppe.

Stichprobe:

- `1` Core Damage — *Ability Type: Core Damage* (group 5)
- `2` Mobility — *Ability Type: Mobility* (group 17)
- `3` Raid Buffs — *Buffs: Raid Buffs* (group 3)
- `4` Raid Debuffs — *Debuffs: Raid Debuffs* (group 1)
- `5` Damage Over Time (DoT) — *Ability Type: Damage Over Time (DoT)* (group 7)
- `6` Heal Over Time (HoT) — *Ability Type: Heal Over Time (HoT)* (group 12)
- `7` Direct Heal — *Ability Type: Direct Heal* (group 10)
- `8` Instant Cast — *Ability Type: Instant Cast* (group 14)
- `9` Smart Heal — *Ability Type: Smart Heal* (group 22)
- `10` Absorb — *Ability Type: Absorb* (group 1)
- `11` Combo Generator — *Ability Type: Combo Generator* (group 3)
- `12` Combo Spender — *Ability Type: Combo Spender* (group 4)

Produkt: `data/tagnames.json` → Assemble-Schlüssel `tagn`.

## 4. SpellStatSuggestions (Path-Hinweis)

Layout: `rowId`, `spellId`, `pathCode`, `flag(=1)`.
Katalog-Treffer: **505** / 1121 Tabellenzeilen.
DBC-Code-Zählung (alle Zeilen): `0`×249, `1`×298, `3`×384, `4`×190 — **kein Code 2**.

### Drei Namespaces (nicht vermischen)

| Quelle | IDs / Keys | Produkt-Labels |
|---|---|---|
| `SpellStatSuggestions.dbc` `pathCode` | **0 / 1 / 3 / 4** | Strength / Agility / Intelligence / Healing → `D.ssug` |
| `Enum.PrimaryStat` (`SharedXML/Enum.lua`) | **1 / 2 / 3 / 4 / 6** (+5 Stamina reserved) | Strength / Agility / Intellect / Spirit / Duality → `PATH\|` |
| `GetSuggestedStats()` → Export `SUGGEST\|` | Enum-**Stringkeys** (`"Strength"`, … `"Spirit"`) | Addon mappt Intellect→Intelligence, Spirit→Healing |

**Nicht** `pathCode` als PrimaryStat-ID lesen: 0≠Strength-Enum, 1≠Agility-Enum.
Zufällige Zahlen-Gleichheit nur bei Int/Heal (3 und 4) — Str/Agi sind absichtlich verschoben.
Duality (Enum 6) kommt in SpellStatSuggestions **nicht** vor.

### DBC-Anker (spellId gemessen, Katalog vorhanden)

| Code | `D.ssug` / `PATH_FROM_DBC` | Anker (spellId) |
|---:|---|---|
| 0 | Strength | Charge 100, Heroic Strike 78, Defensive Stance 71 |
| 1 | Agility | Backstab 53, Sinister Strike 1752, Mangle 33917 |
| 3 | Intelligence | Frostbolt 116, Fireball 133, Shadow Bolt 686 |
| 4 | Healing | Renew 139, Healing Touch 5185, Healing Wave 331 |

Stichprobe Zeilenkopf DBC (rowId, spellId, pathCode, flag):
`(1,10,3,1)` Blizzard→3, `(2,17,4,1)` PW:Shield→4, `(3,53,1,1)` Backstab→1,
`(5,71,0,1)` Defensive Stance→0, `(7,78,0,1)` Heroic Strike→0.

### GetSuggestedStats (live, ≠ DBC-Codes)

Evidence: `Ascension_ForcedPrimaryStat/PrimaryStat.lua:108–122`
(`NOTES-live-api-map.md`):

```lua
local topStat, topStats = C_CharacterAdvancement.GetSuggestedStats()
local topStatEntry = Enum.PrimaryStat[topStat]   -- topStat = Stringkey
for _, stat in pairs(topStats) do
  local statID = Enum.PrimaryStat[stat]
```

Form: `(topStat: string|nil, topStats: table of string keys)`.
Keys sind `Enum.PrimaryStat`-Namen (`Strength`/`Agility`/`Intellect`/`Spirit`/…),
**keine** SpellStatSuggestions-`pathCode`-Zahlen.
Addon: `BS.CollectSuggestedStats` → `SUGGEST|Intelligence;Healing` (Testexporte).

Produkt: `data/statsuggest.json` → Assemble `ssug` (`pipeline/statsuggest.py`).
Website liest **bereits aufgelöste Namen** in `D.ssug.path[i]` (nicht Rohcodes).
Leerer String = kein Eintrag — nichts erfinden.

## 5. SpellAddon (Ascension-Eigen)

5622 Zeilen, 23 Uint32-Felder, kein Stringblock.
Feld 0 korreliert mit SpellId (Katalog-Hits: 205).
Feld 1 ist unique pro Zeile (interne Addon-ID?).

Nonzero-Raten (Felder mit Signal):

- f00: 5622 / 5622 (100.0%)
- f01: 5622 / 5622 (100.0%)
- f02: 30 / 5622 (0.5%)
- f03: 4 / 5622 (0.1%)
- f04: 2 / 5622 (0.0%)
- f11: 47 / 5622 (0.8%)
- f12: 34 / 5622 (0.6%)
- f13: 13 / 5622 (0.2%)
- f14: 5288 / 5622 (94.1%)
- f15: 72 / 5622 (1.3%)
- f16: 30 / 5622 (0.5%)
- f17: 1 / 5622 (0.0%)
- f20: 222 / 5622 (3.9%)
- f21: 108 / 5622 (1.9%)
- f22: 57 / 5622 (1.0%)

f14-Verteilung (Top): 1×5059, 0×334, 2×135, 6×32, 3×29, 32×13, 96×9, 16×7

Bedeutung der Bit-/Flag-Felder **noch ungeklaert** — keine Produktzahl ohne zweite Evidence.

## 6. SpellCustomAttr

58633 Zeilen, 11 Felder. Feld 0 = SpellId (Katalog-Hits: 1181).
Felder 2–6 wirken wie Bitmasken (nz 18–45%). Semantik offen; Stichprobe:

- `(10, 52, 16777216, 0, 0, 0, 0, 0, 0, 0, 0)`
- `(17, 122, 0, 0, 0, 0, 0, 0, 0, 0, 0)`
- `(53, 224, 0, 16, 256, 0, 0, 0, 0, 0, 0)`
- `(66, 239, 0, 16, 0, 0, 0, 0, 0, 0, 0)`
- `(71, 244, 0, 16, 256, 0, 0, 0, 0, 0, 0)`
- `(72, 245, 0, 16, 256, 0, 0, 0, 0, 0, 0)`

## 7. Item-Display (Gear-Paperdoll)

`Item.dbc` (8 Felder): `id, classId, subclassId, soundOverride, material, displayInfoId, inventoryType, sheath`.
`ItemDisplayInfo.dbc` Feld **5** = Inventory-Icon-Basename (z. B. `INV_Sword_13`).

`ItemClass.dbc` Feld 3 = Klassenname (Weapon, Armor, …).
`ItemSubClass.dbc` Feld 10 = Subname (z. B. Dagger) — andere Stringfelder sind Offsets in den gemeinsamen Block, nicht blind als Name lesen.

Stichprobe (Testexport-Gear):

| itemId | class/sub | invType | icon |
|---:|---|---:|---|
| 1482 | 2/7 | 13 | `INV_Sword_13` |
| 17071 | 2/15 | 13 | `INV_Weapon_ShortBlade_18` |
| 34334 | 2/2 | 15 | `INV_WEAPON_BOW_39` |
| 8191 | 4/3 | 1 | `INV_Helmet_40` |
| 14134 | 4/1 | 16 | `INV_Misc_Cape_18` |
| 8175 | 4/2 | 5 | `INV_Chest_Leather_03` |
| 19863 | 4/0 | 11 | `INV_Jewelry_Ring_47` |
| 17774 | 4/0 | 12 | `INV_Jewelry_Talisman_08` |

Produkt: `data/itemicons.json` → Assemble `iic` (`pipeline/itemicons.py`, Default kompakt).
Eintrag: Icon-Basename + `cls`/`sub`/`inv` aus `Item.dbc`; optional `url` (32px-WebP via `mkchrome.py`).
Quelle der Ids: alle `data/testexport*.txt` (GEAR/WEAPON) + Seed + Levelrun-Seed — kein Item.dbc-Vollscan.

## 8. Was bewusst nicht Produkt wird

- `Spell.dbc` EffectBasePoints → Schaden (bekannt unbrauchbar).
- `Spell.dbc` manaCostPercentage (Feld 44) ohne zweite Evidence.
- Ressourcen-**Gewinn** aus der DBC erfinden (nur Tooltip → `scaling.gen`).
- `ch`/`chr` aus Tooltip-„charges“ ohne `SpellCharges`-Zeile.
- `SpellAddon` / `SpellCustomAttr` Flag-Semantik ohne zweite Quelle.
- `SpellStatSuggestions` Wert `0` als Agility.
- `ItemAddon.dbc` (48 Felder, 115 MB) — Name/Stats spaeter, Layout noch nicht vollstaendig kartiert.
- `SpellEnchantSuggestions` (1 144 863 × 4, Layout wie SpellSpellSuggestions:
  `rowId, spellId, enchantId?, weight`) — Katalog-Hits auf Feld 1 hoch (~619k Zeilen),
  Ziel ist Enchant nicht Spell; **kein Embed** (zu gross, Join zu SpellItemEnchantment offen).

## 9. SpellSpellSuggestions (Related-Spell-Graph)

Layout gemessen (353193 × 4 × 16, kein Stringblock):

| Feld | Bedeutung | Evidence |
|---|---|---|
| 0 | `rowId` | 1…353193, unique |
| 1 | `spellId` (Quelle) | ~2484 unique; Katalog-Hits hoch |
| 2 | `relatedSpellId` (Ziel) | ~2627 unique |
| 3 | `weight` | 0…9828, 126 distinct; Top: 20, 30, 50, 40, 10, 65… |

Gerichtete, asymmetrische Kanten (viele A→B ohne B→A). Self-Loops selten.
Katalog↔Katalog: ~171k Zeilen — zu gross zum Voll-Embed.

Produkt: `data/spellsuggest.json` → Assemble `ssugsp` (`pipeline/spellsuggest.py`).
Top-12 pro Quell-Spell, Katalogindizes + weight. **Nicht** `ssug`
(SpellStatSuggestions / Path).

---

## 10. Tooltip-Parser-Nachzug (scaling / methods gaps)

Stand 2026-08-22. Quelle: Katalog-Beschreibungstext (Season10), abgleichbar mit
`Spell.dbc`-Tooltips via `sync_tooltips.py`. **Kein** erfundenes SP/AP.

Neue / erweiterte Muster in `pipeline/scaling.py`:

| Regex-Gruppe | Beispiel | Ergebnis |
|---|---|---|
| `RX_WEAPON_OH` | „instant off-hand weapon attack“, „additional attack with your off-hand weapon“ | `w=100`, `wh=oh` |
| `RX_EXTRA_ATTACKS` | „two extra attacks“ (Windfury) | `w=200` — Zahlwort×100; „46 extra attack power“ bleibt ungenutzt (kein AP-%) |
| `RX_ABSORB` | „absorbing 347 damage“, „Absorbs 165 Fire damage“, „absorbs 12045 spell damage“ | `absorb=[N,N]`, optional `asch`; **nicht** „absorbing 75% of …“ |
| `RX_HEAL_RESTORE` | „restore 100 health“ | `heal` |
| `RX_HEAL_PCT` | „healed for 4% of its maximum health“ | `healpct=4` |

`methods.py` Gaps: Buff-only-Filter (`RX_BUFF_ONLY`), strengere `% … weapon damage`-
Erkennung, Mastery-Unlock-Texte ausgeschlossen. Scale-Keys fuer Luecken-Frei:
`w/flat/ap/sp/heal/healpct/absorb/tick`.

Restluecken (~24) sind ehrlich: Schule ohne Zahl (Mangle-Varianten, Earthquake,
Heroic Leap, …), Relativschaden (Conflagrate = % of Immolate), oder nur Multiplikator.

## 11. Shared GCD (Dubletten) vs. geteilter Ability-CD

Zwei getrennte Mechanismen — nicht vermischen.

### A) Schulvarianten / Dubletten = **ein GCD** (Produktregel)

Quelle: Season10 `relations.json` Feld `dupGroup` (`REL[i][3]`).
60 Gruppen mit ≥2 Mitgliedern, 234 Katalogeinträge.

Regel (AGENTS.md / `ascension-calc-re.mdc`): Schulvarianten derselben Fähigkeit
teilen sich **einen** GCD — nicht parallel stapelbar. Analyse warnt „Gleicher GCD“,
Ketten zeigen Zeile „Gleicher GCD“, Tempo-Scores einer Gruppe nicht addieren.

DBC-Stichprobe (`Spell.dbc` patch-T, Felder wie in `mechanics.py`):

| Feld | Index | Bedeutung (3.3.5a-Layout) |
|---|---:|---|
| RecoveryTime | 29 | Spell-eigener CD (ms) |
| CategoryRecoveryTime | 30 | Category-CD (ms) |
| StartRecoveryCategory | 31 | Recovery-/GCD-Kategorie |
| StartRecoveryTime | 32 | Dauer dieser Recovery (ms) |

Gemessen (Katalog ∩ multi-member `dupGroup`):

- In **59 / 60** Gruppen ist `StartRecoveryCategory` innerhalb der Gruppe identisch.
- Ausnahme: Immolate / Moonfire (Gruppe 20) — verschiedene StartRecoveryCategory;
  Produkt behandelt sie trotzdem über `dupGroup` (Season10), nicht über DBC-Heuristik.
- Slam-Familie: Basis Slam + Arcane/Shadow/Burning/Frozen/Storm/Brilliant Slam
  haben `StartRecoveryCategory = 12` und `RecoveryTime = CategoryRecoveryTime = 0`
  (kein eigener CD → Takt über GCD/Recovery-Kategorie, nicht als unabhängige CDs).

Keine erfundenen Koeffizienten; `mechanics.json` speichert weiter nur gemessene
`cd`/`cast`/… — die GCD-Slot-Regel kommt aus `dupGroup` + Produktmandat.

### B) Geteilter Ability-Cooldown = `cdGroup` / `cdgroups.json`

Quelle: Season10 `relations.json` Feld `cdGroup` (`REL[i][5]`) + Namen in
`data/cdgroups.json` (10 Gruppen, 25 Spells mit Index ≥0; 4 Gruppen mit ≥2 Mitgliedern:
Interrupts, Tonics, Shaman Shocks, Seismic).

DBC: oft gemeinsames `CategoryRecoveryTime` (z. B. Tonics alle `crt=180000`;
Shocks `crt=6000`). UI: „Geteilter Cooldown“ — **kein** zusätzlicher paralleler CD.

Produkt bereits verdrahtet: Analyse-Flag, Ketten-Zeile „Geteilter CD“, Generator
überspringt Dubletten über `dupGroup`.

---
Ende der Probe.
