# Mitmachen

Kurzfassung. Details und Fallen stehen in **[AGENTS.md](AGENTS.md)**.  
Paketkarte / Pipeline: **[docs/PACKAGE.md](docs/PACKAGE.md)**.

## Build & prüfen

```bash
python3 pipeline/assemble.py
# oder: ./scripts/build.sh  |  .\scripts\build.ps1

node -e "new Function(require('fs').readFileSync('src/builder-app.js','utf8'))"
# oder: ./scripts/check.sh  |  .\scripts\check.ps1

python -m unittest discover -s tests -v
```

Root-Ships: `index.html`, `synergien.html`, `AscBuildschmiede.zip`.  
Bei Addon-Änderungen: `luac5.1 -p addon/AscBuildschmiede/*.lua`, dann `./scripts/package-addon.sh` bzw. `.\scripts\package-addon.ps1`.

Einzeltests: `python tests/test_export_parse.py`, `python tests/test_data_sanity.py` (Node für Export-Harness). Optional: `python -m pytest tests/ -q`.

## CI (GitHub Actions)

Workflow [`.github/workflows/ci.yml`](.github/workflows/ci.yml) bei Push/PR auf **`main`**: Assemble, JS-Syntax, optional `luac`, Unittests. CI **deployt nicht** — Pages bleibt Root auf `main`.

## GitHub Pages

Die Live-Seite kommt von **`main` am Repo-Root**. Ordner **`docs/`** ist Projektdoku (PACKAGE.md), **kein** Pages-Build.

Nach sinnvollen Änderungen **mitcommitten und pushen**:

- `index.html`, `synergien.html` (Ausgabe von `assemble.py`)
- `AscBuildschmiede.zip` (wenn das Addon geändert wurde)

Nur `src/` pushen aktualisiert Pages **nicht**.

## Nicht

- Spell-Koeffizienten oder Tooltip-Zahlen erfinden
- proprietäre Client-Lua ins Repo kopieren
- Force-Push
