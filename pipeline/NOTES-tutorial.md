# NOTES — Tutorial-Texte (Erste-Schritte-Suite)

Stand: 2026-08-22. Docs-Lane. Live-Leiste `#tutRoot` in Body + JS
(`TUTORIAL` in `src/builder-app.js`, 9 Schritte, `localStorage`
`aldi-buildschmiede-tutorial`). Texte unten **nicht kürzen oder
anglisieren**. Kein Markup hier committen.

Anrede **du**. Kurze Sätze. Keine erfundenen SP/AP-Koeffizienten, keine
geratenen Proc-% oder GCD-Slots. Levelrun 10–59 und Endgame (Stufe 60,
Wildcard inklusive) sind gleichrangig.

Spielbegriffe bleiben: Path, Build, Addon, Import, Export, Skill Card,
Wildcard, GCD, Talent, Cooldown.

Tour-Chrome nutzt **Accent/Gold**, nicht Danger-Rot — siehe
`NOTES-ui-colors.md`.

---

## Auftrag an die JS-Lane

Eine wegklickbare Leiste, kein zweites Handbuch. Neun sichtbare Schritte
(unten „Live-Suite“). Die übrigen Texte sind `more` oder Reserve.

1. Titel + `text` **unverändert** übernehmen. `more` nur, wenn der Schritt
   ein aufgeklapptes Detail braucht.
2. Anker sind vorhandene IDs / Hash-Routen und `jumpTo` — keine neuen Views.
3. Zahlen nur aus schon sichtbaren Produktregeln. Fehlt ein Coeff: weglassen
   oder „steht nicht in den Daten“.
4. Nach JS-Ship: `node`-Syntaxcheck, `python3 pipeline/assemble.py`
   (schreibt **immer** `index.html` **und** `synergien.html`).
5. Chrome/Tokens/Nav nur mit Synergien-Lane. Diese Datei allein ändert
   keine Oberfläche.

Tour-Chrome (Live-Labels, Umlaute ohne `uppercase`):

| Rolle | Text |
|---|---|
| Weiter | Weiter |
| Zurück | Zurück |
| Letzter Schritt | Fertig |
| Abbruch | Überspringen |
| Schließen | Tutorial schließen (aria) |
| Dauerhaft weg | Fertig & nicht mehr zeigen |
| Wieder öffnen | Tutorial |
| Eingeklappt | Kurzanleitung zu Import, Befund und Synergien. |

---

## Anker (bestehende Fläche)

| Schritt | Hash / ID | Fläche |
|---|---|---|
| Start | `#` / `.startrow` / `#statusHint` | Erste Schritte, Statuszeile |
| Addon | `#t=rAddon` | Wissen → Addon |
| Import | `#t=vTools` / `#pasteBox` / `#bPaste` | Werkzeuge → Einfügen |
| Befund | `#t=vAnalyse` / `#issues` | Auswertung → Befund |
| Path | `#t=vAnalyse` / `#paths` | Auswertung → Path |
| Skill Cards | `#gearBox` / `.scard-panel` | Auswertung → Ausrüstung & Karten |
| Generator | `#t=vTools` dann `#t=tGen` / `#genbox` | Werkzeuge → Generator |
| Gleicher GCD | `synergien.html#regeln` oder `#dubletten` | Synergien |
| Synergien | `synergien.html` / Builder-Link `.slink` | eigene Page |
| Rahmen | `#vAnalyse` `.framectl` / `#frameHint` | Auswertung oben |

Leerzustände nicht „kaputt“ erklären: ohne Export zeigt der Befund wenig,
Karten fehlen ohne Wildcard-Export (Addon 1.5+), Generator läuft auch ohne
Import — Stufe und Budget sind dann unbekannt.

---

## Live-Suite (9 Schritte, in JS verdrahtet)

Reihenfolge fest. Synergien nicht weglassen — gleichrangig neben dem
Builder. Ohne Addon darf der Sprung „Zum Addon“ bleiben; der Import
funktioniert trotzdem.

| # | id | Titel | CTA |
|---|---|---|---|
| 1 | addon-start | Companion-Addon | Zum Addon |
| 2 | import-hint | Export einfügen | Zum Import |
| 3 | befund-open | Befund lesen | Zum Befund |
| 4 | path-open | Path-Empfehlung | Zum Path |
| 5 | cards-where | Skill Cards | Zur Ausrüstung |
| 6 | gen-open | Generator | Zum Generator |
| 7 | gcd-one | Gleicher GCD — ein Slot | Zu den Ketten · Synergien · Regeln |
| 8 | syn-open | Synergiekompendium | Synergien öffnen |
| 9 | frame-auto | Rahmen wählen | Zum Rahmen |

Reserve (nicht in der 9er-Leiste, Texte unten behalten): Addon-Install,
`/bs`, IDs, leerer Import, Path klicken, Karten einlösen, sechs Generator-
Ausrichtungen, Talent vs. GCD vs. CD, Synergien-Typen, Levelrun/Endgame-
Details, Fertig-Karte.

---

## Empfohlene Reihenfolge (Langform / Reserve)

Einstieg → Addon → Import → Befund → Path → Skill Cards → Generator →
Gleicher GCD → Synergien → Levelrun/Endgame → Fertig.

---

## 1 · Addon

### addon-start

**Anker:** `#t=rAddon`

**Titel:** Companion-Addon

**Text:** Mit dem Addon tippst du im Spiel `/bs`, kopierst den Text und
fügst ihn unter Werkzeuge ein. Dann kennt die Seite deinen echten Build —
Path, Essence, Budget, Gear und Skill Cards.

**more:** Das Addon schickt nichts ins Netz. Es schreibt nur Text in ein
Fenster. Was du kopierst, entscheidest du.

### addon-install

**Anker:** `#t=rAddon` · Liste `.steps ol`

**Titel:** Addon einhängen

**Text:** Zip laden, nach `Interface\AddOns\` entpacken, Spiel neu starten
oder `/reload`. Danach muss
`Interface\AddOns\AscBuildschmiede\AscBuildschmiede.toc` existieren — ein
Ordner zu tief ist der häufigste Fehler.

### addon-slash

**Anker:** `#t=rAddon` · Befehlstabelle

**Titel:** `/bs` im Spiel

**Text:** `/bs` öffnet das Fenster, der Text ist schon markiert:
Strg+C. `/bs gear` und `/bs stats` schalten Blöcke an oder aus, wenn der
Export zu lang ist.

**more:** `/bs target` liest den Build deines Ziels (asynchron, unter
Werkzeuge → Vergleich). `/bs help` zeigt die Kurzhilfe im Chat.

### addon-match

**Anker:** Wissen-Addon (Matching-Flag, falls noch sichtbar)

**Titel:** Zuordnung über IDs

**Text:** Fähigkeiten und Talente landen über die `spellId`, Gear über die
`itemId` — nicht über den Anzeigenamen.

---

## 2 · Import

### import-hint

**Anker:** `#t=vTools` · `#pasteBox`

**Titel:** Export einfügen

**Text:** Im Spiel `/bs` tippen, Strg+C, hier einfügen, dann
**Build übernehmen**. Installation steht unter Wissen → Addon.

### import-apply

**Anker:** `#bPaste`

**Titel:** Build übernehmen

**Text:** Danach füllen sich Charakterkarte, Befund und Path. Unbekannte
Zeilen überspringt der Parser — ein älteres Addon bricht die Seite nicht.

**more:** Addon 1.4+ liefert IDs, Essence, Locks und Gear. Skill Cards
kommen mit Wildcard-Export (1.5+); Namen pro Slot ab 1.5.7.

### import-empty

**Anker:** `#statusHint`

**Titel:** Noch kein Export

**Text:** Ohne Einfügen bleibt der Katalog leer von deinem Charakter.
Werkzeuge → Import mit `/bs` ist der kürzeste Weg.

---

## 3 · Befund und Path

### befund-open

**Anker:** `#t=vAnalyse` · `#issues`

**Titel:** Befund lesen

**Text:** Der Befund prüft Essence, Seltenheits-Budget, Path und Lücken
an deinem Import. Kritisch zuerst — das ist kein DPS-Ranking.

**more:** Freie Essence ausgeben, bevor du am Gear feilst. Über dem
Budget ist der Build im Spiel so nicht lernbar. Desire nimmt der
Generator bevorzugt, Undesire lässt er aus. Locks bleiben liegen.

### path-open

**Anker:** `#t=vAnalyse` · `#paths`

**Titel:** Path-Empfehlung

**Text:** Die Rangliste zählt, welcher Path zu deiner Auswahl passt —
mit Begründung, nicht als Geschmack. Deinen gespielten Path setzt das
Addon; hier siehst du, ob er zum Build steht.

**more:** Strength und Agility zählen Spell Power einfach, Duality
1,75-fach, Intelligence doppelt. Healing rechnet Spell Power zusätzlich
in Healing Power um. 14 Spell Power = 1 Waffen-DPS — derselbe Hebel gilt
für Waffenschaden. Der Waffentooltip ändert sich trotzdem nicht.

### path-pick

**Anker:** `#paths` · `.ranklist`

**Titel:** Path manuell setzen

**Text:** Ein Klick in der Liste setzt den Path für die Auswertung um.
Das ändert nichts im Spiel — nur die Rechnung auf dieser Seite.

---

## 4 · Skill Cards

### cards-where

**Anker:** `#t=vAnalyse` · `#gearBox`

**Titel:** Skill Cards

**Text:** Wildcard-Karten stehen rechts unter Ausrüstung. Belegt, aktiv
oder blockiert kommt aus dem Export — nicht aus dem Katalog geraten.

**more:** Ohne Karten: Addon 1.5+ und `/bs` neu kopieren. Fehlen nur die
Namen: Addon auf 1.5.7+ und nochmal exportieren. Gear extra mit
`/bs gear`, wenn das Paperdoll leer bleibt.

### cards-pending

**Anker:** Befund / Wildcard-Kasten

**Titel:** Karten einlösen

**Text:** Ausstehende Skill Cards musst du im Spiel noch ziehen. Hier
siehst du nur den Stand aus dem letzten Export.

### cards-gen

**Anker:** Generator-Hinweis (nach Import mit Karten)

**Titel:** Karten im Generator

**Text:** Zauber, die schon auf einer Karte liegen, bevorzugt der
Generator. Locks fasst er nicht an.

---

## 5 · Generator (Ausrichtungen)

Sechs Knöpfe in `#genbox` — `THEMES` in `builder-app.js`. Texte kurz
halten; die langen `d`-Sätze bleiben auf dem Generator selbst.

### gen-open

**Anker:** `#t=vTools` · Tab Generator · `#genbox`

**Titel:** Generator

**Text:** Eine Ausrichtung wählen — der Generator füllt Fähigkeiten und
passende Talente. Übernehmen ersetzt deine aktuelle Auswahl.

**more:** Mit Import gelten Stufe, Budget, Locks, Desire und Karten.
Ohne Import laufen die Themen trotzdem; Stufe und Budget sind dann
unbekannt. Modus folgt dem Rahmen (Levelrun oder Endgame).

### gen-ele

**Titel:** Elementarer Waffenkämpfer

**Text:** Waffenangriffe als Feuer, Frost oder Natur. Sie ignorieren
Armor und ziehen trotzdem vollen Nutzen aus Spell Power.

### gen-phys

**Titel:** Reiner Waffenkämpfer

**Text:** Physischer Waffenschaden. Geradlinig mit Waffe und Attack
Power — Armor gilt weiter.

### gen-cast

**Titel:** Zauberwirker

**Text:** Reine Sprüche ohne Waffenanteil. Der Path mit dem stärksten
Spell-Power-Multiplikator trägt hier am meisten.

### gen-dot

**Titel:** Schaden über Zeit

**Text:** Läuft auf mehreren Zielen weiter, während du das nächste
anfängst. Stark beim Leveln.

### gen-heal

**Titel:** Heiler

**Text:** Heilung als Hauptaufgabe. Dafür brauchst du Path of Healing —
sonst wird Spell Power nicht in Healing Power umgerechnet.

### gen-burst

**Titel:** Cooldown-Burst

**Text:** Wenige harte Treffer auf Cooldown statt Dauerfeuer. Gut gegen
einzelne dicke Ziele.

### gen-apply

**Anker:** `#bGenApply`

**Titel:** Auswahl ersetzen

**Text:** **Build übernehmen** schreibt die generierte Liste in deine
Auswahl. Dubletten mit gleichem GCD nimmt er nicht doppelt. Keine
erfundenen Schadenszahlen — nur Katalog, Tooltip-Skalierung und Budget.

---

## 6 · Gleicher GCD

Drei Regeln, nicht vermischen. Quelle: `relations.json` (`dupGroup` /
`cdGroup`) und Katalogtext — keine DBC-Heuristik, keine neuen Slots.

### gcd-one

**Anker:** `synergien.html#regeln` oder Builder-Ketten (`#t=vChain`)

**Titel:** Gleicher GCD — ein Slot

**Text:** Mehrere Katalogeinträge derselben Fähigkeit und Schulvarianten
in einer Dublettengruppe teilen sich **einen** globalen Takt. Burning
Slam und Frozen Slam sind nicht zwei parallele Drücke.

### gcd-not-talent

**Titel:** Nicht dieselbe Regel wie Talente

**Text:** „This uses Slam modifiers“ heißt: die Variante erbt die
**Talente** von Slam. Slam selbst muss nicht im Build stehen. Das sagt
nichts über den GCD.

### gcd-not-cd

**Titel:** Nicht derselbe Cooldown

**Text:** Kick und Counterspell teilen sich einen Ability-Cooldown —
eine Abklingzeit, nicht den Slam-GCD. Geteilter CD und gleicher GCD
sind zwei Listen.

### gcd-build

**Anker:** Auswertung / Ketten / Generator

**Titel:** Was das für dich heißt

**Text:** Nimm eine Schule pro Dublettengruppe. Analyse, Ketten und
Generator zählen sie als eine GCD — nicht als doppelten Takt.

---

## 7 · Synergien

Eigene Page, gleichrangig mit dem Builder. Nav bleibt in beide
Richtungen (`index.html` ↔ `synergien.html`).

### syn-open

**Anker:** `synergien.html` · Builder-Link `.slink`

**Titel:** Synergiekompendium

**Text:** Hier stehen Vererbung, gleicher GCD, geteilte Cooldowns,
Ketten und Procs — nur wo die eingebetteten Daten sie belegen.

### syn-start

**Anker:** Synergien `.startrow`

**Titel:** Nachschlagen, dann bauen

**Text:** Regeln hier lesen, dann in der Buildschmiede: Addon → `/bs` →
Werkzeuge einfügen.

### syn-types

**Anker:** `synergien.html#regeln`

**Titel:** Vier Typen

**Text:** Vererbung, gleicher GCD, geteilter Cooldown, Trigger/Proc.
Dieselbe Fähigkeit kann in mehreren Listen stehen — die Regeln meinen
trotzdem vier verschiedene Dinge.

### syn-back

**Anker:** Synergien-Nav → Buildschmiede

**Titel:** Zurück zum Builder

**Text:** Dubletten und Modifier bleiben im Kompendium. Bauen,
Auswertung und Generator liegen in der Buildschmiede.

---

## 8 · Levelrun und Endgame

Beide gleichrangig. Bei Konflikt: gemeinsame Logik oder UI-Rahmen — L60
nicht verwerfen, nur weil der Levelrun näher liegt.

### frame-auto

**Anker:** `#t=vAnalyse` · `.framectl` · `#frameHint`

**Titel:** Rahmen wählen

**Text:** **Auto** nimmt Endgame ab Stufe 60, sonst Levelrun. Du kannst
Levelrun oder Endgame fest setzen — die Seite rechnet dann in diesem
Rahmen.

### frame-levelrun

**Titel:** Levelrun (10–59)

**Text:** Essence-Soll folgt deiner aktuellen Stufe aus dem Addon.
ilvl-Bänder sind ein Anhalt aus ItemStat, kein Raid-Ziel.

### frame-endgame

**Titel:** Endgame (Stufe 60)

**Text:** Freie Essence ist Endgame-Budget, kein Level-Nachzug.
ItemStat-Bänder enden bei 59 — Vergleich nur Anhalt, kein Raid-BiS.

### frame-honest

**Titel:** Was die Zahlen nicht tun

**Text:** Mit Import rechnet die Seite Waffentreffer aus echtem
Waffenschaden. Crit, Haste, Ziel-Rüstung und Flat-SP-Anteile ohne
Tooltip-Zahl fehlen. Kein DPS-Ranking, keine erfundenen Koeffizienten.

---

## Fertig / Wiederholung

### done

**Titel:** Du bist durch

**Text:** Addon → `/bs` → übernehmen → Befund und Path. Karten und
Generator helfen beim Feinschliff, Synergien bei Dubletten. Rahmen oben
in der Auswertung: Levelrun oder Endgame.

### again

**Titel:** Tutorial

**Text:** Eingeklappt steht der Knopf **Tutorial** in der Leiste.
`#tut=1` öffnet die Suite wieder.

---

## Paste-Block für JS (`title` / `text` / `more`)

Feld `more` weglassen, wenn die Leiste nur eine Zeile trägt. Die Live-Suite
nimmt aus dem Block nur die neun `id`s der Tabelle oben.

```
{
  "chrome": {
    "next": "Weiter",
    "back": "Zurück",
    "done": "Fertig",
    "skip": "Überspringen",
    "close": "Tutorial schließen",
    "doneHide": "Fertig & nicht mehr zeigen",
    "again": "Tutorial",
    "dismissed": "Kurzanleitung zu Import, Befund und Synergien."
  },
  "steps": [
    {
      "id": "addon-start",
      "go": "#t=rAddon",
      "title": "Companion-Addon",
      "text": "Mit dem Addon tippst du im Spiel /bs, kopierst den Text und fügst ihn unter Werkzeuge ein. Dann kennt die Seite deinen echten Build — Path, Essence, Budget, Gear und Skill Cards.",
      "more": "Das Addon schickt nichts ins Netz. Es schreibt nur Text in ein Fenster. Was du kopierst, entscheidest du."
    },
    {
      "id": "addon-install",
      "go": "#t=rAddon",
      "title": "Addon einhängen",
      "text": "Zip laden, nach Interface\\AddOns\\ entpacken, Spiel neu starten oder /reload. Danach muss Interface\\AddOns\\AscBuildschmiede\\AscBuildschmiede.toc existieren — ein Ordner zu tief ist der häufigste Fehler."
    },
    {
      "id": "addon-slash",
      "go": "#t=rAddon",
      "title": "/bs im Spiel",
      "text": "/bs öffnet das Fenster, der Text ist schon markiert: Strg+C. /bs gear und /bs stats schalten Blöcke an oder aus, wenn der Export zu lang ist.",
      "more": "/bs target liest den Build deines Ziels (asynchron, unter Werkzeuge → Vergleich). /bs help zeigt die Kurzhilfe im Chat."
    },
    {
      "id": "addon-match",
      "go": "#t=rAddon",
      "title": "Zuordnung über IDs",
      "text": "Fähigkeiten und Talente landen über die spellId, Gear über die itemId — nicht über den Anzeigenamen."
    },
    {
      "id": "import-hint",
      "go": "#t=vTools",
      "title": "Export einfügen",
      "text": "Im Spiel /bs tippen, Strg+C, hier einfügen, dann Build übernehmen. Installation steht unter Wissen → Addon."
    },
    {
      "id": "import-apply",
      "go": "#t=vTools",
      "title": "Build übernehmen",
      "text": "Danach füllen sich Charakterkarte, Befund und Path. Unbekannte Zeilen überspringt der Parser — ein älteres Addon bricht die Seite nicht.",
      "more": "Addon 1.4+ liefert IDs, Essence, Locks und Gear. Skill Cards kommen mit Wildcard-Export (1.5+); Namen pro Slot ab 1.5.7."
    },
    {
      "id": "import-empty",
      "go": "#",
      "title": "Noch kein Export",
      "text": "Ohne Einfügen bleibt der Katalog leer von deinem Charakter. Werkzeuge → Import mit /bs ist der kürzeste Weg."
    },
    {
      "id": "befund-open",
      "go": "#t=vAnalyse",
      "title": "Befund lesen",
      "text": "Der Befund prüft Essence, Seltenheits-Budget, Path und Lücken an deinem Import. Kritisch zuerst — das ist kein DPS-Ranking.",
      "more": "Freie Essence ausgeben, bevor du am Gear feilst. Über dem Budget ist der Build im Spiel so nicht lernbar. Desire nimmt der Generator bevorzugt, Undesire lässt er aus. Locks bleiben liegen."
    },
    {
      "id": "path-open",
      "go": "#t=vAnalyse",
      "title": "Path-Empfehlung",
      "text": "Die Rangliste zählt, welcher Path zu deiner Auswahl passt — mit Begründung, nicht als Geschmack. Deinen gespielten Path setzt das Addon; hier siehst du, ob er zum Build steht.",
      "more": "Strength und Agility zählen Spell Power einfach, Duality 1,75-fach, Intelligence doppelt. Healing rechnet Spell Power zusätzlich in Healing Power um. 14 Spell Power = 1 Waffen-DPS — derselbe Hebel gilt für Waffenschaden. Der Waffentooltip ändert sich trotzdem nicht."
    },
    {
      "id": "path-pick",
      "go": "#t=vAnalyse",
      "title": "Path manuell setzen",
      "text": "Ein Klick in der Liste setzt den Path für die Auswertung um. Das ändert nichts im Spiel — nur die Rechnung auf dieser Seite."
    },
    {
      "id": "cards-where",
      "go": "#t=vAnalyse",
      "title": "Skill Cards",
      "text": "Wildcard-Karten stehen rechts unter Ausrüstung. Belegt, aktiv oder blockiert kommt aus dem Export — nicht aus dem Katalog geraten.",
      "more": "Ohne Karten: Addon 1.5+ und /bs neu kopieren. Fehlen nur die Namen: Addon auf 1.5.7+ und nochmal exportieren. Gear extra mit /bs gear, wenn das Paperdoll leer bleibt."
    },
    {
      "id": "cards-pending",
      "go": "#t=vAnalyse",
      "title": "Karten einlösen",
      "text": "Ausstehende Skill Cards musst du im Spiel noch ziehen. Hier siehst du nur den Stand aus dem letzten Export."
    },
    {
      "id": "cards-gen",
      "go": "#t=vTools",
      "title": "Karten im Generator",
      "text": "Zauber, die schon auf einer Karte liegen, bevorzugt der Generator. Locks fasst er nicht an."
    },
    {
      "id": "gen-open",
      "go": "#t=vTools",
      "title": "Generator",
      "text": "Eine Ausrichtung wählen — der Generator füllt Fähigkeiten und passende Talente. Übernehmen ersetzt deine aktuelle Auswahl.",
      "more": "Mit Import gelten Stufe, Budget, Locks, Desire und Karten. Ohne Import laufen die Themen trotzdem; Stufe und Budget sind dann unbekannt. Modus folgt dem Rahmen (Levelrun oder Endgame)."
    },
    {
      "id": "gen-ele",
      "title": "Elementarer Waffenkämpfer",
      "text": "Waffenangriffe als Feuer, Frost oder Natur. Sie ignorieren Armor und ziehen trotzdem vollen Nutzen aus Spell Power."
    },
    {
      "id": "gen-phys",
      "title": "Reiner Waffenkämpfer",
      "text": "Physischer Waffenschaden. Geradlinig mit Waffe und Attack Power — Armor gilt weiter."
    },
    {
      "id": "gen-cast",
      "title": "Zauberwirker",
      "text": "Reine Sprüche ohne Waffenanteil. Der Path mit dem stärksten Spell-Power-Multiplikator trägt hier am meisten."
    },
    {
      "id": "gen-dot",
      "title": "Schaden über Zeit",
      "text": "Läuft auf mehreren Zielen weiter, während du das nächste anfängst. Stark beim Leveln."
    },
    {
      "id": "gen-heal",
      "title": "Heiler",
      "text": "Heilung als Hauptaufgabe. Dafür brauchst du Path of Healing — sonst wird Spell Power nicht in Healing Power umgerechnet."
    },
    {
      "id": "gen-burst",
      "title": "Cooldown-Burst",
      "text": "Wenige harte Treffer auf Cooldown statt Dauerfeuer. Gut gegen einzelne dicke Ziele."
    },
    {
      "id": "gen-apply",
      "go": "#t=vTools",
      "title": "Auswahl ersetzen",
      "text": "Build übernehmen schreibt die generierte Liste in deine Auswahl. Dubletten mit gleichem GCD nimmt er nicht doppelt. Keine erfundenen Schadenszahlen — nur Katalog, Tooltip-Skalierung und Budget."
    },
    {
      "id": "gcd-one",
      "go": "synergien.html#regeln",
      "title": "Gleicher GCD — ein Slot",
      "text": "Mehrere Katalogeinträge derselben Fähigkeit und Schulvarianten in einer Dublettengruppe teilen sich einen globalen Takt. Burning Slam und Frozen Slam sind nicht zwei parallele Drücke."
    },
    {
      "id": "gcd-not-talent",
      "go": "synergien.html#regeln",
      "title": "Nicht dieselbe Regel wie Talente",
      "text": "„This uses Slam modifiers“ heißt: die Variante erbt die Talente von Slam. Slam selbst muss nicht im Build stehen. Das sagt nichts über den GCD."
    },
    {
      "id": "gcd-not-cd",
      "go": "synergien.html#regeln",
      "title": "Nicht derselbe Cooldown",
      "text": "Kick und Counterspell teilen sich einen Ability-Cooldown — eine Abklingzeit, nicht den Slam-GCD. Geteilter CD und gleicher GCD sind zwei Listen."
    },
    {
      "id": "gcd-build",
      "go": "#t=vChain",
      "title": "Was das für dich heißt",
      "text": "Nimm eine Schule pro Dublettengruppe. Analyse, Ketten und Generator zählen sie als eine GCD — nicht als doppelten Takt."
    },
    {
      "id": "syn-open",
      "go": "synergien.html",
      "title": "Synergiekompendium",
      "text": "Hier stehen Vererbung, gleicher GCD, geteilte Cooldowns, Ketten und Procs — nur wo die eingebetteten Daten sie belegen."
    },
    {
      "id": "syn-start",
      "go": "synergien.html",
      "title": "Nachschlagen, dann bauen",
      "text": "Regeln hier lesen, dann in der Buildschmiede: Addon → /bs → Werkzeuge einfügen."
    },
    {
      "id": "syn-types",
      "go": "synergien.html#regeln",
      "title": "Vier Typen",
      "text": "Vererbung, gleicher GCD, geteilter Cooldown, Trigger/Proc. Dieselbe Fähigkeit kann in mehreren Listen stehen — die Regeln meinen trotzdem vier verschiedene Dinge."
    },
    {
      "id": "syn-back",
      "go": "index.html",
      "title": "Zurück zum Builder",
      "text": "Dubletten und Modifier bleiben im Kompendium. Bauen, Auswertung und Generator liegen in der Buildschmiede."
    },
    {
      "id": "frame-auto",
      "go": "#t=vAnalyse",
      "title": "Rahmen wählen",
      "text": "Auto nimmt Endgame ab Stufe 60, sonst Levelrun. Du kannst Levelrun oder Endgame fest setzen — die Seite rechnet dann in diesem Rahmen."
    },
    {
      "id": "frame-levelrun",
      "go": "#t=vAnalyse",
      "title": "Levelrun (10–59)",
      "text": "Essence-Soll folgt deiner aktuellen Stufe aus dem Addon. ilvl-Bänder sind ein Anhalt aus ItemStat, kein Raid-Ziel."
    },
    {
      "id": "frame-endgame",
      "go": "#t=vAnalyse",
      "title": "Endgame (Stufe 60)",
      "text": "Freie Essence ist Endgame-Budget, kein Level-Nachzug. ItemStat-Bänder enden bei 59 — Vergleich nur Anhalt, kein Raid-BiS."
    },
    {
      "id": "frame-honest",
      "go": "#t=vAnalyse",
      "title": "Was die Zahlen nicht tun",
      "text": "Mit Import rechnet die Seite Waffentreffer aus echtem Waffenschaden. Crit, Haste, Ziel-Rüstung und Flat-SP-Anteile ohne Tooltip-Zahl fehlen. Kein DPS-Ranking, keine erfundenen Koeffizienten."
    },
    {
      "id": "done",
      "title": "Du bist durch",
      "text": "Addon → /bs → übernehmen → Befund und Path. Karten und Generator helfen beim Feinschliff, Synergien bei Dubletten. Rahmen oben in der Auswertung: Levelrun oder Endgame."
    }
  ]
}
```

---

## Falls Body die Einstiegskopie noch trägt (nicht hier bauen)

Nur wenn JS/Body die Fläche anfassen und der Alttext noch der lange
Drei-Satz-Block ist. Sonst **nicht** parallel in HTML schreiben.

**Builder Erste Schritte** (Soll, deckungsgleich `NOTES-ui-density.md`):

> Addon laden, im Spiel `/bs` kopieren, unter Werkzeuge einfügen. Danach
> Befund und Path lesen — für Levelrun und L60.

**Builder `pastehint`:**

> Im Spiel `/bs` tippen, Strg+C, hier einfügen. Installation unter Wissen →
> Addon.

**Synergien Erste Schritte:**

> Regeln hier lesen, dann in der Buildschmiede bauen: Addon → `/bs` →
> Werkzeuge einfügen.

**Statuszeile ohne Export:**

> Noch kein Export — Werkzeuge → Import mit `/bs`.

---

## Nicht in die Tour

- Interne Payload-Namen (`D.rel`, `dupGroup`) außer auf Synergien, wo
  sie schon in der Page stehen
- API-Namen (`C_CharacterAdvancement`, `C_PrimaryStat`) — Wissen-Addon
  reicht
- KI-Schlüssel, Prompt-Interna, `aiShortlist`
- Neue Schadensformeln, geratene Caps außer dem schon gemessenen
  Melee-Hit-Cap gegen Bosse (steht in der Stat-Priorität, nicht hier
  wiederholen)
- 1:1-Client-Chrome, BLP

Verwandt: `NOTES-ui-colors.md` (Tour = Accent, nicht Danger),
`NOTES-ui-density.md` (Kürzung Einstieg), `NOTES-shared-gcd.md`,
`NOTES-paths.md`, `NOTES-basemods.md`, `NOTES-wirkungsketten.md`.
