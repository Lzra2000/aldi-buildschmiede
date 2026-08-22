# NOTES — Path-Texte (Wissen + PATHS[])

Stand: 2026-08-22. Markup/docs-Lane. **Kein** JS-Edit —
`src/builder-app.js` gehört der src-js-Lane.

Harte Path-Requires (CatalogData `Requires Path of …`) liegen in
`pipeline/NOTES-pathreq.md` / `D.preq`. SpellStatSuggestions bleibt Hinweis
(`NOTES-statsuggest.md`). Nicht vermischen.

## Wissen (`src/builder-body.html`)

Kurze `viewline` (inkl. Healing-Umwandlung), längerer Lead in
`<details class="more">`. Die fünf Path-Karten bleiben sichtbar.
Waffe/Schnellwahl/Empfehlung liegen in einem zweiten `details.more`
(zugeklappt). Heilung nicht mehr als „einziger Weg in die Heiler-Rolle“.
Empfehlung sitzt in der Auswertung, nicht „oben im Builder“.

## PATHS[].core / good / bad — Deutsch-Review

Kein klar falsches Deutsch. Grammatik, Fälle und Anrede **du** stimmen.

| Key | Status |
|---|---|
| str.core / good / bad | in Ordnung |
| agi.core / good / bad | in Ordnung |
| dua.core / good / bad | in Ordnung |
| int.core / good / bad | in Ordnung |
| heal.core / bad | in Ordnung |

### Optional für src-js (Sache, nicht Grammatik)

`heal.good` ist übertrieben — Healing Power gibt es auch auf Items.

Aktuell:

```js
good: "Die Heiler-Rolle. Ohne diesen Path gibt es keine echte Healing Power."
```

Vorschlag (gleiche Aussage wie Wissen + `heal.core`):

```js
good: "Die Heiler-Rolle. Spell Power wird hier zusätzlich Healing Power; " +
      "viele Heiler-Einträge brauchen den Path."
```

`scorePaths` Duality-`why` („genau der Fall, für den es den Path gibt“)
ist plakativ, aber grammatisch in Ordnung — kein Muss.

## Synergien

Kein Path-Lore-Block. Bei der Healing-Sperre ein Satz: der Path rechnet
außerdem Spell Power in Healing Power um. Rest bleibt die 37er-Sperre.
