# Mitmachen

Kurzfassung. Details und Fallen stehen in **[AGENTS.md](AGENTS.md)**.

## Build & prüfen

```bash
python3 pipeline/assemble.py
node -e "new Function(require('fs').readFileSync('src/builder-app.js','utf8'))"
```

Bei Addon-Änderungen: `luac5.1 -p addon/AscBuildschmiede/*.lua`, dann Zip aus `addon/` neu bauen.

## GitHub Pages

Die Live-Seite kommt von **`main` am Repo-Root** (kein `docs/`, kein Action-Build).

Nach sinnvollen Änderungen **mitcommitten und pushen**:

- `index.html`, `synergien.html` (Ausgabe von `assemble.py`)
- `AscBuildschmiede.zip` (wenn das Addon geändert wurde)

Nur `src/` pushen aktualisiert Pages **nicht**.

## Nicht

- Spell-Koeffizienten oder Tooltip-Zahlen erfinden
- proprietäre Client-Lua ins Repo kopieren
- Force-Push
