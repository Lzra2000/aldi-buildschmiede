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

## 2. SpellCharges (neue Mechanik-Facette)

Layout gemessen:

- `SpellCharges.dbc`: `spellId`, `categoryId` (414 Zeilen)
- `SpellChargesCategory.dbc`: `id`, `maxCharges`, `rechargeMs`

Katalog-Schnittmenge: **18** / 3071 Spells mit Charges.

| Spell | spellId | max | Recharge |
|---|---:|---:|---:|
| Unrelenting Wrath | 272318 | 2 | 120.0s |
| Dark Transfusion | 274210 | 3 | 10.0s |
| Synchronize | 276345 | 2 | 6.0s |
| Shadow Artillery | 276816 | 2 | 15.0s |
| Temporal Rift | 284758 | 3 | 10.0s |
| Hydricles | 284854 | 3 | 8.0s |
| Bone Arrow | 284879 | 2 | 20.0s |
| Quick Draw | 285612 | 3 | 20.0s |
| Templar's Slash | 278742 | 3 | 8.0s |
| Angelic Feather | 760053 | 3 | 20.0s |
| Ironfur | 760100 | 3 | 10.0s |
| Barbed Shot | 984828 | 2 | 10.0s |
| Rocket Boots | 280030 | 3 | 30.0s |
| Rock Barrier | 280295 | 2 | 20.0s |
| Veilwalk | 280340 | 2 | 60.0s |
| Chaos Rush | 280350 | 2 | 10.0s |
| Quake | 280885 | 2 | 8.0s |
| Build: Firepot Drone | 289190 | 3 | 10.0s |

Produkt: Felder `ch` / `chr` in `mechanics.json` (`pipeline/mechanics.py`).
Website: Ability-Karten zeigen Badges „N Ladungen“ / „Aufladung Xs“ wenn gesetzt
(`src/builder-app.js`); fehlende Keys = keine Badge (nichts erfinden).

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

Layout: `rowId`, `spellId`, `statHint`, `flag(=1)`.
Katalog-Treffer: **505** / 1121 Tabellenzeilen.

**DBC-Codes ≠ Enum.PrimaryStat** (1/2/3/4/6). Verifiziert an Klassenspells:

| Code | Path | Anker |
|---:|---|---|
| 0 | Strength | Charge, Heroic Strike, Defensive Stance |
| 1 | Agility | Backstab, Sinister Strike, Mangle |
| 3 | Intelligence | Frostbolt, Fireball, Shadow Bolt |
| 4 | Healing | Renew, Healing Touch, Healing Wave |

Duality (6) fehlt in der Tabelle. Produkt: `data/statsuggest.json` → Assemble `ssug`
(`pipeline/statsuggest.py`). Leerer String = kein Eintrag — nichts erfinden.

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
Ende der Probe.
