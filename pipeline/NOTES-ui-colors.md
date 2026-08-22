# NOTES — UI-Farben (Semantik)

Stand: 2026-08-22. Token-Werte stehen in `src/builder-head.html`
(Block oben im `<style>`). Synergien spiegelt denselben Block in
`src/synergien-source.html` (Schul-Hüe bleiben gedämpft und nur dort).

Eine Sprache, zwei Seiten. Kein Neon, kein Client-BLP. Levelrun und
Endgame teilen dieselben Zustandsfarben.

---

## Mappe (Ist = Soll)

| Semantik | Spielertext | Token | Hex dunkel / hell |
|---|---|---|---|
| **kritisch** | rot | `--danger` | `#C45C4E` / `#8A322C` |
| **verbesserbar** | Amber | `--caution` | `#C8903A` / `#8A5814` |
| **ok** | Grün | `--good` | `#6E8A6C` / `#2F5340` |
| **Hervorhebung** | Gold | `--accent` / `--gold` | `#C9A227` / `#8B6914` |
| **Qualität** | gedämpft | `--q0` … `--q4` | Datenfarbe, kein UI-Schrei |

`--warn` ist **Alias von `--caution`** (verbesserbar / Achtung). Ember
(`--ember`) bleibt Wildcard-Wärme — nicht für kritisch oder Amber.

`--*-soft` = Fläche zum Token. Text darauf bleibt `--ink` oder der
satte Token. Kein `#1EFF00`.

---

## Klassen

| Klasse / Fläche | Token |
|---|---|
| `.issue.krit`, `.cnt.over`, `.chip.warnable.bad`, `.qv.over`, `.lvlbad`, `#cI.over` | `--danger` |
| `.issue.info`, `.issue.fix`, `.issue.warn`, `.wcchip.soft`, `.flag.pre`, `#cI.ok` | `--caution` |
| `.issue.ok`, `.cnt.ok`, `.flag.syn`, `.wcchip.ok` | `--good` |
| `.cnt.full` | `--accent` (Cap / voll) |
| `button.primary`, `:focus-visible`, Jumpflash, `.row.picked`, Kicker | `--accent` / `--gold` |
| `.nm.q0` … `.nm.q4` | `--q0` … `--q4` |

Schul-Hüe `--fire` … `--physical` nur auf Synergien, gedämpft.

---

## Chrome

- Ein Akzent: Gildengold. Primär Gold, zerstörerisch/kritisch Rot, Rest Metall.
- Paneele: Kohle `--raised` / `--sunken`, Kante `--rule` (Metallgrau), Ecken `--metal`.
- Dichte: `--page-max: 1860px`, `--btn-h: 32px`.
- `text-transform: uppercase` nicht auf Labels mit Umlauten.
- Kein 1:1-Client-Rahmen, kein BLP. Icons nur Sprite / `D.iic`.

Verwandt: `NOTES-ui-density.md`, `NOTES-tutorial.md`.
