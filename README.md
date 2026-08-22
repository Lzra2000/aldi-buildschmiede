# Aldi Ehrfürchtig — Buildschmiede

**Live auf GitHub Pages:**
[**Builder**](https://lzra2000.github.io/aldi-buildschmiede/) ·
[**Synergien**](https://lzra2000.github.io/aldi-buildschmiede/synergien.html) ·
[**Addon-Zip**](https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip)

Deutsch · Project Ascension · Season 10 Wildcard · **Levelrun (10–59)** und **Endgame (Stufe 60)**.
Im Spiel **`/bs`** → Text kopieren → auf der Seite einfügen.

---

## Was du bekommst

| | |
|---|---|
| **Builder** | Katalog, Build, Path/Befund, Generator, Teilen — [öffnen](https://lzra2000.github.io/aldi-buildschmiede/) |
| **Synergien** | Was mit was zusammenspielt und woraus Schaden/Heilung skalieren — [öffnen](https://lzra2000.github.io/aldi-buildschmiede/synergien.html) |
| **Companion-Addon** | [AscBuildschmiede.zip](https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip) → `Interface\AddOns\` → **`/bs`** |

Zahlen stammen aus Katalog, DBC und Export — nichts Erfundenes.

---

## Addon: `/bs`

1. [AscBuildschmiede.zip](https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip) laden  
2. Entpacken nach `Interface\AddOns\` → Ordner `AscBuildschmiede\` mit `.toc`  
3. Client neu starten, dann **`/bs`**

| Befehl | Wirkung |
|---|---|
| `/bs` | Fenster auf/zu (Export zum Kopieren) |
| `/bs target` | Build des Ziels auslesen |
| `/bs gear` | Gear im Export an/aus |
| `/bs stats` | Stats und Waffen an/aus |

Das Addon geht **nicht** ins Netz — nur Text im Fenster.

---

## Paketkarte (Repo-Root)

| Pfad | Rolle |
|---|---|
| **`index.html`** | Gebauter Builder (GitHub Pages) — nicht von Hand editieren |
| **`synergien.html`** | Gebautes Synergie-Nachschlagewerk (Pages) |
| **`AscBuildschmiede.zip`** | Fertiges Addon-Paket (`AscBuildschmiede/…`) |
| **`src/`** | Quelltext der Seite (`builder-*.html` / `builder-app.js`, `synergien-source.html`) |
| **`pipeline/`** | Python-Pipeline → `data/` + `assemble.py` → HTML |
| **`data/`** | Einbettbare JSON/Sprite/Testexporte |
| **`addon/`** | Lua-Quelle des Companion-Addons |
| **`scripts/`** | `build`, `check`, `pipeline-all`, `package-addon`, `sync-addon` (`.sh`/`.ps1`) |
| **`tests/`** | Export-Parse + Daten-Invarianten (`unittest`; braucht Node) |
| **`Makefile`** | `make build` / `check` / `test` / `zip` / `pipeline` |
| **`docs/`** | Projektdoku ([PACKAGE.md](docs/PACKAGE.md)) — **nicht** Pages-Quelle |

Weitere Anker: [AGENTS.md](AGENTS.md) · [CONTRIBUTING.md](CONTRIBUTING.md) · [docs/PACKAGE.md](docs/PACKAGE.md) · [addon/README.md](addon/README.md).

### Live-URLs (Pages)

| | URL |
|---|---|
| Builder | https://lzra2000.github.io/aldi-buildschmiede/ |
| Synergien | https://lzra2000.github.io/aldi-buildschmiede/synergien.html |
| Addon-Zip (raw) | https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip |

GitHub Pages: Branch **`main`**, Ordner **`/`**. Pages baut **nicht** aus `src/` und nicht aus `docs/` — nur die mitgepushten Artefakte `index.html` / `synergien.html`. Beide sind gleichrangig: `assemble.py` schreibt immer Builder **und** Synergien.

**CI:** [`.github/workflows/ci.yml`](.github/workflows/ci.yml) prüft auf Push/PR zu `main` assemble, JS-Syntax, `tests/`, optional Addon-Lua — ohne Pages-Redeploy.

### Lizenz

Im Repo liegt **keine `LICENSE`-Datei**. Eigenen Code und Mitwirkung bitte vor Weitergabe/Fork klären; Ascension-/Blizzard-Clientdaten bleiben außerhalb dieses Pakets (siehe AGENTS.md).

---

## English (short)

Levelrun (10–59) and Endgame (60) tools for Ascension Season 10 Wildcard.  
Live: [Builder](https://lzra2000.github.io/aldi-buildschmiede/) · [Synergies](https://lzra2000.github.io/aldi-buildschmiede/synergien.html) · [Addon zip](https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip).  
In-game `/bs` exports your character for paste-into-site. No invented spell numbers.  
Package map: `src/`, `pipeline/`, `data/`, `addon/`, `scripts/`, `tests/`; built root ships `index.html`, `synergien.html`, `AscBuildschmiede.zip`. See [docs/PACKAGE.md](docs/PACKAGE.md). No `LICENSE` file in the repo yet.

---

## Lokal bauen & verifizieren

```bash
python3 pipeline/assemble.py
# oder: make build  |  ./scripts/build.sh  |  .\scripts\build.ps1

node -e "new Function(require('fs').readFileSync('src/builder-app.js','utf8'))"
# oder: make check  |  ./scripts/check.sh  |  .\scripts\check.ps1

python -m unittest discover -s tests -v

./scripts/package-addon.sh          # AscBuildschmiede.zip neu
# Windows: .\scripts\package-addon.ps1

python3 -m http.server              # http://localhost:8000/
```

| Check | Erwartung |
|---|---|
| Assemble | schreibt `index.html` + `synergien.html` |
| JS / Lua | `scripts/check.*` ohne Fehler (Lua optional, wenn `luac5.1` da) |
| Tests | `unittest` grün (Node für Export-Harness) |
| Root-Ships | `index.html`, `synergien.html`, `AscBuildschmiede.zip` vorhanden |
| Browser | Konsole leer; betroffene Werte **messen** |

### Tests (stdlib, kein Browser)

```bash
python tests/test_export_parse.py      # parseExport via Node + data/testexport-*.txt
python tests/test_data_sanity.py       # Katalog 3071; Wut≤100 / Range≤100 / Cast≤10
python -m unittest discover -s tests -v
# optional: python -m pytest tests/ -q
```

Fixtures: `data/testexport-*.txt`. Keine erfundenen Spell-Zahlen.

Für Pages mitcommitten: `index.html`, `synergien.html`, bei Addon-Änderung `AscBuildschmiede.zip`.  
Pipeline-Übersicht: [docs/PACKAGE.md](docs/PACKAGE.md). Regeln: [AGENTS.md](AGENTS.md) · Mitmachen: [CONTRIBUTING.md](CONTRIBUTING.md).

---

## Komplettpaket / Scripts

Fertige Runner unter `scripts/` (Windows PowerShell + Unix-Shell) und ein `Makefile`. Details auch in [docs/PACKAGE.md](docs/PACKAGE.md).

| Ziel | Windows | Unix / Git Bash | Make |
|---|---|---|---|
| Seite bauen (`assemble.py`) | `.\scripts\build.ps1` | `./scripts/build.sh` | `make build` |
| Prüfen (JS-Syntax, optional `luac`) | `.\scripts\check.ps1` | `./scripts/check.sh` | `make check` / `make test` |
| Datenpipeline (offline + optionale DBC) | `.\scripts\pipeline-all.ps1` | `./scripts/pipeline-all.sh` | `make pipeline` |
| Addon: `luac` → Live-AddOns → Zip | `.\scripts\sync-addon.ps1` | `./scripts/package-addon.sh` | `make zip` (nur Zip) |

**Pipeline-Reihenfolge:** `modifiers` → `pathtags` → `scaling` → `spellids` → `methods` → `spectags` → `desireelig` → `tagnames` → `itemicons` → `spellsuggest` → `statsuggest` → `sync_tooltips` (danach ggf. `scaling` erneut). Schritte mit fehlenden Inputs oder fehlendem Ascension-DBC-Pfad werden übersprungen, nicht abgebrochen.

**Umgebung (optional):** `ASCENSION_DBC`, `ASCENSION_SPELL_DBC`, `ASCENSION_ADDONS`, `SEASON10_DIR`.

Keine erfundenen Spell-Koeffizienten; Client-BLP nur für Spell-/Item-Icons über die bestehende Pipeline — kein UI-Chrome aus dem Client.
