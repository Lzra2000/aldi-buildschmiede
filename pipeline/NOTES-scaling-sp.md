# NOTES — SP/AP UI + Tooltip-Parsing (2026-08-22)

Ethical Ascension RE: keine erfundenen Spell-/Attack-Power-Koeffizienten.
Gilt für Levelrun 10–59 und L60-Endgame gleichermaßen (siehe AGENTS.md).

## UI (Builder) — shipped `7c04af1`, nicht zurückbauen

- Badges: `range` / `cast` / `cd` / `dur` / `cost`+`res` / `ch`+`chr` aus `D.mc`
- SP/AP: `% SP` / `% AP` wenn gemessen; sonst `SP · Anteil fehlt` / `AP · Anteil fehlt` (`spb`/`apb`)
- Reiter Skalierung: eigene Sektion für Tooltip-SP/AP; Flat ohne Coeff ehrlich gelabelt
- Befund + Path-Notizen: SpellStatSuggestions „Intelligence“ als Path-Hinweis (kein Coeff)
- Filter: Spell Power / Attack Power

## Parser (`pipeline/scaling.py`)

### Katalogtext

- `RX_AP` / `RX_SP`: „N% of your [melee/ranged] attack power“ / „spell power|damage“
- `RX_AP_OR_SP`: „N% of the higher of your attack power or spell power“ → beide Keys
- `RX_APB` / `RX_SPB`: „based on / scales with / gained from …“ ohne Prozent
- `_pct_is_conversion`: Stat-Umbau „by N% of AP“ auslassen; Schaden „increased by N%“ behalten
- `_ap_sp_is_non_damage`: Mana-Regen, Healing-Power-Umbau, Absorb-%, fremde Bonus-SP-Talente

### Spell.dbc-Formeln (Faktor lesen, Katalogtext nicht umschreiben)

`sync_tooltips.py` lässt `${…$SP…}` ehrlich unaufgelöst. `scaling.py` liest parallel:

| Muster | Beispiel | Ergebnis |
|---|---|---|
| `$SP*0.24` / `$AP*0.165` | Conduit | `sp=24`, `ap=16.5` |
| `($SP*0.0587)*5` | Frostfang (5 CP) | `sp=29.35` |
| `0.0054*($AP+$SP)*5*5` | Disembowel (5 CP) | `ap=sp=13.5` |
| `($AP+$SP)*5*5*0.02` | Eviscerate / Envenom | `ap=sp=50` |
| `($AP+$SP)*0.024` | Mass Razorlash | `ap=sp=2.4` |

Kein Erfinden: nur Faktoren, die im Tooltip stehen. Cap 500 %. Reine CP-Zeilen
`($AP+$SP)*5*5` ohne Dezimalbasis zählen nicht. Mana-only (Life Tap) auslassen.

`sync_tooltips` sicher: `$<glyph>=0`, `$i` in Formeln, Tippfehler-`)` — SP/AP/`$f` bleiben offen.

Stichprobe: Conduit `ap=16.5 sp=24`; Gargoyle Text `33/33`; Eviscerate DBC `50/50`;
Icy Penance `spb`; Glyph of Lava Text-`sp` 20.
