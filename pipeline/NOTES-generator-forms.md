# NOTES — Generator: Form- und Haltungsfamilien

Stand: 2026-08-22. Ethical RE — **keine** erfundenen SP/AP-Koeffizienten.
Nur Katalogname + Beschreibung. Levelrun 10–59 und L60-Endgame bleiben
first-class.

UI: `src/builder-app.js` → `formFamily` / `formInfo` / `generateBuild`.
Primär `D.frm` (`formtags.py`); leerer Slot → Name+Beschreibung.
Thema **Wildform** (`feral`) plus Form-Sperre auf allen Ausrichtungen.

---

## Regel

Ein generierter Build hält **eine** primäre Kampf-Form. Katze + Bär +
Worgen gleichzeitig spielt sich nicht. Dasselbe für Haltungen: höchstens
eine Presence, eine Kriegerhaltung, eine Shadowform-artige Form.

| Familie | Quelle im Katalog | Exklusiv |
|---|---|---|
| `bear` / `cat` / `moonkin` / `tree` / `worgen` / `serpent` | Name oder Text | ja, untereinander |
| `travel` | Travel / Aquatic / Flight Form | nein (Utility) |
| `humanoid` | Default, kein Form-Text | — |
| `presence_blood` / `_frost` / `_unholy` | Presence-Name | eine Presence |
| `warrior_stance` | Battle / Defensive / Berserker Stance | eine Haltung |
| `shadowform` / `meta` / `ghostwolf` | Name + Text | je eine |

Talentvererbung (`uses X modifiers`): die Basis muss **nicht** im Build
stehen. Shared GCD: ein Slot je `dupGroup`. Geteilter Ability-CD: ein
Slot je `cdGroup`. pathFlags bleiben die Themen-Wertung.

---

## Erkennung (Daten, kein Raten)

| Signal | Beispiel | Wirkung |
|---|---|---|
| Name **ist** die Form | Bear Form, Blood Presence | `grants` — setzt die Familie |
| Klammer | Swipe `(Cat)` / `(Bear)` / `(Feral)` | Pflicht |
| `only usable while in …` | Survival Instincts | Pflicht (eine der genannten) |
| `can be used in A or B` | Mangle: Cat oder Dire Bear | Pflicht auf diese Menge |
| `Usable in Bear Form` | Conduit | Bonus, kein Zwang |
| `Duration is doubled in Bear Form` | Carnage Incarnate | starkes Signal, kein Zwang |
| `usable while shapeshifted` | Charge (114 Treffer) | keine Familie; Bonus, wenn schon eine Kampf-Form steht |
| Stammname | Rake/Shred → Katze; Maul → Bär | Pflicht, wenn der Tooltip die Form nicht nennt |

**Worgen-/Serpent-Ausnahme (Katalog):** beide Texte erlauben
Cat-Form-Fähigkeiten. In einem Worgen- oder Schlangen-Build dürfen
Cat-Fähigkeiten stehen. Die **Katzenform selbst** bleibt eine andere
Kampf-Form. Die verliehene Form ist die Familie, auch wenn der Text
„Cat Form“ nennt.

Dire Bear zählt als `bear`. Name-Treffer (Improved Blood Presence) setzen
die Pflicht — andere Presences im Fließtext bleiben nur Erwähnung.

---

## Ablauf in `generateBuild`

1. Locks, dann Desire (dürfen eine Form setzen; Locks werden nicht
   verworfen).
2. Erster Durchlauf: primäre Familie aus den bestbewerteten Einträgen,
   die eine Form verlangen oder verleihen — plus Theme-Hinweis
   (`feral` → cat/bear).
3. Pflicht auf eine **andere** exklusive Familie: hart überspringen.
4. Universal / humanoid / `usable while shapeshifted` bleiben erlaubt.
5. Form-Zauber der gewählten Familie wird gelegt, wenn legal
   („deine Kampf-Form“).
6. Talente: dieselbe Sperre; Vererbung über `inheritBase` / `MODOF`.

Kurze Skip-Gründe (du) nur in zugeklappten Details, höchstens 16 Zeilen.

---

## Probe 2026-08-22 (Thema Wildform)

Ohne Form-Sperre nimmt die Wertung **Fire Swipe (Cat)** (dupGroup 57)
und **Fire Swipe (Bear)** (dupGroup 56) plus Rake- und Maul-Varianten —
zwei Kampf-Formen, oft plus Worgen-/Serpent-Form.

Mit Sperre gewinnt Katze (höhere Waffen-%-Swipe-Zahl). Bären-Swipes,
Maul und fremde Form-Grants fallen raus. Mangle / Faerie Fire (Feral)
bleiben legal (beide Formen). Eine Pflicht-Familie.

`ele` / `phys` / `cast` / `dot` / `heal` / `burst` nutzen dieselbe
Sperre, sobald Form-Pflichten in der Wertung oben liegen.
