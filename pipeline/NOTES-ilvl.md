# NOTES — ilvl / Waffen-Bänder (Levelrun 10–59)

Stand: 2026-08-22. Ethical Ascension RE — keine erfundenen Spell-Koeffizienten.

## Ziel (Wildcard-Leveling)

Nicht L60-Raid-Theorycraft. Für Stufe 10–59 brauchst du:

1. **Durchschnitts-ilvl** aus dem Addon-Export (`ILVL|…`) gegen ein Stufenband
2. **MH/OH-Waffen**: Export-DPS × Tempo ≈ Mid-Schaden, gegen 1H/2H-Band
3. Ehrliche Lücken, wenn ItemStat für die Stufe fehlt oder die Waffe kein Tempo hat

Budget-Tipp im Befund: Waffe unter Band → bei physischen Builds zuerst die Waffe
tauschen; ilvl weit unter Median → Quests/Dungeons nachziehen. Kein Spell-SP/AP raten.

## DBC-Evidence

### `ItemStat.dbc` (Ascension, ~1.5M × 39)

| Feld | Bedeutung | Evidence |
|---|---|---|
| 1 | `itemId` | Join gegen `Item.dbc` |
| 2 | Charakterstufe der Skalierungszeile | 1…60+, ~20k Items/Stufe |
| 23 / 24 | Schaden min/max | IEEE float; Mid = (min+max)/2 |
| 27 | Rüstung | int, Rüstungsteile |
| 37 | effektive Gegenstandsstufe | oft ≈ Stufe − 4 (Median) |

Viele Zeilen sind **Skalierungsitems** (pro Stufe eine Zeile). Klassik-Items ohne
ItemStat-Zeile erscheinen nicht in den Bändern — deshalb „Anhalt“, kein Vollkatalog.

### `Item.dbc`

- classId 2 = Waffe, 4 = Rüstung
- invType 13/21/22 = 1H, 17 = 2H → `w1h` / `w2h`

### `ItemAddon.dbc`

Layout noch nicht voll produktisiert (Name-Offsets / Qualität / f47≈ilvl bei manchen
Ids). Per-Item-Evidence kann ein Sibling-Skript (`weapons.py` → `weapons.json`)
liefern — **nicht** mit `ilb` verwechseln. `ilb` = Perzentilbänder je Stufe.

## Produkt

| Skript | Datei | Assemble |
|---|---|---|
| `pipeline/ilvlbands.py` | `data/ilvlbands.json` (~10 KB) | optional `D.ilb` |
| `pipeline/weapons.py` | `data/weapons.json` | optional `D.wpn` |

**Koordination UI:** `ilb` = Stufen-Perzentile (ilvl / w1h / w2h). `wpn` = per-itemId
Name/ilvl/Basis-dmg/ItemStat-Bänder 10–59. Analyse zeigt beide: Import-DPS +
Item-Evidence (`wpn`) + Band-Badge (`ilb`). Distanzwaffen: kein 1H/2H-Band.

Stichprobe Stufe 40 (gemessen):

- ilvl Median ≈ 36 (p25=p75 kollabiert → UI nutzt ±5 um p50)
- 1H Mid p25/p50/p75 ≈ 39.5 / 49.5 / 53.5
- 2H Mid ≈ 63.5 / 86.5 / 94.0
- Rüstung p50 ≈ 161

## Sibling: `weapons.py` → `D.wpn`

Kompakte per-itemId Evidence (Name, Qualität, ilvl, Basis-dmg, optionale
Stufenzeilen). Ergänzt `ilb` in der Analyse — ersetzt die Perzentilbänder nicht.
Assemble-Key `wpn`, Soft-Limit wie `iic` (512 KB).

## UI / Generator

- Analyse: Band-Badges an Waffe + Gegenstandsstufe; Befund-Issues bei „unter Band“
- Generator: milder Score-Tweak (±1…1.5) für Waffen-% vs. Magic, nur wenn `weaponGearSignal` ≠ 0
- Kein Eingriff in `parseExport` / `iconStyle` / Shared-GCD

## Bewusst nicht

- SP/AP-Koeffizienten erfinden
- ItemAddon-Vollscan einbetten
- L60-Raid-ilvl-Ziele
- Distanzwaffen als 2H-Band (nur inv 17)
