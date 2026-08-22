# Ascension API / DBC Notes (Probe)

Generiert von `pipeline/probe_ascension_apis.py` am 2026-08-22.
Nur aus **bereits extrahierten** Baeumen. Kein Client-Lua im Repo.
Collect **1.4.0** bleibt unangetastet — Hinweise sind additiv.

## 1. Was „RE“ hier heisst

### Erlaubt (Forschung / Buildschmiede)
- Lesen der Extract-Baeume unter Documents (Lua / Interface / DBC).
- Mapping undokumentierter `C_*`-Aufrufe anhand FrameXML-/AddOn-**Aufrufe**.
- DBC-Header und Feldlayouts messen (records/fields/recordSize/stringblock).
- Neue Exportzeilen und Pipeline-Schritte **vorschlagen**; Safe/pcall nur in `addon/` / `pipeline/`.

### Hard no
- Ascension.exe decompilieren, MPQ knacken jenseits der Extracts.
- Anti-Cheat-Bypass, Memory-Editing, Packet-Injection.
- Proprietaeres Blizzard-/Ascension-Lua **ins Repo kopieren** (AGENTS.md).
- APIs erfinden, die im Extract keine Evidence haben.

## 2. Top 10 ungenutzte APIs/Felder (mit Evidence)

Pfad-Basis Evidence: `AscensionLuaExtract/by-archive/patch-B.MPQ/`.

### 1. `C_CharacterAdvancement.GetSuggestedStats`
- **Evidence:** `Interface/AddOns/Ascension_ForcedPrimaryStat/PrimaryStat.lua:108`
  - `local topStat, topStats = C_CharacterAdvancement.GetSuggestedStats()`
- **Nutzen:** Liefert vom Client vorgeschlagene PrimaryStats zum aktuellen Build — passt zur Path-Empfehlung auf der Analyse-Seite.
- **Export/Pipeline-Idee:** PATHSUG|statId;… oder Abgleich mit bestehender Path-Heuristik

### 2. `C_CharacterAdvancement.GetEntryBySpellID`
- **Evidence:** `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:170`
  - `local entry = C_CharacterAdvancement.GetEntryBySpellID(dropdown.spell)`
- **Nutzen:** SpellID → CA-Entry ohne Eigen-Lookup; nuetzlich fuer ECOST/QOWN und Karten-Aufloesung.
- **Export/Pipeline-Idee:** kein neues Exportfeld noetig; robustere Collect-Zuordnung

### 3. `C_CharacterAdvancement.GetTabTEInvestment`
- **Evidence:** `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CAClassButton.lua:70`
  - `local spentOnTab = C_CharacterAdvancement.GetTabTEInvestment(class, spec, 0) or 0`
- **Nutzen:** TE pro Klasse/Tab (Talentbaum) — Levelrun-Struktur statt nur Global-TE.
- **Export/Pipeline-Idee:** INVEST|…|TAB:class:spec:n (additiv) oder Analyse-only

### 4. `C_CharacterAdvancement.GetExpectedAE`
- **Evidence:** `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:134`
  - `self.expectedAEByLevel[i] = C_CharacterAdvancement.GetExpectedAE(i) or 0`
- **Nutzen:** Erwartete AE nach Level — Budget-Plausibilitaet ohne Rate.
- **Export/Pipeline-Idee:** ESSENCE|…|EA:expectedAtLevel oder LEVELAE|n

### 5. `C_CharacterAdvancement.GetRootSpellTagTypes / GetSpellTagTypes`
- **Evidence:** `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:622`
  - `local rootTags = C_CharacterAdvancement.GetRootSpellTagTypes()`
- **Nutzen:** Offizielle Tag-Hierarchie (CA-Browser); DBC SpellTags ist die Offline-Spiegelung.
- **Export/Pipeline-Idee:** Pipeline: tags.json; Export optional SPELLTAG|id:tag;…

### 6. `C_CharacterAdvancement.UnitKnownID / UnitTalentRankByID`
- **Evidence:** `Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:145`
  - `if C_CharacterAdvancement.UnitKnownID(unit, entry.ID, self.activeSpec) then`
- **Nutzen:** Inspect pro Spec ohne nur GetInspectedBuild — feinere Fremd-Exporte.
- **Export/Pipeline-Idee:** Inspect-Pfad; FORMAT bleibt 1

### 7. `C_CharacterAdvancement.GetActiveChrSpec`
- **Evidence:** `Interface/AddOns/Ascension_CoATalents/CoASpecViewMixin.lua:26`
  - `local activeSpecID = C_CharacterAdvancement.GetActiveChrSpec()`
- **Nutzen:** CoA/Chr-Spec getrennt von GetActiveSpecID — Spec-Zeile absichern.
- **Export/Pipeline-Idee:** SPEC|… ggf. CHR:id additiv

### 8. `C_CharacterAdvancement.IsTrait`
- **Evidence:** `Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:522`
  - `elseif (C_CharacterAdvancement.IsTrait and C_CharacterAdvancement.IsTrait(internalID)) then`
- **Nutzen:** Draft/Trait-Eintraege markieren (nicht Ability/Talent).
- **Export/Pipeline-Idee:** TRAIT|entryId;… oder Flag in ABI

### 9. `C_SkillCard.GetSkillCardQuality / IsCardAtIndexActive`
- **Evidence:** `Interface/AddOns/Ascension_SkillCards/SkillCard/SkillCard.lua:421`
  - `local quality = C_SkillCard.GetSkillCardQuality(cardData.CardID, displayedRank) or cardData.Quality`
- **Nutzen:** Kartenqualitaet + aktiver Slot — ergaenzt SCARD ohne Purchase-APIs.
- **Export/Pipeline-Idee:** SCARD-Felder erweitern: …:qN / nur aktive Slots

### 10. `C_GameMode.GetActiveGameModes`
- **Evidence:** `Interface/FrameXML/Util/C_GameMode.lua:27`
  - `function C_GameMode:GetActiveGameModes()`
- **Nutzen:** Bitmaske aller aktiven Modi (nicht nur WildCard-Bool).
- **Export/Pipeline-Idee:** MODE|WILDCARD|DRAFT|… aus Enum.GameMode

### DBC-Felder (Offline, Pipeline)

| Datei | records | fields | recordSize | stringBlock |
|---|---:|---:|---:|---:|
| `SpellTags.dbc` | 488662 | 3 | 12 | 0 |
| `SpellTagTypes.dbc` | 200 | 61 | 244 | 10396 |
| `SpellDescriptionVariables.dbc` | 31 | 2 | 8 | 2611 |
| `SpellAddon.dbc` | 5622 | 23 | 92 | 0 |
| `SpellCustomAttr.dbc` | 58633 | 11 | 44 | 0 |
| `SpellStatSuggestions.dbc` | 1121 | 4 | 16 | 0 |
| `SpellSpellSuggestions.dbc` | 353193 | 4 | 16 | 0 |
| `SpellEnchantSuggestions.dbc` | 1144863 | 4 | 16 | 0 |
| `SpellCharges.dbc` | 414 | 2 | 8 | 0 |
| `SpellRank.dbc` | 23228 | 4 | 16 | 0 |

**SpellTags ∩ Katalog:** 2504 / 3071 Spells haben ≥1 Tag (Layout `id, spellId, tagType`).

Haeufigste `tagType` auf Katalog-Spells:

- `8` × 2330 — Instant Cast
- `123` × 1129 — AX_STATS
- `108` × 650 — Single Target
- `113` × 539 — Mana Cost
- `134` × 459 — Direct Damage
- `857` × 396 — AX_STATS
- `17` × 290 — Physical
- `15` × 273 — Magic Spell
- `109` × 259 — AX_STATS
- `14` × 249 — X_STATS
- `51` × 214 — Magic
- `59` × 214 — X_STATS
- `150` × 214 — AX_STATS
- `67` × 210 — Warrior
- `158` × 210 — AX_STATS
- `858` × 195 — AX_STATS
- `60` × 187 — Hunter
- `151` × 187 — AX_STATS
- `122` × 182 — STATS
- `859` × 175 — AX_STATS

**SpellDescriptionVariables:** 31 Eintraege (Tooltip-Variablen `$…`, kein Schaden erfinden — nur Formeln spiegeln).
- id=1 len=0 preview=``
- id=28 len=64 preview=`$min=$?s54825[${$m1/2}][${$m1}]\r\n$max=$?s54825[${$M1/2}][${$M1}]`
- id=29 len=7 preview=`$junk=1`
- id=30 len=15 preview=`$total=${$m1*5}`
- id=31 len=15 preview=`$total=${$m1*5}`
- id=61 len=42 preview=`$mana=$?s55441[${$16191m1+1}][${$16191m1}]`
- id=62 len=31 preview=`$charges=$?s58673[${4+2}][${4}]`
- id=63 len=170 preview=`$dur1=$?s56801[${6+2+5}][${6+2}]\r\n$dur2=$?s56801[${6+4+5}][${6+4}]\r\n$dur3=$?s56801[${6+6+5}][${6`

**SpellStatSuggestions:** rc=1121 fc=4 — Stichprobe `(rowId, spellOrEntry?, stat?, flag?)`:
- `(1, 10, 3, 1)`
- `(2, 17, 4, 1)`
- `(3, 53, 1, 1)`
- `(4, 66, 3, 1)`
- `(5, 71, 0, 1)`
- `(6, 72, 0, 1)`
- `(7, 78, 0, 1)`
- `(8, 99, 1, 1)`

## 3. Bereits im Addon genutzt (nicht anfassen)

Stand Companion **1.5.2** — zusätzlich zu den älteren Collect-APIs:

- `C_CharacterAdvancement.GetSuggestedStats` → SUGGEST
- `C_CharacterAdvancement.GetExpectedAE` → ESSENCE AX:
- `C_CharacterAdvancement.GetTabTEInvestment` → INVEST TAB:
- `C_CharacterAdvancement.GetEntryBySpellID` → intern (QOWN/Karten)
- `C_CharacterAdvancement.GetActiveChrSpec` → SPEC …|CHR:
- `C_CharacterAdvancement.IsTrait` → TRAIT
- `C_GameMode:GetActiveGameModes` → MODE|WILDCARD|DRAFT|…
- `C_PrimaryStat:GetPrimaryStatInfo` / `GetPrimaryStatAura` → PATHINFO / PATHAURA
- `C_PrimaryStat:GetInternalID` → PATHENTRY
- `C_Wildcard.IsDesiredID` / `IsUndesiredID` (+ Roll-Status) → DESIRE / UNDESIRE / WC
- `C_Wildcard.GetStartingChoiceEntries` → STARTCHOICE
- `C_Wildcard.GetRapidRollingState` → WC RR*
- `C_Wildcard.GetRapidRollAbilityBreakpointInfo` / `GetRapidRollTalentBreakpointInfo` → WC RRAbi/RRTal
- `C_Wildcard.GetNumRepurchasableRolls` / `GetNumRepurchasableTalentRolls` / `CanRepurchaseAnyRolls` → WC Repurch*
- `C_SkillCard.GetSkillCardQuality` / `IsCardAtIndexActive` → SCARD :qN / :A
- `C_SkillCardCollection.GetNumPendingSkillCards` → SCARDPEND

Ältere Kern-APIs (weiterhin genutzt):

- `C_CharacterAdvancement.ExportBuild`
- `C_CharacterAdvancement.GetAbilityEssenceCost`
- `C_CharacterAdvancement.GetActiveSpecID`
- `C_CharacterAdvancement.GetAllEntries`
- `C_CharacterAdvancement.GetClassPointInvestment`
- `C_CharacterAdvancement.GetEntryByInternalID`
- `C_CharacterAdvancement.GetGlobalAEInvestment`
- `C_CharacterAdvancement.GetGlobalTEInvestment`
- `C_CharacterAdvancement.GetInspectInfo`
- `C_CharacterAdvancement.GetInspectedBuild`
- `C_CharacterAdvancement.GetKnownSpellEntries`
- `C_CharacterAdvancement.GetKnownTalentEntries`
- `C_CharacterAdvancement.GetLearnedAE`
- `C_CharacterAdvancement.GetLearnedTE`
- `C_CharacterAdvancement.GetQualityCount`
- `C_CharacterAdvancement.GetQualityInfo`
- `C_CharacterAdvancement.GetQualityLimit`
- `C_CharacterAdvancement.GetRemainingAE`
- `C_CharacterAdvancement.GetRemainingTE`
- `C_CharacterAdvancement.GetTalentEssenceCost`
- `C_CharacterAdvancement.GetTalentRankByID`
- `C_CharacterAdvancement.InspectUnit`
- `C_CharacterAdvancement.IsLockedID`
- `C_CharacterAdvancement.IsMastery`
- `C_CharacterAdvancement.IsTalentAbilityID`
- `C_CharacterAdvancement.IsTalentID`
- `C_GameMode.IsGameModeActive`
- `C_PrimaryStat.GetActivePrimaryStat`
- `C_PrimaryStat.GetUnitPrimaryStat`
- `C_SkillCard.GetCardAtIndex`
- `C_SkillCard.GetCardSpellID`
- `C_SkillCard.GetMaxCardCount`
- `C_SkillCard.GetSkillCardInfo`
- `C_SkillCard.IsCardAtIndexBlocked`
- `C_SkillCard.IsCardedSpellID`

## 4. Extract-Zaehler `C_CharacterAdvancement.*` (Top 25)

- `IsKnownID` × 60
- `GetEntryByInternalID` × 36 *(bereits genutzt)*
- `GetTalentRankByID` × 19 *(bereits genutzt)*
- `GetEntryBySpellID` × 18
- `CanAddByEntryID` × 18
- `CanRemoveByEntryID` × 18
- `IsTalentSpellID` × 16
- `GetQualityInfo` × 15 *(bereits genutzt)*
- `IsLockedID` × 15 *(bereits genutzt)*
- `CanLearnID` × 13
- `IsPending` × 13
- `IsTalentID` × 11 *(bereits genutzt)*
- `GetClassPointInvestment` × 11 *(bereits genutzt)*
- `GetLearnedTE` × 11 *(bereits genutzt)*
- `CanUnlearnID` × 10
- `GetLearnedAE` × 10 *(bereits genutzt)*
- `IsKnownSpellID` × 9
- `GetGlobalAEInvestment` × 9 *(bereits genutzt)*
- `AddByEntryID` × 9
- `GetAbilityEssenceCost` × 9 *(bereits genutzt)*
- `LockID` × 8
- `GetPendingRankByEntryID` × 8
- `GetTalentEssenceCost` × 8 *(bereits genutzt)*
- `GetTabTEInvestment` × 7
- `GetTalentsByClass` × 7

## 5. Naechste sichere Schritte (ohne Collect-Umbau)

Safe-read Collect-Coverage fuer Website-Nutzen ist **abgeschlossen** (1.5.2).
Offene Restluecken stehen in `NOTES-live-api-map.md` (Inspect-fein, Tag-Tree
Pipeline, Pending/BuildEditor). Kein weiterer WC-/PATH-Export geplant, solange
keine neue Evidence-API mit Levelrun-Nutzen auftaucht.

1. Optional: `tags.json` aus SpellTags∩Katalog (wie `pathtags.py`).
2. Website-Parser: neue WC-Felder (`RRAbi`/`RRTal`/`Repurch*`) und
   `PATHENTRY`/`STARTCHOICE` nachziehen, wenn die Analyse-Ansicht sie braucht.
3. FORMAT bleibt **1**; neue Zeilen additiv.

---
Ende der Probe-Ausgabe.
