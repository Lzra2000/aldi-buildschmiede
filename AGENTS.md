# AGENTS.md — Aldi Ehrfürchtig Buildschmiede

Werkzeuge für Project Ascension, Season 10 Wildcard: ein Build-Builder als
einzelne HTML-Datei, ein Synergie-Nachschlagewerk und ein Companion-Addon
für den Spielclient.

Zielgruppe der Seite sind Gildenmitglieder, die **10–59 leveln** — nicht
Endgame-Raid. Wenn eine Entscheidung zwischen „für Level 60 korrekt" und
„für einen Levelrun nützlich" steht, gewinnt der Levelrun.

---

## Bauen

```bash
python3 pipeline/assemble.py
```

Liest `src/` und `data/`, schreibt `index.html`. Sonst nichts — kein
Bundler, keine Abhängigkeiten, kein Node.

Danach prüfen:

```bash
node -e 'new Function(require("fs").readFileSync("src/builder-app.js","utf8"))'
```

Der Rest der Prüfung läuft im Browser, siehe **Verifizieren**.

---

## Ablage

```
index.html          gebaut — nicht von Hand bearbeiten
synergien.html      gebaut
AscBuildschmiede.zip gebaut aus addon/

src/                Quelle der Seite
  builder-head.html   <title>, CSS, Farbtokens
  builder-body.html   Markup
  builder-app.js      die gesamte Logik, eine IIFE
pipeline/           Datenaufbereitung (Python 3, nur Standardbibliothek)
data/               Ergebnis der Pipeline, wird eingebettet
addon/              Lua-Quelle des Companion-Addons
```

### `src/builder-app.js` ist die Quelle der Wahrheit

Die Datei ist historisch durch eine Reihe von Patch-Skripten gewachsen.
**Diese Skripte sind weg und kommen nicht zurück.** Änderungen gehen direkt
in die Datei. Wer wieder anfängt, JavaScript per Python-`str.replace` zu
erzeugen, baut sich die nächste unwartbare Schicht.

---

## Datenpipeline

Jedes Skript schreibt genau eine Datei nach `data/`. `assemble.py` bettet
sie über die Tabelle `PAYLOAD` ein; im JS liegen sie als `D.<schlüssel>`.

| Skript | erzeugt | Quelle | braucht Client |
|---|---|---|---|
| — | `catalog.json` | Season10Builder-Repo | nein |
| — | `relations.json` | ebd. | nein |
| — | `archetypes.json`, `cdgroups.json` | ebd. | nein |
| `modifiers.py` | `basemods.json` | `catalog.json` | nein |
| `pathtags.py` | `pathtags.json` | `catalog.json` | nein |
| `scaling.py` | `scaling.json` | `catalog.json` | nein |
| `spellids.py` | `spellids.json` | `data/CatalogData.lua` | nein |
| `mechanics.py` | `mechanics.json` | `Spell.dbc` + `spellids.json` | **ja** |
| `dbcicons.py`, `mksprite.py` | `sprite.webp`, `spriteindex.json` | `Spell.dbc`, `SpellIcon.dbc`, BLP-Icons | **ja** |

Die client-abhängigen Schritte laufen nur mit lokal entpackten DBC-Dateien.
Die Pfade stehen oben in den jeweiligen Skripten. Ohne Client bleiben die
vorhandenen `data/`-Dateien einfach stehen — die Seite baut trotzdem.

---

## Regeln, die nicht verhandelbar sind

**Keine extrahierte Client-Lua ins Repo.** Der entpackte Ascension-Client
enthält proprietären Blizzard-/Ascension-Code. Er ist Nachschlagewerk für
API-Recherche, mehr nicht. Was hier liegen darf: selbst geschriebener Code,
die öffentlichen Season10Builder-Daten und daraus abgeleitete Zahlen.

**Nichts raten, was nicht in den Daten steht.** Wenn ein Tooltip den
Spell-Power-Anteil eines Zaubers nicht nennt, dann steht auf der Seite, dass
er fehlt — es wird kein Koeffizient erfunden. Der ganze Wert dieses Werkzeugs
liegt darin, dass man den Zahlen trauen kann. Eine plausible erfundene Zahl
ist schlimmer als eine fehlende.

**Die Seite bleibt eigenständig.** Ein Artifact läuft unter strenger CSP:
erlaubt sind nur Google Fonts. Kein CDN, kein Fetch, keine externen Bilder.
Alles wird eingebettet.

### Kein Sprachmodell in der Seite

Die Buildschmiede ruft bewusst kein Modell auf. Dafuer muesste ein
API-Schluessel in `index.html` stehen — einer oeffentlich ausgelieferten
Datei. Stattdessen baut `buildPrompt()` einen vollstaendigen Prompt
(Charakterwerte, Build mit allen Zahlen, die Ascension-Regeln, konkrete
Fragen), den der Nutzer selbst in ein Modell einfuegt.

Wer das aendern will: der Schluessel gehoert dann in einen kleinen Proxy
mit Rate-Limit, nie in die Seite. Und die Seite muss ohne den Proxy
weiterlaufen — sie liegt auf GitHub Pages und soll offline funktionieren.

---

## Fallen, die schon zugeschnappt sind

Jede davon hat echte Zeit gekostet. Bitte nicht wiederholen.

### Sprite

`iconStyle(i, size)` muss **Position und `background-size` gemeinsam**
skalieren. Wer nur `background-size` überschreibt, um Icons kleiner
darzustellen, verschiebt den Ausschnitt ins Leere — die Icons verschwinden
still, und vereinzelte Zufallstreffer lassen es wie ein Datenproblem
aussehen. Es ist keins.

### Umlaute

`text-transform: uppercase` lässt in Chrome Umlaute klein stehen:
„ÜBERNEHMEN" wird zu „Übernehmen" mitten im Großbuchstabentext. Deshalb
tragen Labels mit möglichen Umlauten **kein** `uppercase`. Wer eine neue
Label-Klasse anlegt, macht es genauso.

### Spell.dbc (3.3.5a, Standardlayout)

- **Niemals über den Namen zuordnen.** „Charge" gibt es als
  Kriegerfähigkeit und als Jäger-Petspell; die Namenssuche wählt
  verlässlich den falschen. `data/CatalogData.lua` führt die echte
  `spellId` mit — 3071 von 3071 zugeordnet. Immer die nehmen.
- **Wut und Runenmacht liegen in Zehnteln vor.** 600 in der DBC sind 60 im
  Spiel. Plausibilitätsanker: Wut ist bei 100 gedeckelt.
- **`SpellRange.dbc` speichert Floats.** Als Integer gelesen wird aus 5,0 m
  eine Reichweite von 1.084.227.584.
- **`SpellCastTimes` führt Sonderfälle negativ.** Unsigned gelesen bekommt
  Kill Shot 4.293.967 Sekunden Castzeit. Vorzeichenbehaftet lesen und
  Werte ≤ 0 verwerfen.
- **`procChance` steht meist auf 101** („immer"). Nur Werte zwischen 1 und
  99 sind echte Proc-Chancen.
- **`EffectBasePoints` taugt nicht als Schadensquelle.** Schon untersucht,
  Ergebnis negativ, Details in `pipeline/effects.py`. Kurzfassung: bei
  eigenständigen Zaubern stimmt die DBC fast mit dem Tooltip überein, bei
  Schulvarianten („uses X modifiers") ist der DBC-Eintrag ein Stummel —
  Water Nova zeigt 496 Schaden, in der DBC stehen 14–17, die Werte von
  Frost Nova Rang 1. Die Faktoren reichen von 0,4× bis 197×, es gibt also
  keinen Umrechnungsfaktor. **Der Beschreibungstext bleibt die Quelle für
  Schadenszahlen.** Bitte nicht ein zweites Mal untersuchen.

### Was wo steht

Die beiden Datenquellen ergänzen sich, sie überlappen kaum:

| | Client-DBC | Beschreibungstext |
|---|---|---|
| Cooldown, Castzeit, Reichweite, Wirkdauer | **ja** | fast nie |
| Ressourcen**kosten** | **ja** | nein |
| Ressourcen**gewinn** | nein | **ja** |
| Schadenszahlen | unbrauchbar (s.&nbsp;o.) | **ja** |
| Waffenprozente, Multiplikatoren, Procs | nein | **ja** |

Wer eine neue Zahl braucht, sieht zuerst hier nach, welche Seite sie
überhaupt führt.

### Spielmechanik

- **Eine Schulvariante erbt die TALENTE ihrer Basis, nicht die Basis
  selbst.** „This uses Slam modifiers" heißt: Burning Slam profitiert von
  Slam-Talenten. Ob Slam im Build steht, ist egal. Wer auf die
  Basisfähigkeit prüft, meldet falsche Warnungen.
- **Spell Power und Attack Power zählen für Waffenschaden gleich**, im
  Verhältnis 14 : 1 pro Waffen-DPS. Der Waffenschaden im Charakterfenster
  enthält beide bereits — nicht doppelt draufrechnen.
- **Alle Ressourcenpools existieren gleichzeitig.** Ein Build mit Wut- und
  Energiekosten ist kein Fehler.
- **Seltenheit ist ein Budget**, nicht nur ein Farbcode
  (`GetQualityCount` gegen `GetQualityLimit`). Ohne importierten Charakter
  ist die Grenze unbekannt — dann anzeigen statt blockieren.

---

## Companion-Addon (`addon/`)

WoW 3.3.5a, Interface 30300, Lua 5.1. Ladereihenfolge steht in der `.toc`
und ist relevant: `Core` definiert den Namensraum, alles andere hängt
daran.

```
/bs           Fenster auf/zu
/bs target    Build des Ziels auslesen (asynchron, siehe unten)
/bs gear      Gear im Export an/aus
/bs stats     Stats und Waffen an/aus
```

Verwendete Ascension-APIs, alle im Client-Extract verifiziert:

| API | wofür |
|---|---|
| `C_CharacterAdvancement.GetKnownSpellEntries()` | gelernte Abilities |
| `C_CharacterAdvancement.GetKnownTalentEntries()` | gelernte Talente |
| `C_CharacterAdvancement.GetTalentRankByID(id)` | Talentrang |
| `C_CharacterAdvancement.GetQualityCount/Limit(q)` | Seltenheits-Budget |
| `C_CharacterAdvancement.GetQualityInfo(spellID)` | Kosten gegen das Budget |
| `C_CharacterAdvancement.InspectUnit(unit)` | Ziel auslesen anstoßen |
| `C_CharacterAdvancement.GetInspectedBuild(unit)` | Ergebnis abholen |
| `C_CharacterAdvancement.ExportBuild(true)` | offizieller Build-Code |
| `C_PrimaryStat:GetActivePrimaryStat()` | eigener Path |
| `C_PrimaryStat:GetUnitPrimaryStat(unit)` | Path des Ziels |

**Der Path heißt im Client `PrimaryStat`.** Deshalb findet man ihn nicht,
wenn man nach „Path" sucht. Die Zuordnung ist
1 Strength, 2 Agility, 3 Intelligence, 4 Spirit, 6 Duality — und **4 wird
in der Oberfläche als „Healing" angezeigt**.

Regeln fürs Addon:

- Jeder Aufruf einer Ascension-API läuft durch `BS.Safe` (`pcall`). Realms
  unterscheiden sich; eine fehlende Funktion darf höchstens eine Zeile im
  Export kosten, nie den Export.
- Inspect ist asynchron: anstoßen, auf
  `INSPECT_CHARACTER_ADVANCEMENT_RESULT` warten, nach acht Sekunden
  aufgeben. Nicht endlos horchen.
- Das Addon schickt nichts ins Netz. Es schreibt Text in ein Fenster, den
  der Spieler selbst kopiert. Das bleibt so.
- **`pcall` ohne Fehler heißt nicht, dass es gewirkt hat.** Ein vom Server
  ignoriertes Paket ist kein Lua-Fehler. Wenn eine Aktion einen Zustand
  ändern soll, den Zustand danach prüfen.

Nach jeder Änderung:

```bash
luac5.1 -p addon/AscBuildschmiede/*.lua
```

---

## Exportformat (Addon → Seite)

Zeilenbasiert, Felder mit `|`, Listen mit `;`. Der Parser in
`builder-app.js` (`parseExport`) ist **absichtlich nachsichtig**:
unbekannte Zeilen werden übersprungen, nicht abgelehnt. Ein neues Feld im
Addon bricht also keine ältere Seite.

```
=== BUILDSCHMIEDE v1 ===
CHAR|Name|Level|Rasse|Klasse
PATH|Intelligence
ESSENCE|A:1|T:1
STAT|STR:69|AGI:51|...|SP:608|CRIT:5.97|...
WEAPON|MH|Name|ilvl18|speed2.68|287-315|dps115.7|INVTYPE_2HWEAPON|Staff
ILVL|18.00
GEAR|Slot|Name|ilvl|quality|subtype
QUALITY|Uncommon:4/12|Rare:3/8|Epic:2/4|Legendary:1/2
QCOST|Uncommon:1|Rare:1|Epic:1|Legendary:1
ABI|Name;Name;…
TAL|Name:Rang;Name:Rang;…
COUNT|A:10|T:8
CODE|<ExportBuild-Code>
INSPECT|1            (nur bei /bs target)
=== ENDE ===
```

Wer das Format erweitert: neues Schlüsselwort in `parseExport` ergänzen,
Version `BS.FORMAT` nur erhöhen, wenn alte Exporte **nicht** mehr lesbar
wären.

---

## Verifizieren vor dem Commit

1. `python3 pipeline/assemble.py` läuft durch.
2. `node -e 'new Function(...)'` auf `src/builder-app.js` — kein Syntaxfehler.
3. Seite lokal öffnen (`python3 -m http.server`) und **messen, nicht
   angucken**: Konsole leer, betroffene Werte per `javascript_tool`
   auslesen und gegen den erwarteten Wert prüfen.
4. Bei Datenänderungen: Spannen auf Plausibilität prüfen. Wut über 100,
   Reichweiten über 100 m oder Castzeiten über 10 s sind Parserfehler,
   keine Spielwerte.
5. Bei UI-Änderungen mit Charakterbezug: `data/`-Testexport einspielen und
   prüfen, dass Befund, Path-Empfehlung und Budget zusammenpassen.
6. `index.html` mitcommitten — GitHub Pages liefert die gebaute Datei aus.

Ein Fehler in einer Zahl ist hier schlimmer als ein Fehler im Layout. Die
Leute treffen danach Entscheidungen über ihren Charakter.
