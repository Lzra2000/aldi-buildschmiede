# Methode: SpellTag-Strukturfingerprint

## Kurzfassung

Ascension pflegt in `SpellTags.dbc` / `SpellTagTypes.dbc` eine **offizielle
Fähigkeitstaxonomie** (Schulen, CC, Rollen, Power-Typen, Zieltypen, …).
Die Buildschmiede nutzt davon bisher **nichts**. Path-Hinweise kommen nur
aus Tooltip-Heuristiken (`pipeline/pathtags.py`).

Dieses Prototyp-Skript mappt Katalog-`spellId`s auf jene Tags und bewertet
Builds nach struktureller Abdeckung (Mobility, Interrupt, Soft/Hard-CC,
Heals, AoE, …) — nützlich für Levelruns 10–59, nicht Raid-Optimierung.

Lauf:

```bash
python pipeline/_method_spelltags.py
```

Ausgabe: Rankings/Samples auf stdout + `data/method-spelltags.json`.

---

## Recherche (Extracts)

### Genutzt für den Prototyp

| Quelle | Pfad | Befund |
|---|---|---|
| SpellTags.dbc | `AscensionDBC/DBFilesClient/` | ~488k Zeilen `(id, spellId, tagType)` |
| SpellTagTypes.dbc | ebd. | ~200 Typen; Name in Feld 27, Kategorie in Feld 44 |
| Catalog ↔ IDs | `data/spellids.json` | ~2500/3071 Katalogzauber haben ≥1 Tag |

Beispiele TagTypen: Mobility, DoT/HoT, Direct Heal, Melee/Magic/Ranged,
Schulen, Hard/Soft CC, Interrupt, Role Tank/DPS/Healer, Power Cost, …

### Weitere Ascension-Systeme (bewusst nicht als Methode gewählt)

1. **Wildcard Desired/Undesired** (`C_Wildcard.AddDesiredID` u. a. in
   `Ascension_WildCard/RapidRolling/`). Client-API für Rapid Roll. In
   `CatalogData.lua` steht das Feld `desiredEligible` (2967 true / 104
   false) — die Seite liest es **nicht**. Die 104 `false` sind bunt
   gemischt (keine klare Regel aus Namen allein); als alleinige Methode
   zu dünn, als Filter später nützlich.

2. **Skill-Card Collection** (`C_SkillCardCollection.GetProgress`,
   `GetNumSkillCards`, … in `SkillCardsUtil.lua`). Read-only Progress
   für Website-Scoring denkbar, braucht aber Addon-Export der Collection
   (kein DBC-Offline-Corpus). Addon-Agent / Export-Erweiterung — hier
   nicht angefasst.

3. **Path PrimaryStat-Aura-Tabelle** (`C_PrimaryStat.Auras`:
   954687 Strength … 954699 Duality in `C_PrimaryStat.lua`). Feste,
   kleine Lookup-Tabelle; Website kennt Path schon über Export. Wenig
   „neu“ ohne Spell.dbc-Effektwerte der Auren.

4. **CatalogData-Felder ungenutzt**: `desiredEligible` (s. o.);
   `castMs`/`passive`/`level` teilweise schon über `spellids.json`.
   Kein neues Scoring-System allein.

---

## Was der Prototyp liefert

- Pro Katalogeintrag mit Tags: Facetten-Keys + Schulen
  (`data/method-spelltags.json`)
- Build-Score = gewichtete Facetten-Abdeckung (Interrupt/Mobility höher
  gewichtet als z. B. Cleave)
- Bei Lücken: Ranking von Katalog-Fillern, die die teuersten Gaps schließen
- Demo-Archetypen + optional `data/testexport-charakter.txt` (Namensmatch)

Keine erfundenen Schadenszahlen — nur Tag-Präsenz aus dem Client.

---

## Spätere Nutzung (Vorschlag, nicht implementiert)

### Website (`builder-app.js` / `assemble.py`)

1. Pipeline-Skript analog zu `mechanics.py` → z. B. `data/spelltags.json`
   (kompakt: Katalogindex → Bitmaske oder Facettenliste).
2. In `assemble.py` über `PAYLOAD` als `D.spelltags` einbetten.
3. Analyse-Ansicht: Karte „Struktur“ / Levelrun-Checkliste
   (✓ Interrupt, ✗ Mobility, …) aus dem aktuellen Build.
4. Vorschläge rechts: bestehende Generator-Shortlist mit Gap-Fill-Bonus
   multiplizieren (gleiche Facetten-Gewichte wie Prototyp).
5. Optional Filter im Katalog: „zeigt nur Mobility / Soft-CC / …“.

### Addon (`addon/`)

- Kein Netz. Optional Zeile im Export, z. B. `TAGS|spellId:tagId;…`
  nur für gelernte Spells — oder weglassen, weil die Seite Tags offline
  aus `spellId` ableiten kann, sobald `spellids` + `spelltags` da sind.
- Skill-Card-Progress separat: z. B. `SCARDPROG|owned/total` wenn
  Collection-APIs stabil — anderes Ticket.

### Abgrenzung

- Nicht ersetzen: Tooltip-Schadenszahlen, `pathtags` Path-Empfehlung,
  Mechanics (CD/Kosten). SpellTags ergänzen die **strukturelle** Lesart.
- Keine Client-Lua ins Repo; nur abgeleitete JSON aus DBC.
