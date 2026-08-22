# AscBuildschmiede Companion

Companion-Addon für die [Buildschmiede](https://lzra2000.github.io/aldi-buildschmiede/)
(Project Ascension, Season 10 Wildcard). Exportiert den Charakter als Text — **kein
Netzwerk**, kein Autoupload.

| | |
|---|---|
| **Version** | 1.5.6 |
| **Export-Format** | `BS.FORMAT` = **1** (additiv; alte Exporte bleiben lesbar) |
| **Interface** | 30300 (WoW 3.3.5a) |

## Installation

1. [AscBuildschmiede.zip](https://github.com/lzra2000/aldi-buildschmiede/raw/main/AscBuildschmiede.zip) laden
2. Entpacken nach `Interface\AddOns\` → Ordner `AscBuildschmiede\` mit `.toc` und Lua-Dateien
3. Client neu starten, dann **`/bs`**

Entwickler: Zip und optional Live-Kopie mit `scripts/package-addon.ps1` (oder `.sh`).

## Slash-Befehle

| Befehl | Wirkung |
|---|---|
| `/bs` | Exportfenster auf/zu (Text markieren, Strg+C → Seite unter Einfügen) |
| `/bs target` | Build des Ziels auslesen (für Vergleich auf der Seite) |
| `/bs gear` | Gear im Export an/aus |
| `/bs stats` | Stats und Waffen an/aus |
| `/bs help` | Kurzhilfe |

Alias: `/buildschmiede`.

## Entwickeln / Packen

```powershell
.\scripts\package-addon.ps1          # luac -p, Zip, Live-Sync wenn Pfad da
.\scripts\package-addon.ps1 -NoLive  # ohne Live-Kopie
.\scripts\package-addon.ps1 -Live    # Live-Sync erzwingen
```

Live-Ziel (AGENTS.md):  
`C:\Ascension\Launcher\resources\ascension-live\Interface\AddOns\AscBuildschmiede\`

Zip-Layout: `AscBuildschmiede/*` im Archiv-Root.
