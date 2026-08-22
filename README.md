# Aldi Ehrfürchtig — Buildschmiede

Werkzeuge für **Project Ascension**, Season 10 Wildcard — für Gildenmitglieder beim **Leveln (10–59)**, nicht für Endgame-Raid.

Zwei HTML-Seiten und ein Companion-Addon. Zahlen kommen aus Katalog/DBC/Export — nichts Erfundenes.

---

## Live (GitHub Pages)

| | Link |
|---|---|
| **Builder** | https://lzra2000.github.io/aldi-buildschmiede/ |
| **Synergien** | https://lzra2000.github.io/aldi-buildschmiede/synergien.html |
| **Addon-Download** | [AscBuildschmiede.zip](https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip) |

---

## Was steckt drin?

- **Buildschmiede** — Katalog durchsuchen, Build zusammenstellen, Warnungen (Doppeln, Voraussetzungen, Skalierung), Path-Empfehlung, Teilen per Link. Addon-Export einfügen → Befund zum echten Charakter.
- **Synergiekompendium** — was mit was zusammenspielt, woraus Schaden/Heilung skalieren.
- **Companion-Addon** — im Spiel `/bs`: Export als Text (Abilities, Talente, Path, Stats, Gear, Budget). Auf der Seite einfügen. `/bs target` liest den Build des Ziels (Vergleich).

---

## English (short)

Build tools for Ascension Season 10 Wildcard, aimed at **leveling 10–59**. Live builder + synergies pages above; download `AscBuildschmiede.zip`, unzip into `Interface\AddOns\`, then `/bs` in-game to export your character into the site. No invented spell numbers.

---

## Addon installieren

1. [AscBuildschmiede.zip](https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip) herunterladen.
2. Nach `Interface\AddOns\` entpacken → `Interface\AddOns\AscBuildschmiede\AscBuildschmiede.toc`.
3. Client neu starten, dann **`/bs`**.

| Befehl | Wirkung |
|---|---|
| `/bs` | Fenster auf/zu |
| `/bs target` | Build des Ziels auslesen |
| `/bs gear` | Gear im Export an/aus |
| `/bs stats` | Stats und Waffen an/aus |

Das Addon geht **nicht** ins Netz — nur Text im Fenster zum Selbstkopieren.

---

## Lokal öffnen

Kein Bundler, keine Dependencies. Repo-Root:

```bash
python3 -m http.server
```

Dann http://localhost:8000/ und http://localhost:8000/synergien.html — oder die HTML-Dateien direkt im Browser öffnen.

Seite neu bauen (nach Änderungen an `src/` / `data/`):

```bash
python3 pipeline/assemble.py
```

---

## Für Entwickler

- Quelle: `src/`, Daten: `data/`, Pipeline: `pipeline/`, Addon: `addon/`
- Gebaut (für Pages mitcommitten): `index.html`, `synergien.html`, `AscBuildschmiede.zip`
- Arbeitsregeln und Fallen: **[AGENTS.md](AGENTS.md)** · kurze Mitmach-Hinweise: **[CONTRIBUTING.md](CONTRIBUTING.md)**

GitHub Pages liefert aus dem **Root von `main`** — ohne gepushte HTML-Dateien bleibt die Live-Seite alt.
