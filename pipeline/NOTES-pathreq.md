# Path-Requires (`D.preq`)

Stand: 2026-08-22. Skript: `pipeline/pathreq.py` → `data/pathreq.json`
→ assemble `D.preq` (OPTIONAL, nur wenn die Datei ≤ 64 KB).

Harte Katalog-Requires (`Requires Path of X` / `Requires Primary Stat: X`
plus relations-Gate Pfad/Stat). **Nicht** dasselbe wie `D.ssug`
(SpellStatSuggestions — nur Hinweis).

Might/Finesse werden nicht auf Strength/Agility geraten — die landen in
`raw`. Spirit zählt als Healing (Client-Anzeige).

Die Seite liest `D.preq` in `builder-app.js` (`PREQ.req` / `PREQ.raw`).
Fehlt die Datei, bleibt der Filter leer — Assemble bricht nicht ab.

```bash
python3 pipeline/pathreq.py   # → data/pathreq.json
```
