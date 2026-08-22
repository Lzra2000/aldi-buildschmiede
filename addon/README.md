# AscBuildschmiede Companion

Companion-Addon für die [Buildschmiede](https://lzra2000.github.io/aldi-buildschmiede/)
(Project Ascension, Season 10 Wildcard). Exportiert deinen Charakter als Text —
**kein Netzwerk**, kein Autoupload. Du kopierst den Block selbst in die Seite.

| | |
|---|---|
| **Version** | 1.5.10 |
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
| `/bs` | Exportfenster auf/zu. Text markieren, Strg+C, auf der Seite unter Einfügen einfügen. |
| `/bs target` | Build des Ziels auslesen (für den Vergleich auf der Seite). |
| `/bs gear` | Gear in **deinem** Export an/aus (siehe unten). |
| `/bs stats` | Stats und Waffen (`STAT` / `WEAPON`) an/aus. |
| `/bs help` | Kurzhilfe |

Alias: `/buildschmiede`.

### `/bs gear`

Gear steht in deinem eigenen Export standardmäßig **an**. Mit `/bs gear`
schaltest du die Zeilen `ILVL` und `GEAR|…` aus oder wieder ein. Die Wahl
bleibt gespeichert; das Fenster aktualisiert sich sofort.

Jede Gear-Zeile trägt Slot, Name, Itemlevel, Qualität und Untertyp. Wenn der
Item-Link sie liefert, folgen Item-ID plus Verzauberung und Sockel. Die Seite
braucht die Item-ID für Icons und iLvl-Bänder.

`/bs target` liest das Gear des Ziels immer mit, sofern der Client es liefert.
Der Schalter gilt nur für deinen eigenen Export.

`/bs stats` ist unabhängig davon: aus schaltet Stats und Waffen, nicht die
Rüstungsslots.

## Skill Cards (ab 1.5.7)

Sobald die Client-API Daten liefert, hängt der Export Skill-Karten an — auch
außerhalb von Wildcard. Ab Addon **1.5.7** trägt jedes belegte Token die
Spell-ID der Karte (`:sSPELLID`). Die Seite löst den Namen über den Katalog,
nicht über `cardId`. `BS.FORMAT` bleibt 1; ältere Exporte ohne `:s…` bleiben
lesbar.

```
SCARD|DEFAULT_NORMAL:cardId@0:q3:A:sSPELLID;…
CARDED|sid;sid
SCARDPEND|n
```

| Token | Bedeutung |
|---|---|
| `TAG:cardId@index` | Deck und Slot (Index 0-basiert) |
| `:qN` | Qualität, wenn die API sie liefert |
| `:A` | aktiver Slot |
| `:sSPELLID` | Spell der Karte (ab 1.5.7) |
| `TAG:B@index` | blockierter leerer Slot |

`CARDED` listet Spell-IDs, die auf einer Karte liegen. `SCARDPEND` ist die
Anzahl ausstehender Karten — nur wenn die Collection-API greift.

Deck-Tags: `DEFAULT_NORMAL`, `DEFAULT_GOLDEN`, `STARTER_NORMAL`,
`STARTER_GOLDEN`, `LUCKY_NORMAL`, `LUCKY_GOLDEN`, `TALENT_NORMAL`,
`TALENT_GOLDEN`.

## Entwickeln / Packen

```powershell
.\scripts\package-addon.ps1          # luac -p, Zip, Live-Sync wenn Pfad da
.\scripts\package-addon.ps1 -NoLive  # ohne Live-Kopie
.\scripts\package-addon.ps1 -Live    # Live-Sync erzwingen
```

Live-Ziel (AGENTS.md):  
`C:\Ascension\Launcher\resources\ascension-live\Interface\AddOns\AscBuildschmiede\`

Zip-Layout: `AscBuildschmiede/*` im Archiv-Root.
