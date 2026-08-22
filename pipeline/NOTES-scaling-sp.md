# NOTES — SP/AP UI + Tooltip-Parsing (2026-08-22)

Ethical Ascension RE: keine erfundenen Spell-/Attack-Power-Koeffizienten.

## UI (Builder)

- Badges: `range` / `cast` / `cd` / `dur` / `cost`+`res` / `ch`+`chr` aus `D.mc`
- SP/AP: `% SP` / `% AP` wenn gemessen; sonst `SP · Anteil fehlt` / `AP · Anteil fehlt` (`spb`/`apb`)
- Reiter Skalierung: eigene Sektion für Tooltip-SP/AP; Flat ohne Coeff ehrlich gelabelt
- Befund + Path-Notizen: SpellStatSuggestions „Intelligence“ als Path-Hinweis (kein Coeff)
- Filter: Spell Power / Attack Power

## Parser (`pipeline/scaling.py`)

- `RX_AP_OR_SP`: „N% of the higher of your attack power or spell power“ → beide Keys
- `RX_SPB`: „damage gained from spell power“
- `_pct_is_conversion`: Schaden „increased by N% of AP/SP“ zählt als Koeffizient

Stichprobe: Icy Penance → `spb`; Summon Gargoyle → `ap`+`sp` 33; Glyph of Lava → `sp` 20.
