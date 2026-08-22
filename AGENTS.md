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

### Aufbau der Oberfläche

Fünf Ansichten, umgeschaltet über den Kopfbalken; nur eine ist gleichzeitig
sichtbar (`.view.on`). `showView()` schaltet um, sonst nichts.

| Ansicht | Zweck |
|---|---|
| `vBuild` | Katalog links, Build und Vorschläge rechts |
| `vAnalyse` | Befund, Path, Stat-Priorität, Skalierung, Struktur — als Karten nebeneinander |
| `vChain` | Wirkungsketten: was zahlt auf was ein |
| `vTools` | Import, Generator, KI, Vergleich, Archetypen, Teilen |
| `vWissen` | Nachschlagewerk (vier Reiter) |

Zähler stehen teils doppelt (Kopfbalken und Panel-Kopf). `syncHeader()`
spiegelt sie; wer einen neuen anlegt, trägt ihn dort ein, statt ihn zweimal
zu berechnen.

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
| `methods.py` | `methods.json` | catalog + scaling + mechanics + basemods + relations (+ CatalogData rollgate) | nein |
| `statsuggest.py` | `statsuggest.json` | `SpellStatSuggestions.dbc` ∩ Katalog | nein |
| `spellsuggest.py` | `spellsuggest.json` | `SpellSpellSuggestions.dbc` ∩ Katalog (Top-N) | nein |
| `desireelig.py` | `desireelig.json` | `CatalogData.lua` (`desiredEligible`) | nein |
| `itemicons.py` | `itemicons.json` | `Item.dbc` + `ItemDisplayInfo.dbc` (nur Testexport-ItemIds) | **ja** |
| `dbcicons.py`, `mksprite.py` | `sprite.webp`, `spriteindex.json` | `Spell.dbc`, `SpellIcon.dbc`, BLP-Icons | **ja** |

Optional in `assemble.py` (`OPTIONAL_PAYLOAD`, fehlen stillschweigend):
`meth` ← `methods.json`, `tree` ← `spectags.json`, `des` ← `desireelig.json`,
`stags` ← `method-spelltags.json`, `tagn` ← `tagnames.json`,
`ssug` ← `statsuggest.json` (Path-Hints), `ssugsp` ← `spellsuggest.json`
(Related-Spell-Graph — **nicht** mit `ssug` verwechseln),
`iic` ← `itemicons.json` (flach `itemId → iconName`, nur Export-/Seed-Ids;
Einbettung nur wenn Datei ≤ 512 KB — kein Vollscan von Item.dbc).

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

### KI-Anbindung: der Schlüssel gehört dem Nutzer

Die Seite ruft Sprachmodelle direkt auf (Reiter **KI**), aber **niemals mit
einem Schlüssel aus dieser Datei.** `index.html` wird öffentlich
ausgeliefert; ein Schlüssel darin wäre binnen Stunden abgegrast und liefe
auf fremde Rechnung. Stattdessen:

- Jeder Nutzer trägt seinen eigenen Schlüssel einmal ein, er landet im
  `localStorage` **seines** Browsers (`aldi-buildschmiede-ai`).
- Der Schlüssel geht ausschließlich als Header an den gewählten Anbieter,
  nie in den Request-Body und an keine dritte Stelle. Beim Ändern bitte
  nachmessen, nicht annehmen: `fetch` abfangen und prüfen, wohin was geht.
- Zwei Anbieter sind hinterlegt (`PROVIDERS`), Anthropic und OpenAI. Ein
  neuer braucht `url`, `headers()`, `body()` und `read()` — sonst nichts.
- Anthropic verlangt für Browseraufrufe den Header
  `anthropic-dangerous-direct-browser-access: true`.

**Im Claude-Artifact funktioniert das nicht** — dort sperrt die CSP externe
Aufrufe. Das ist kein Fehler, und der Fehlerpfad sagt es dem Nutzer und
verweist auf GitHub Pages. Nicht „reparieren".

Weil kein Modell 3.071 Einträge im Prompt lesen kann, macht der Code die
Vorauswahl: `aiShortlist()` filtert auf 120 Kandidaten nach derselben
Bewertung wie der Generator, das Modell entscheidet daraus. Wer die Zahl
erhöht, treibt Kosten und Halluzinationsrisiko gleichzeitig hoch.

`buildPrompt()` bleibt daneben bestehen und liefert denselben Inhalt zum
Kopieren — für alle ohne Schlüssel.

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

Nach jeder Änderung: `luac5.1 -p addon/AscBuildschmiede/*.lua`, dann **zwingend** nach
`C:\Ascension\Launcher\resources\ascension-live\Interface\AddOns\AscBuildschmiede\`
kopieren (Repo = Quelle) und `AscBuildschmiede.zip` aus `addon/` neu bauen
(Layout `AscBuildschmiede/...`).

---

## Exportformat (Addon → Seite)

Zeilenbasiert, Felder mit `|`, Listen mit `;`. Der Parser in
`builder-app.js` (`parseExport`) ist **absichtlich nachsichtig**:
unbekannte Zeilen werden übersprungen, nicht abgelehnt. Ein neues Feld im
Addon bricht also keine ältere Seite. `BS.FORMAT` bleibt **1** (additiv);
Addon-Version aktuell **1.5.3**. Manuelle Testexporte: `data/testexport-*.txt`.

```
=== BUILDSCHMIEDE v1 ===
ADDON|1.5.3
CHAR|Name|Level|Rasse|Klasse
PATH|Intelligence
PATHINFO|spellId|icon|name
PATHENTRY|entryId
PATHAURA|spellId
SUGGEST|Intelligence;Healing
ESSENCE|A:1|T:1|AS:42|TS:18|AX:43
INVEST|AE:42|TE:18|CP:3|TAB:class:spec:n;…
SPEC|1|Wildcard|CHR:1
MODE|WILDCARD|DRAFT|…
DESIRE|entryId;…
UNDESIRE|entryId;…
WC|CanRoll:0/1|Starting:0/1|…|RRAbi:cur/req/next|RRTal:cur/req/next|RepurchAbi:n|RepurchTal:n|CanRepurch:0/1
STARTCHOICE|entryId;…
STAT|STR:69|…|HITPCT:5.1|SHITPCT:8.2|EXP:12|EXPPCT:3.0|MP5:14|SPECPEN:0|HOLY:0|…
WEAPON|MH|Name|ilvl18|speed2.68|287-315|dps115.7|INVTYPE_2HWEAPON|Staff|19019|3832|0|0|0|0
ILVL|18.00
GEAR|Slot|Name|ilvl|quality|subtype|itemId[|ench|g1|g2|g3|g4]
QUALITY|Uncommon:4/12|Rare:3/8|Epic:2/4|Legendary:1/2
QCOST|Uncommon:1|Rare:1|Epic:1|Legendary:1
QOWN|spellId:quality:cost;…
LOCK|entryId;entryId;…
ECOST|spellId:ae:te;…
MAST|spellId;…
TRAIT|entryId;…
ABI|Name#spellId@entryId;…
TAL|Name:Rang#spellId@entryId;…
COUNT|A:10|T:8
CODE|<ExportBuild-Code>
SCARD|DEFAULT_NORMAL:cardId@0:q3:A;…
CARDED|sid;sid
SCARDPEND|n
INSPECT|1            (nur bei /bs target)
SPECS|1;2            (nur Inspect, wenn unlockedSpecs)
=== ENDE ===
```

Additive Schlüssel ab Addon 1.4.0:

| Zeile | Format | Bedeutung |
|---|---|---|
| `ESSENCE` | `A:rem\|T:rem\|AS:spent\|TS:spent` | Remaining + ausgegeben (AS/TS) |
| `INVEST` | `AE:n\|TE:n\|CP:n` | Global AE/TE + Class Points |
| `SPEC` | `id\|name` | Aktive Spec (`name` optional) |
| `MODE` | `WILDCARD` | Nur wenn Wildcard-GameMode aktiv |
| `LOCK` | `entryId;…` | Gesperrte Entry-IDs |
| `ECOST` | `spellId:ae:te;…` | Essence-Kosten pro Spell |
| `MAST` | `spellId;…` | Mastery-Spells |
| `SCARD` | `DEFAULT_NORMAL:cardId@0;…` | Skill-Karten (Deck:Id@Slot) |
| `CARDED` | `sid;…` | Spell-IDs mit Karte |
| `GEAR` | `…\|itemId[\|ench\|g1\|g2\|g3\|g4]` | Felder 1–5 unverändert; ench/gems nur wenn ≠0 |
| `WEAPON` | `…\|itemId[\|ench\|g1…g4]` | wie GEAR, itemId = 9. Feld |
| `QOWN` | `spellId:quality:cost;…` | Budgetkosten der gelernten Einträge |
| `SPECS` | `id;…` | Inspect: freigeschaltete Specs |

Additive Schlüssel ab Addon 1.5.0 / 1.5.1 / 1.5.2 (FORMAT bleibt 1):

| Zeile | Format | Bedeutung |
|---|---|---|
| `ESSENCE` | `…\|AX:n` | Erwartete AE für aktuelles Level (`GetExpectedAE`) |
| `INVEST` | `…\|TAB:class:spec:n;…` | TE pro Klasse/Tab (`GetTabTEInvestment`, nur >0) |
| `SUGGEST` | `Path;Path;…` | Client-Path-Vorschläge (`GetSuggestedStats`) |
| `PATHINFO` | `spellId\|icon\|name` | PrimaryStat-Info |
| `PATHENTRY` | `entryId` | CA-Internal-ID des aktiven Path (`GetInternalID`) |
| `PATHAURA` | `spellId` | Path-Aura zum Abgleich |
| `MODE` | `WILDCARD\|DRAFT\|…` | Alle aktiven GameModes |
| `DESIRE` / `UNDESIRE` | `entryId;…` | Wildcard Desire/Undesire |
| `WC` | `CanRoll:0/1\|…\|RRPhase:s\|RRStop:s\|RRLearned:n\|RRDesired:0/1\|RRCanStart:0/1` | Wildcard-Roll-Status + Rapid-Rolling-Skalare (read-only; RR* nur wenn `GetRapidRollingState` greift) |
| `WC` | `…\|RRAbi:cur/req/next\|RRTal:cur/req/next` | Rapid-Roll-Breakpoints (ab 1.5.2) |
| `WC` | `…\|RepurchAbi:n\|RepurchTal:n\|CanRepurch:0/1` | Repurchase-Kontingent (ab 1.5.2; kein Cost) |
| `STARTCHOICE` | `entryId;…` | Offene Starting-Choice (`GetStartingChoiceEntries`) |
| `SCARD` | `…:qN` / `:A` / `TAG:B@i` | Qualität, aktiver Slot, blockiert |
| `SCARDPEND` | `n` | Ausstehende Skill Cards |
| `SPEC` | `…\|CHR:id` | CoA-Spec (`GetActiveChrSpec`, ab 1.5.1) |
| `TRAIT` | `entryId;…` | Draft-Traits (`IsTrait`, ab 1.5.1) |

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
6. Gebaute Dateien mitcommitten (`index.html`, `synergien.html`, bei Addon-Änderung
   auch `AscBuildschmiede.zip`) — GitHub Pages deployt **aus dem gepushten** Stand.
7. Nach jedem sinnvollen Ship: commit + `git push` (kein Force-Push), damit
   `lzra2000/aldi-buildschmiede` und Pages aktuell bleiben — siehe
   `.cursor/rules/full-agent-utilization.mdc`.

### GitHub Pages

Quelle: Branch **`main`**, Ordner **`/`** (Repo-Root). Live:
https://lzra2000.github.io/aldi-buildschmiede/ · Synergien:
`…/synergien.html`. Pages baut **nicht** aus `src/` — nur die mitgepushten
Artefakte. Kurz für Mitwirkende: `CONTRIBUTING.md`.

Ein Fehler in einer Zahl ist hier schlimmer als ein Fehler im Layout. Die
Leute treffen danach Entscheidungen über ihren Charakter.
