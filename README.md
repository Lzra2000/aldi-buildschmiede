# Aldi Ehrfürchtig — Buildschmiede

**Live auf GitHub Pages:**
[**Builder**](https://lzra2000.github.io/aldi-buildschmiede/) ·
[**Synergien**](https://lzra2000.github.io/aldi-buildschmiede/synergien.html) ·
[**Addon-Zip**](https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip)

Deutsch · Project Ascension · Season 10 Wildcard · fürs **Leveln 10–59** (nicht Raid-Endgame).  
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

## English (short)

Leveling tools (10–59) for Ascension Season 10 Wildcard.  
Live: [Builder](https://lzra2000.github.io/aldi-buildschmiede/) · [Synergies](https://lzra2000.github.io/aldi-buildschmiede/synergien.html) · [Addon zip](https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip).  
In-game `/bs` exports your character for paste-into-site. No invented spell numbers.

---

## Lokal / Entwickler

```bash
python3 -m http.server          # http://localhost:8000/
python3 pipeline/assemble.py    # baut index.html + synergien.html neu
```

Quelle: `src/`, Daten: `data/`, Pipeline: `pipeline/`, Addon: `addon/`.  
Für Pages mitcommitten: `index.html`, `synergien.html`, bei Addon-Änderung `AscBuildschmiede.zip`.  
Regeln: [AGENTS.md](AGENTS.md) · Mitmachen: [CONTRIBUTING.md](CONTRIBUTING.md).

GitHub Pages: Branch **`main`**, Ordner **`/`** → https://lzra2000.github.io/aldi-buildschmiede/
