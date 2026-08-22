# Paket & Pipeline — Kurzüberblick

Was im Repo liegt, was gebaut wird, und welche Skripte wohin schreiben.  
Details und Fallen: [AGENTS.md](../AGENTS.md). Methoden: [pipeline/README-methods.md](../pipeline/README-methods.md). Addon-Zip: [addon/README.md](../addon/README.md).

## Root-Ships (GitHub Pages + Addon)

| Datei | Herkunft | Zweck |
|---|---|---|
| `index.html` | `pipeline/assemble.py` ← `src/` + `data/` | Builder (Pages) |
| `synergien.html` | `assemble.py` ← `src/synergien-source.html` | Synergien (Pages) |
| `AscBuildschmiede.zip` | `addon/AscBuildschmiede/` via `scripts/package-addon.*` | Companion-Addon |

Pages: Branch `main`, Ordner `/`. Ohne Push der gebauten HTML-Dateien bleibt die Live-Seite alt.

## Verzeichnisse

| Pfad | Inhalt |
|---|---|
| `src/` | `builder-head.html`, `builder-body.html`, `builder-app.js`, `synergien-source.html` |
| `pipeline/` | Datenaufbereitung (Python 3, Stdlib) + Assemble |
| `data/` | JSON, Sprite, Testexporte — Einbettung über `assemble.py` |
| `addon/` | Lua 5.1 / Interface 30300 |
| `scripts/` | Build/Check/Pipeline/Zip/Sync (Bash + PowerShell) |
| `tests/` | Daten-Sanity + Export-Parse (Python + Node-Harness) |
| `Makefile` | Wrapper um `scripts/*.sh` |
| `docs/` | Diese Übersicht (**nicht** Pages-Quelle) |

## `scripts/`

| Skript | Zweck |
|---|---|
| `build.sh` / `build.ps1` | `pipeline/assemble.py` → `index.html` + `synergien.html` |
| `check.sh` / `check.ps1` | JS-Syntax + optional `luac` auf Addon-Lua |
| `pipeline-all.sh` / `pipeline-all.ps1` | Offline- (+ optional DBC-) Datenpipelines |
| `package-addon.sh` / `package-addon.ps1` | `AscBuildschmiede.zip` aus `addon/` neu bauen |
| `sync-addon.ps1` | Live-AddOns-Sync (Windows) + Zip |

## `tests/`

| Datei | Zweck |
|---|---|
| `test_data_sanity.py` | Kataloglänge / Mechanik-Spannen (Plausibilität) |
| `test_export_parse.py` | `parseExport` gegen `data/testexport-*.txt` |
| `parse_export_harness.js` | Node-Extraktion von `parseExport` aus `builder-app.js` |

## Assemble (`pipeline/assemble.py`)

Liest `src/` + `data/`, schreibt `index.html` und `synergien.html`.  
Pflicht-Payload (`D.*`): `cat`, `rel`, `arch`, `spr`, `cdg`, `bm`, `tag`, `sc`, `mc`, plus `sid`/`eid` aus `spellids.json` und eingebettetes `sprite.webp`.  
Optional (fehlen stillschweigend): `meth`, `tree`, `des`, `stags`, `tagn`, `ssug`, `ssugsp`, `iic` (Item-Icons nur wenn ≤ 512 KB).

```bash
python3 pipeline/assemble.py
# oder: ./scripts/build.sh
```

## Pipeline → `data/`

Jedes produktive Skript schreibt in der Regel **eine** Datei nach `data/`.

| Skript | Ausgabe | Client-DBC? |
|---|---|---|
| *(extern / Seed)* | `catalog.json`, `relations.json`, `archetypes.json`, `cdgroups.json` | nein |
| `modifiers.py` | `basemods.json` | nein |
| `pathtags.py` | `pathtags.json` | nein |
| `scaling.py` | `scaling.json` | nein |
| `spellids.py` | `spellids.json` | nein (`CatalogData.lua`) |
| `mechanics.py` | `mechanics.json` | **ja** |
| `methods.py` | `methods.json` | nein |
| `statsuggest.py` | `statsuggest.json` | **ja** |
| `spellsuggest.py` | `spellsuggest.json` | **ja** |
| `desireelig.py` | `desireelig.json` | nein |
| `spectags.py` | `spectags.json` | nein |
| `tagnames.py` | `tagnames.json` | **ja** |
| `_method_spelltags.py` | `method-spelltags.json` | **ja** |
| `itemicons.py` | `itemicons.json` | **ja** |
| `dbcicons.py` + `mksprite.py` | `sprite.webp`, `spriteindex.json` | **ja** (Icons) |

Ohne lokalen Client bleiben vorhandene `data/`-Dateien stehen — Assemble funktioniert weiter.

### Hilfs- / Recherche-Skripte

| Skript | Rolle |
|---|---|
| `sync_tooltips.py` | Katalog-Tooltips an Spell.dbc-Beschreibungen angleichen |
| `check_collisions.py` | Namenskollisionen im Katalog melden |
| `effects.py` | Untersuchung (nicht Teil des Builds) — EffectBasePoints unbrauchbar |
| `probe_*.py` | Read-only DBC/API-Recherche → `NOTES-*.md` |
| `mkchrome.py` | Lokales Tooling; **Seiten-Chrome kommt aus `src/` (CSS)** — keine Client-BLP-Rahmen ins Repo |

## Addon

Quelle: `addon/AscBuildschmiede/` (`.toc` + Lua).  
Nach Änderungen: `luac5.1 -p`, dann `scripts/package-addon.*`, Zip mitcommitten.

## Verifizieren (Kurz)

```bash
make build && make check
# Windows: .\scripts\build.ps1 ; .\scripts\check.ps1
python -m unittest discover -s tests -v
python3 -m http.server
```

Root prüfen: `index.html`, `synergien.html`, `AscBuildschmiede.zip`.  
Mehr: [CONTRIBUTING.md](../CONTRIBUTING.md), [AGENTS.md](../AGENTS.md).

## Lizenz

Keine `LICENSE`-Datei im Repo (Stand dieser Doku). Vor Weitergabe klären; Client-Extrakte nicht committen.
