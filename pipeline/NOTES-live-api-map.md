# Live API Map — Ascension Character Advancement Surface

Generated 2026-08-22 from call-site mining. **No proprietary Lua in git.**

## Addon ship (1.5.2, FORMAT 1)

Safe read exports on Collect/SkillCards — only APIs with extract evidence:

| Export | API | Since |
|---|---|---|
| `PATHENTRY\|entryId` | `C_PrimaryStat:GetInternalID` / `GetPrimaryStatInfo`[2] | 1.5.1 |
| `SPEC\|id\|name\|CHR:n` | `GetActiveChrSpec` (additive field) | 1.5.1 |
| `TRAIT\|entryId;…` | `C_CharacterAdvancement.IsTrait` | 1.5.1 |
| `STARTCHOICE\|entryId;…` | `C_Wildcard.GetStartingChoiceEntries` | 1.5.1 |
| `WC\|…\|RRPhase/RRStop/RRLearned/RRDesired/RRCanStart` | `C_Wildcard.GetRapidRollingState` (scalars only) | 1.5.1 |
| `WC\|…\|RRAbi:cur/req/next\|RRTal:…` | `GetRapidRollAbilityBreakpointInfo` / `GetRapidRollTalentBreakpointInfo` | 1.5.2 |
| `WC\|…\|RepurchAbi:n\|RepurchTal:n\|CanRepurch:0/1` | `GetNumRepurchasableRolls` / `GetNumRepurchasableTalentRolls` / `CanRepurchaseAnyRolls(false)` | 1.5.2 |

**Not shipped:** any mutate row; entire `C_BuildEditor` write surface; pending-build preview getters; tag-tree dumps; repurchase **costs** (`GetRepurchase*Cost` — need amount+gold).

## Sources

| Tree | Path | Lua files |
|---|---|---:|
| Extract (canonical) | `C:\Users\x\Documents\AscensionLuaExtract\by-archive\patch-B.MPQ` | 823 |
| Live Interface | `C:\Ascension\Launcher\resources\ascension-live\Interface` | 1315 |
| Own addon (repo) | `C:\Users\x\Projects\aldi-buildschmiede\addon` | 6 |

**Live note:** `ascension-live\Interface` contains **AddOns only** (user + companion).
Ascension FrameXML / `Ascension_*` UI is packed; call-site inventory below is from
`AscensionLuaExtract\…\patch-B.MPQ`. Live third-party AddOns may call a subset.

**Hard rules:** no shipping extract Lua; no mutate APIs in Collect; FORMAT stays **1**.

## Kind legend

- `read` — returns data / player state
- `query` — Can*/Is*/Does* predicates
- `mutate` — changes build / locks / rolls / editor pending state
- `table` — Lua table field on the namespace (not a function)
- **OWN** — already used in AscBuildschmiede Collect / SkillCards / Inspect / Quality

## Summary

| Namespace | Methods | read | query | mutate | table | OWN |
|---|---:|---:|---:|---:|---:|---:|
| `C_BuildEditor` | 50 | 6 | 14 | 30 | 0 | 0 |
| `C_CharacterAdvancement` | 118 | 65 | 26 | 27 | 0 | 32 |
| `C_PrimaryStat` | 12 | 7 | 0 | 1 | 4 | 5 |
| `C_SkillCard` | 13 | 7 | 4 | 2 | 0 | 9 |
| `C_Wildcard` | 45 | 17 | 12 | 16 | 0 | 16 |

## Collect coverage gaps (read/query, not OWN, player-useful)

Candidates from the 1.5.1 pass are **shipped**. 1.5.2 adds Rapid-Roll
breakpoints + repurchase counts on `WC|`. Remaining reads are intentionally
skipped (website value low, heavy, or Inspect/pipeline-only):

| API | Why skip |
|---|---|
| `UnitKnownID` / `UnitTalentRankByID` | Inspect fine-grain; `GetInspectedBuild` already covers ABI/TAL |
| `GetRootSpellTagTypes` / `GetSpellTagTypes` / `GetSpellTagTypeDisplayInfo` | Tag tree → Pipeline / Wissen; heavy for export |
| `GetClassInfo` / `GetClassName` / `GetTabName` | Website catalog already |
| `GetKnownSpells` / `GetKnown*ForClass` / `GetSpellsByClass` / `GetTalentsByClass` / `GetMasteriesByClass` / `GetImplicitByClass` | Redundant with ABI/TAL/MAST |
| `GetEntriesAvailableForSwap` / `GetEntriesAvailableForTrade` | Needs target entry; interactive UI |
| `KnowsConnectedNodesFor` / `MeetsInvestmentForAddByEntryID` | Per-entry gate UI; not a build snapshot |
| `GetNextUnlearnedID` | Transient Rapid-Roll cursor |
| `GetRepurchaseRollCost` / `GetRepurchaseTalentRollCost` | Args amount+gold; UI currency |
| `CanAddDesiredID` / `CanAddUndesiredID` / `CanStartRapidRolling` | Predicates; RRCanStart / Desire lists cover intent |
| `GetFiltered*` / `GetNumFiltered*` (CA / Wildcard) | Browser filter state |
| `GetPending*` / `IsPending*` / `CanApplyPendingBuild` | Pending-build sandbox — do not ship |
| Entire `C_BuildEditor.*` | Editor sandbox — do not ship |
| `C_PrimaryStat:GetPrimaryStatSpell` / `GetPrimaryStatID` | Duplicates PATHINFO |
| `C_SkillCard.GetSkillCardInfoAtIndex` / `GetCardID` | SCARD already via GetCardAtIndex |

Skill-card quality/active already in SkillCards 1.5 (`:qN` / `:A`).

## `C_BuildEditor`

| Method | Kind | OWN | Refs | Evidence (file:line) |
|---|---|---|---:|---|
| `AddArmorType` | mutate |  | 2 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:688`<br>`Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:676` |
| `AddRandomEnchant` | mutate |  | 3 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:684`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:392`<br>`Interface/AddOns/Ascension_EnchantCollection/Collection/CollectionButtonMixin.lua:30` |
| `AddSpell` | mutate |  | 17 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:680`<br>`Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:364`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:375`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:379`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2180`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2195`<br>… +11 more |
| `AddWeaponType` | mutate |  | 2 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:692`<br>`Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:707` |
| `CanAddArmorType` | query |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:668` |
| `CanAddSpell` | query |  | 5 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:179`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CASpellButton.lua:91`<br>`Interface/FrameXML/SpellListItem.lua:223`<br>`Interface/FrameXML/SpellListItem.lua:450`<br>`Interface/FrameXML/SpellListItem.lua:545` |
| `CanAddWeaponType` | query |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:699` |
| `CanPublishBuild` | query |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:277` |
| `CanRemoveSpell` | query |  | 3 | `Interface/FrameXML/SpellListItem.lua:235`<br>`Interface/FrameXML/SpellListItem.lua:422`<br>`Interface/FrameXML/SpellListItem.lua:563` |
| `CanSetEnchantFlags` | query |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:562` |
| `CanSetIsCoreAbility` | query |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:421` |
| `CanSetIsEmpoweringAbility` | query |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:447` |
| `CanSetIsOptimalAbility` | query |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:434` |
| `CanSetIsSynergisticAbility` | query |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:460` |
| `CanSetSpellFlags` | query |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:380` |
| `CanSetSpellLevel` | query |  | 2 | `Interface/FrameXML/Util/BuildCreatorUtil.lua:475`<br>`Interface/FrameXML/Util/BuildCreatorUtil.lua:499` |
| `DiscardPendingBuild` | mutate |  | 5 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:225`<br>`Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:247`<br>`Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:670`<br>`Interface/FrameXML/StaticPopup.lua:715`<br>`Interface/FrameXML/StaticPopup.lua:799` |
| `DoesBuildHaveEnchant` | query |  | 2 | `Interface/AddOns/Ascension_EnchantCollection/Collection/CollectionButtonMixin.lua:47`<br>`Interface/AddOns/Ascension_EnchantCollection/Collection/CollectionButtonMixin.lua:127` |
| `DoesBuildHaveSpellID` | query |  | 16 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2171`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2248`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:86`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:171`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:530`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:753`<br>… +10 more |
| `EditBuild` | mutate |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:566` |
| `GetEssenceForLevel` | read |  | 4 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:245`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1251`<br>`Interface/FrameXML/Util/BuildCreatorUtil.lua:304`<br>`Interface/FrameXML/Util/BuildCreatorUtil.lua:565` |
| `GetFilteredEntryAtIndex` | read |  | 1 | `Interface/FrameXML/SpellListItem.lua:62` |
| `GetNumFilteredEntries` | read |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:297`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:164` |
| `GetPendingBuild` | read |  | 6 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:259`<br>`Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:529`<br>`Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:581`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:198`<br>`Interface/AddOns/Ascension_EnchantCollection/Slots/SlotFrameArchitectTab.lua:10`<br>`Interface/AddOns/Ascension_EnchantCollection/Slots/SlotFrameArchitectTab.lua:48` |
| `GetQualityInfoForLevel` | read |  | 3 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CARarityBar.lua:45`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CARarityBar.lua:45`<br>`Interface/FrameXML/CurrencyBar.lua:250` |
| `GetSpellByID` | read |  | 13 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:362`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2177`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2191`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2206`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2221`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2236`<br>… +7 more |
| `ImportBuild` | mutate |  | 1 | `Interface/FrameXML/StaticPopup.lua:717` |
| `PublishBuild` | mutate |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:543` |
| `RemoveArmorType` | mutate |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:342` |
| `RemoveRandomEnchant` | mutate |  | 3 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:467`<br>`Interface/AddOns/Ascension_EnchantCollection/Collection/CollectionButtonMixin.lua:48`<br>`Interface/AddOns/Ascension_EnchantCollection/Slots/SlotFrameArchitectTab.lua:95` |
| `RemoveSpell` | mutate |  | 8 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:347`<br>`Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:376`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2254`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:531`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1264`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CASpellButton.lua:317`<br>… +2 more |
| `RemoveWeaponType` | mutate |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:344` |
| `SetCategory` | mutate |  | 2 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:673`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:350` |
| `SetComment` | mutate |  | 1 | `Interface/FrameXML/StaticPopup.lua:825` |
| `SetDescription` | mutate |  | 2 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:674`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:266` |
| `SetDifficultyRating` | mutate |  | 6 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:677`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:47`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:57`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:67`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:77`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:87` |
| `SetEnchantFlags` | mutate |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:564` |
| `SetEnchantLevel` | mutate |  | 1 | `Interface/FrameXML/StaticPopup.lua:844` |
| `SetEnchantStacks` | mutate |  | 4 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:480`<br>`Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:491`<br>`Interface/AddOns/Ascension_EnchantCollection/Slots/SlotFrameArchitectTab.lua:100`<br>`Interface/AddOns/Ascension_EnchantCollection/Slots/SlotFrameArchitectTab.lua:105` |
| `SetFilteredEntries` | mutate |  | 4 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:731`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:737`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:363`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:369` |
| `SetIcon` | mutate |  | 3 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:672`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:268`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:316` |
| `SetIsCoreAbility` | mutate |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:423` |
| `SetIsEmpoweringAbility` | mutate |  | 2 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:396`<br>`Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:449` |
| `SetIsOptimalAbility` | mutate |  | 2 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:393`<br>`Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:436` |
| `SetIsSynergisticAbility` | mutate |  | 2 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:399`<br>`Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:462` |
| `SetName` | mutate |  | 2 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:671`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:267` |
| `SetPrimaryStat` | mutate |  | 3 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:676`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:270`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:345` |
| `SetRoles` | mutate |  | 3 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:675`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:269`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:324` |
| `SetSpellFlags` | mutate |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildViewSection.lua:382` |
| `SetSpellLevel` | mutate |  | 4 | `Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:262`<br>`Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:266`<br>`Interface/AddOns/Ascension_BuildCreator/BuildCreator.lua:271`<br>`Interface/FrameXML/Util/BuildCreatorUtil.lua:500` |

## `C_CharacterAdvancement`

| Method | Kind | OWN | Refs | Evidence (file:line) |
|---|---|---|---:|---|
| `ActivateLoadout` | mutate |  | 3 | `Interface/FrameXML/StaticPopup.lua:1505`<br>`Interface/FrameXML/Util/TalentLoadoutUtil.lua:17`<br>`Interface/FrameXML/Util/TalentLoadoutUtil.lua:22` |
| `AddByEntryID` | mutate |  | 9 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2283`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:504`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:576`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:797`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:860`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:865`<br>… +3 more |
| `AddSuggestionContextOverride` | mutate |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2437`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1364` |
| `ApplyPendingBuild` | mutate |  | 6 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:866`<br>`Interface/FrameXML/StaticPopup.lua:544`<br>`Interface/FrameXML/StaticPopup.lua:558`<br>`Interface/FrameXML/StaticPopup.lua:572`<br>`Interface/FrameXML/StaticPopup.lua:586`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:428` |
| `CanAddByEntryID` | query |  | 18 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2280`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CABranchTexture.lua:134`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:284`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:502`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:574`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:796`<br>… +12 more |
| `CanApplyPendingBuild` | query |  | 6 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1310`<br>`Interface/AddOns/Ascension_CoATalents/CoATreeViewMixin.lua:216`<br>`Interface/FrameXML/StaticPopup.lua:119`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:324`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:387`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:411` |
| `CanClearPendingBuild` | query |  | 1 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1453` |
| `CanLearnID` | query |  | 13 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:186`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2286`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:286`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:507`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:578`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:874`<br>… +7 more |
| `CanRemoveByEntryID` | query |  | 18 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2350`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2358`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:255`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:488`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:517`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1345`<br>… +12 more |
| `CanSwapEntriesByID` | query |  | 1 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:217` |
| `CanSwitchActiveChrSpec` | query |  | 1 | `Interface/AddOns/Ascension_CoATalents/Templates/CoASpecChoiceMixin.lua:224` |
| `CanUnlearnAllSpells` | query |  | 1 | `Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:820` |
| `CanUnlearnAllTalents` | query |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1445`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:811` |
| `CanUnlearnID` | query |  | 10 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:208`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2365`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:257`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:412`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:419`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:522`<br>… +4 more |
| `CancelPendingBuild` | mutate |  | 6 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1346`<br>`Interface/AddOns/Ascension_CoATalents/CoATalentFrame.lua:153`<br>`Interface/FrameXML/StaticPopup.lua:113`<br>`Interface/FrameXML/StaticPopup.lua:548`<br>`Interface/FrameXML/StaticPopup.lua:562`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:244` |
| `ClearPendingBuild` | mutate |  | 3 | `Interface/AddOns/Ascension_CoATalents/CoATreeViewMixin.lua:129`<br>`Interface/FrameXML/Util/BuildCreatorUtil.lua:605`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:323` |
| `ClearPendingBuildByTab` | mutate |  | 2 | `Interface/AddOns/Ascension_TalentUI/TalentTreeBase.lua:59`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:386` |
| `ClearRecentlyLearnedEntries` | mutate |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:306`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:173` |
| `ClearSuggestionContextOverrides` | mutate |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2449`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1376` |
| `ExportBuild` | read | yes | 1 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:482` |
| `GetAbilityEssenceCost` | read | yes | 9 | `Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:296`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:494`<br>`Interface/FrameXML/GameTooltip.lua:398`<br>`Interface/FrameXML/SpellListItem.lua:286`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:71`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:79`<br>… +3 more |
| `GetActiveChrSpec` | read | yes | 5 | `Interface/AddOns/Ascension_CoATalents/CoASpecViewMixin.lua:26`<br>`Interface/AddOns/Ascension_CoATalents/CoATalentFrame.lua:187`<br>`Interface/AddOns/Ascension_CoATalents/CoATalentFrame.lua:199`<br>`Interface/AddOns/Ascension_CoATalents/CoATalentFrame.lua:290`<br>`Interface/FrameXML/Util/GlobalFunctions.lua:294` |
| `GetActiveSpecID` | read | yes | 4 | `Interface/FrameXML/Util/C_Spell.lua:129`<br>`Interface/FrameXML/Util/SkillCardsUtil.lua:101`<br>`Interface/FrameXML/Util/SpecializationUtil.lua:65`<br>`Interface/FrameXML/Util/SpecializationUtil.lua:171` |
| `GetAllEntries` | read | yes | 1 | `Interface/FrameXML/Data/CharacterAdvancement.lua:66` |
| `GetCategories` | read |  | 4 | `Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:629`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:721`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Browser/CharacterAdvancementBrowser.lua:464`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Browser/CharacterAdvancementBrowser.lua:529` |
| `GetCategoryDisplayInfo` | read |  | 7 | `Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:510`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:575`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:636`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:729`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Browser/CharacterAdvancementBrowser.lua:362`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Browser/CharacterAdvancementBrowser.lua:425`<br>… +1 more |
| `GetClassInfo` | read |  | 4 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:438`<br>`Interface/FrameXML/GameTooltip.lua:456`<br>`Interface/FrameXML/SpellListItem.lua:251`<br>`Interface/FrameXML/Util/BuildCreatorUtil.lua:199` |
| `GetClassName` | read |  | 1 | `Interface/FrameXML/GameTooltip.lua:222` |
| `GetClassPointInvestment` | read | yes | 11 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1586`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:390`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CAClassButton.lua:52`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:131`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:432`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:609`<br>… +5 more |
| `GetEntriesAvailableForSwap` | read |  | 1 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2381` |
| `GetEntriesAvailableForTrade` | read |  | 1 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2396` |
| `GetEntryByInternalID` | read | yes | 36 | `Interface/AddOns/AscensionUI/SkillTree/SkillTree.lua:64`<br>`Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:55`<br>`Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:327`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1243`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1319`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1459`<br>… +30 more |
| `GetEntryBySpellID` | read | yes | 18 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:170`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:372`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:139`<br>`Interface/AddOns/Ascension_SkillCards/SkillCard/SkillCard.lua:418`<br>`Interface/AddOns/Ascension_SkillCards/SkillCard/SkillCard.lua:713`<br>`Interface/AddOns/Ascension_SkillCards/SkillCardFrame/SkillCardScroll/SkillCardScrollItemMixin.lua:132`<br>… +12 more |
| `GetExpectedAE` | read | yes | 1 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:134` |
| `GetFilteredEntryAtIndex` | read |  | 1 | `Interface/FrameXML/SpellListItem.lua:70` |
| `GetFilteredEntryAtIndexByCategory` | read |  | 3 | `Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:523`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:598`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Browser/CharacterAdvancementBrowser.lua:375` |
| `GetGlobalAEInvestment` | read | yes | 9 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:468`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:404`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:124`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:433`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:621`<br>`Interface/FrameXML/GameTooltip.lua:466`<br>… +3 more |
| `GetGlobalTEInvestment` | read | yes | 3 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CAGate.lua:319`<br>`Interface/FrameXML/Util/GlobalOverwrites.lua:328`<br>`Interface/FrameXML/Util/GlobalOverwrites.lua:329` |
| `GetImplicitByClass` | read |  | 1 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:848` |
| `GetInspectInfo` | read | yes | 6 | `Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:12`<br>`Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:55`<br>`Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:171`<br>`Interface/LibraryXML/LibGroupTalents-1.0/LibGroupTalents-1.0.lua:786`<br>`Interface/LibraryXML/LibGroupTalents-1.0/LibGroupTalents-1.0.lua:1535`<br>`Interface/LibraryXML/LibGroupTalents-1.0/LibGroupTalents-1.0.lua:1547` |
| `GetInspectedBuild` | read | yes | 1 | `Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:69` |
| `GetInternalID` | read |  | 4 | `Interface/FrameXML/Util/BuildCreatorUtil.lua:235`<br>`Interface/FrameXML/Util/BuildCreatorUtil.lua:280`<br>`Interface/FrameXML/Util/BuildCreatorUtil.lua:319`<br>`Interface/FrameXML/Util/C_Spell.lua:150` |
| `GetKnownSpellEntries` | read | yes | 4 | `Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1062`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:109`<br>`Interface/FrameXML/Util/SkillCardsUtil.lua:58`<br>`Interface/FrameXML/Util/SkillCardsUtil.lua:63` |
| `GetKnownSpellEntriesForClass` | read |  | 1 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2065` |
| `GetKnownSpells` | read |  | 1 | `Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:367` |
| `GetKnownTalentEntries` | read | yes | 2 | `Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1144`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:103` |
| `GetKnownTalentEntriesForClass` | read |  | 1 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2113` |
| `GetLearnedAE` | read | yes | 10 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:324`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpecTab.lua:11`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CAClassButton.lua:37`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CASpecTab.lua:11`<br>`Interface/AddOns/Ascension_Draft/DraftActionButtonMixin.lua:4`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:295`<br>… +4 more |
| `GetLearnedTE` | read | yes | 11 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpecTab.lua:10`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:919`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CAClassButton.lua:36`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CASpecTab.lua:10`<br>`Interface/AddOns/Ascension_NewPlayerExperience/Tutorials/Tutorial_SkillCards.lua:79`<br>`Interface/AddOns/Ascension_NewPlayerExperience/Tutorials/Tutorial_SkillCards.lua:143`<br>… +5 more |
| `GetMasteriesByClass` | read |  | 1 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:844` |
| `GetNumFilteredEntries` | read |  | 4 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:305`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1179`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:172`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:649` |
| `GetNumFilteredEntriesByCategory` | read |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:634`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Browser/CharacterAdvancementBrowser.lua:469` |
| `GetPendingClassPointInvestment` | read |  | 1 | `Interface/FrameXML/Util/GlobalOverwrites.lua:340` |
| `GetPendingGlobalAEInvestment` | read |  | 1 | `Interface/FrameXML/Util/GlobalOverwrites.lua:345` |
| `GetPendingGlobalTEInvestment` | read |  | 1 | `Interface/FrameXML/Util/GlobalOverwrites.lua:330` |
| `GetPendingRankByEntryID` | read |  | 8 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:96`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:98`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:770`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:772`<br>`Interface/FrameXML/SpellListItem.lua:77`<br>`Interface/FrameXML/CharacterAdvancement/CATalentBaseMixin.lua:71`<br>… +2 more |
| `GetPendingRemainingAE` | read |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1255`<br>`Interface/AddOns/Ascension_CoATalents/CoATreeViewMixin.lua:192` |
| `GetPendingRemainingTE` | read |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1256`<br>`Interface/AddOns/Ascension_CoATalents/CoATreeViewMixin.lua:193` |
| `GetPendingTabTEInvestment` | read |  | 1 | `Interface/FrameXML/Util/GlobalOverwrites.lua:335` |
| `GetQualityCount` | read | yes | 5 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CARarityBar.lua:47`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CARarityBar.lua:47`<br>`Interface/FrameXML/CurrencyBar.lua:252`<br>`Interface/FrameXML/Util/GlobalOverwrites.lua:375`<br>`Interface/FrameXML/Util/GlobalOverwrites.lua:376` |
| `GetQualityInfo` | read | yes | 15 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:25`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:385`<br>`Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:221`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1117`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardRouletteMixin.lua:26`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardStartingChoice.lua:62`<br>… +9 more |
| `GetQualityLimit` | read | yes | 6 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CARarityBar.lua:49`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CARarityBar.lua:49`<br>`Interface/AddOns/Ascension_SkillCards/SkillCardFrame/SkillCardsFrame.lua:287`<br>`Interface/FrameXML/CurrencyBar.lua:257`<br>`Interface/FrameXML/Util/GlobalOverwrites.lua:380`<br>`Interface/FrameXML/Util/GlobalOverwrites.lua:381` |
| `GetRemainingAE` | read | yes | 1 | `Interface/FrameXML/Util/GlobalOverwrites.lua:420` |
| `GetRemainingTE` | read | yes | 1 | `Interface/FrameXML/Util/GlobalOverwrites.lua:422` |
| `GetRootSpellTagTypes` | read |  | 1 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:622` |
| `GetSpellTagTypeDisplayInfo` | read |  | 5 | `Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:119`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Browser/CharacterAdvancementBrowser.lua:79`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:627`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:638`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:650` |
| `GetSpellTagTypes` | read |  | 2 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:633`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:646` |
| `GetSpellsByClass` | read |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1807`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1039` |
| `GetSuggestedStats` | read | yes | 1 | `Interface/AddOns/Ascension_ForcedPrimaryStat/PrimaryStat.lua:108` |
| `GetTabName` | read |  | 1 | `Interface/FrameXML/GameTooltip.lua:235` |
| `GetTabTEInvestment` | read | yes | 7 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1585`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CAClassButton.lua:70`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CAGate.lua:320`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CATalentBrowser.lua:49`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CATalentBrowser.lua:242`<br>`Interface/FrameXML/Util/GlobalOverwrites.lua:333`<br>… +1 more |
| `GetTalentEssenceCost` | read | yes | 8 | `Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:495`<br>`Interface/FrameXML/GameTooltip.lua:399`<br>`Interface/FrameXML/SpellListItem.lua:287`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:72`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:80`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:96`<br>… +2 more |
| `GetTalentRankByID` | read | yes | 19 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:189`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:103`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:777`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:793`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:804`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:923`<br>… +13 more |
| `GetTalentRankBySpellID` | read |  | 3 | `Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:370`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:92`<br>`Interface/FrameXML/Util/GlobalOverwrites.lua:363` |
| `GetTalentsByClass` | read |  | 7 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1974`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CATalentBrowser.lua:138`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:922`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1099`<br>`Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:120`<br>`Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:144`<br>… +1 more |
| `HasAnySuggestionContextOverrides` | read |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2444`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1371` |
| `ImportPendingBuild` | mutate |  | 2 | `Interface/FrameXML/StaticPopup.lua:78`<br>`Interface/FrameXML/StaticPopup.lua:82` |
| `ImportPendingBuildID` | mutate |  | 1 | `Interface/FrameXML/Util/BuildCreatorUtil.lua:606` |
| `InspectUnit` | mutate | yes | 4 | `Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:44`<br>`Interface/LibraryXML/LibTalentQuery-1.0/LibTalentQuery-1.0.lua:239`<br>`Interface/LibraryXML/LibTalentQuery-1.0/LibTalentQuery-1.0.lua:262`<br>`Interface/LibraryXML/LibTalentQuery-1.0/LibTalentQuery-1.0.lua:264` |
| `IsAbilityID` | query |  | 2 | `Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:525`<br>`Interface/FrameXML/Util/CharacterAdvancementCostUtil.lua:149` |
| `IsConnectionAllowed` | query |  | 2 | `Interface/FrameXML/CharacterAdvancement/CATalentBaseMixin.lua:215`<br>`Interface/FrameXML/CharacterAdvancement/CATalentChoiceBaseMixin.lua:241` |
| `IsFiltered` | query |  | 2 | `Interface/FrameXML/CharacterAdvancement/CATalentBaseMixin.lua:247`<br>`Interface/FrameXML/CharacterAdvancement/CATalentChoiceBaseMixin.lua:190` |
| `IsKnownID` | query |  | 60 | `Interface/AddOns/AscensionUI/CharacterAdvancement/SimpleTalentsFrame.lua:580`<br>`Interface/AddOns/AscensionUI/SkillTree/SkillTree.lua:511`<br>`Interface/AddOns/AscensionUI/SkillTree/SkillTree.lua:769`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2293`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CABranchTexture.lua:132`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:244`<br>… +54 more |
| `IsKnownSpellID` | query |  | 9 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:49`<br>`Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:87`<br>`Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:133`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2377`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2460`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2469`<br>… +3 more |
| `IsLockedID` | query | yes | 15 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2295`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:241`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1304`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CASpellButton.lua:113`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:997`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardStartingChoice.lua:76`<br>… +9 more |
| `IsMastery` | query | yes | 5 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:782`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2337`<br>`Interface/FrameXML/Ascension_BuildDraft/BuildDraftCardMixin.lua:111`<br>`Interface/FrameXML/Util/DraftUtil.lua:243`<br>`Interface/FrameXML/Util/WildCardUtil.lua:27` |
| `IsPending` | query |  | 13 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:386`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1255`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1256`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1309`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2413`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:95`<br>… +7 more |
| `IsPendingBuildAvailable` | query |  | 1 | `Interface/FrameXML/Util/C_PrimaryStat.lua:101` |
| `IsPendingEntryID` | query |  | 3 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CABranchTexture.lua:133`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:228`<br>`Interface/FrameXML/SpellListItem.lua:102` |
| `IsSuggestionContextOverride` | query |  | 4 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2429`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:441`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1356`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Browser/CharacterAdvancementBrowser.lua:295` |
| `IsTalentAbilityID` | query | yes | 4 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:780`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:525`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1125`<br>`Interface/FrameXML/Util/CharacterAdvancementCostUtil.lua:149` |
| `IsTalentAbilitySpellID` | query |  | 7 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2164`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:551`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardNameFrameMixin.lua:28`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardNameFrameMixin.lua:43`<br>`Interface/FrameXML/SpellListItem.lua:214`<br>`Interface/FrameXML/SpellListItem.lua:536`<br>… +1 more |
| `IsTalentID` | query | yes | 11 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:780`<br>`Interface/AddOns/Ascension_Draft/Draft.lua:311`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:519`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:802`<br>`Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:228`<br>`Interface/AddOns/Ascension_WildCard/WildCard.lua:336`<br>… +5 more |
| `IsTalentSpellID` | query |  | 16 | `Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:359`<br>`Interface/AddOns/Ascension_BuildCreator/BuildSpell.lua:375`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:369`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2162`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:549`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1174`<br>… +10 more |
| `IsTrait` | query | yes | 1 | `Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:522` |
| `KnowsConnectedNodesFor` | read |  | 1 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:765` |
| `LearnID` | mutate |  | 6 | `Interface/AddOns/Ascension_UIDevelopmentTools/Console/Commands/DFunc.lua:5`<br>`Interface/AddOns/Ascension_UIDevelopmentTools/Console/Commands/DFunc.lua:6`<br>`Interface/AddOns/Ascension_UIDevelopmentTools/Console/Commands/DFunc.lua:23`<br>`Interface/AddOns/Ascension_UIDevelopmentTools/Console/Commands/DFunc.lua:24`<br>`Interface/FrameXML/StaticPopup.lua:610`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:152` |
| `LockID` | mutate |  | 8 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2312`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1321`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1002`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardStartingChoice.lua:525`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:221`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:144`<br>… +2 more |
| `MeetsInvestmentForAddByEntryID` | read |  | 1 | `Interface/FrameXML/CharacterAdvancement/CATalentBaseMixin.lua:72` |
| `PickupSpell` | mutate |  | 4 | `Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:466`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Templates/CASpellButton.lua:281`<br>`Interface/FrameXML/CharacterAdvancement/CATalentBaseMixin.lua:356`<br>`Interface/SharedXML/SharedTemplates.lua:485` |
| `RemoveByEntryID` | mutate |  | 6 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2354`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:490`<br>`Interface/AddOns/Ascension_CharacterAdvancement/Templates/CASpellButton.lua:519`<br>`Interface/FrameXML/SpellListItem.lua:162`<br>`Interface/FrameXML/SpellListItem.lua:647`<br>`Interface/FrameXML/CharacterAdvancement/CATalentBaseMixin.lua:288` |
| `RemoveSuggestionContextOverride` | mutate |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2432`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1359` |
| `SetFilteredEntries` | mutate |  | 5 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:733`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:739`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:365`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:371`<br>`Interface/AddOns/Ascension_CoATalents/CoATreeViewMixin.lua:250` |
| `SetFilteredEntriesByCategory` | mutate |  | 2 | `Interface/AddOns/Ascension_CharacterAdvancement/Browser/CharacterAdvancementBrowser.lua:733`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/Browser/CharacterAdvancementBrowser.lua:533` |
| `SetLoadoutName` | mutate |  | 3 | `Interface/FrameXML/StaticPopup.lua:1484`<br>`Interface/FrameXML/Util/TalentLoadoutUtil.lua:36`<br>`Interface/FrameXML/Util/TalentLoadoutUtil.lua:47` |
| `SetLoadoutSortOrder` | mutate |  | 1 | `Interface/FrameXML/Util/TalentLoadoutUtil.lua:51` |
| `ShouldConfirmLearnID` | read |  | 1 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:147` |
| `ShouldConfirmUnlearnAllSpells` | read |  | 1 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:364` |
| `ShouldConfirmUnlearnAllTalents` | read |  | 1 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:346` |
| `ShouldConfirmUnlearnID` | read |  | 1 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:286` |
| `SwapEntriesByID` | mutate |  | 1 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:218` |
| `SwitchActiveChrSpec` | mutate |  | 1 | `Interface/AddOns/Ascension_CoATalents/CoATalentFrame.lua:231` |
| `UnitKnownID` | read |  | 3 | `Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:145`<br>`Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:298`<br>`Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:360` |
| `UnitTalentRankByID` | read |  | 4 | `Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:147`<br>`Interface/AddOns/Ascension_InspectUI/Panels/InspectBuildPanel.lua:350`<br>`Interface/LibraryXML/LibGroupTalents-1.0/LibGroupTalents-1.0.lua:760`<br>`Interface/LibraryXML/LibGroupTalents-1.0/LibGroupTalents-1.0.lua:1622` |
| `UnlearnAllSpells` | mutate |  | 2 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:366`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:376` |
| `UnlearnAllTalents` | mutate |  | 2 | `Interface/FrameXML/Util/CharacterAdvancementUtil.lua:348`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:359` |
| `UnlearnID` | mutate |  | 3 | `Interface/AddOns/AscensionUI/SkillTree/SkillTree.lua:71`<br>`Interface/FrameXML/StaticPopup.lua:639`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:291` |
| `UnlockID` | mutate |  | 4 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:2302`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:1311`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:146`<br>`Interface/FrameXML/StaticPopup.lua:680` |

## `C_PrimaryStat`

| Method | Kind | OWN | Refs | Evidence (file:line) |
|---|---|---|---:|---|
| `AuraToID` | table |  | 2 | `Interface/FrameXML/Util/C_PrimaryStat.lua:37`<br>`Interface/FrameXML/Util/C_PrimaryStat.lua:75` |
| `Auras` | table |  | 2 | `Interface/FrameXML/Util/C_PrimaryStat.lua:28`<br>`Interface/FrameXML/Util/C_PrimaryStat.lua:66` |
| `GetActivePrimaryStat` | read | yes | 13 | `Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildView.lua:360`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1229`<br>`Interface/AddOns/Ascension_Manastorm/ManastormQueue.lua:185`<br>`Interface/AddOns/Ascension_NewPlayerExperience/old/Tutorial_FirstLogin.lua:626`<br>`Interface/AddOns/Ascension_NewPlayerExperience/old/Tutorial_FirstLogin.lua:846`<br>`Interface/FrameXML/PlayerFrame.lua:69`<br>… +7 more |
| `GetInternalID` | read | yes | 4 | `Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1230`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:718`<br>`Interface/AddOns/Ascension_ForcedPrimaryStat/PrimaryStat.lua:26`<br>`Interface/FrameXML/Util/C_PrimaryStat.lua:86` |
| `GetPrimaryStatAura` | read | yes | 1 | `Interface/FrameXML/Util/C_PrimaryStat.lua:117` |
| `GetPrimaryStatID` | read |  | 3 | `Interface/FrameXML/Util/C_PrimaryStat.lua:144`<br>`Interface/FrameXML/Util/C_Spell.lua:348`<br>`Interface/FrameXML/Util/C_Spell.lua:349` |
| `GetPrimaryStatInfo` | read | yes | 15 | `Interface/AddOns/Ascension_BuildCreator/BuildListItem.lua:86`<br>`Interface/AddOns/Ascension_BuildCreator/BuildView.lua:81`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildIcons.lua:141`<br>`Interface/AddOns/Ascension_BuildCreator/BuildEditor/EditableBuildIcons.lua:189`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1237`<br>`Interface/AddOns/Ascension_ForcedPrimaryStat/PrimaryStat.lua:43`<br>… +9 more |
| `GetPrimaryStatSpell` | read |  | 1 | `Interface/FrameXML/Util/C_PrimaryStat.lua:148` |
| `GetUnitPrimaryStat` | read | yes | 1 | `Interface/FrameXML/Util/C_PrimaryStat.lua:127` |
| `SetPrimaryStat` | mutate |  | 1 | `Interface/FrameXML/Util/C_PrimaryStat.lua:90` |
| `SpellToID` | table |  | 2 | `Interface/FrameXML/Util/C_PrimaryStat.lua:19`<br>`Interface/FrameXML/Util/C_PrimaryStat.lua:58` |
| `internalIds` | table |  | 3 | `Interface/AddOns/Ascension_ForcedPrimaryStat/PrimaryStat.lua:248`<br>`Interface/FrameXML/Util/C_PrimaryStat.lua:10`<br>`Interface/FrameXML/Util/C_PrimaryStat.lua:49` |

## `C_SkillCard`

| Method | Kind | OWN | Refs | Evidence (file:line) |
|---|---|---|---:|---|
| `GetCardAtIndex` | read | yes | 5 | `Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:302`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:308`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:317`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:322`<br>`Interface/FrameXML/Util/SkillCardsUtil.lua:180` |
| `GetCardID` | read |  | 1 | `Interface/AddOns/Ascension_RandomModeShared/RandomModeStoreItemMixin.lua:17` |
| `GetCardSpellID` | read | yes | 1 | `Interface/AddOns/Ascension_RandomModeShared/RandomModeStoreItemMixin.lua:19` |
| `GetMaxCardCount` | read | yes | 4 | `Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:300`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:316`<br>`Interface/AddOns/Ascension_SkillCards/SkillCardFrame/SkillCardsFrame.lua:265`<br>`Interface/FrameXML/Util/SkillCardsUtil.lua:176` |
| `GetSkillCardInfo` | read | yes | 1 | `Interface/FrameXML/Util/SkillCardsUtil.lua:256` |
| `GetSkillCardInfoAtIndex` | read |  | 2 | `Interface/AddOns/Ascension_SkillCards/SkillCardFrame/SkillCardsFrame.lua:267`<br>`Interface/FrameXML/Util/SkillCardsUtil.lua:184` |
| `GetSkillCardQuality` | read | yes | 3 | `Interface/AddOns/Ascension_SkillCards/SkillCard/SkillCard.lua:421`<br>`Interface/AddOns/Ascension_SkillCards/SkillCard/SkillCard.lua:715`<br>`Interface/AddOns/Ascension_SkillCards/SkillCard/SkillCard.lua:814` |
| `IsCardAtIndexActive` | query | yes | 1 | `Interface/FrameXML/Util/SkillCardsUtil.lua:192` |
| `IsCardAtIndexBlocked` | query | yes | 3 | `Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:302`<br>`Interface/AddOns/Ascension_Draft/DraftCardMixin.lua:308`<br>`Interface/AddOns/Ascension_SkillCards/SkillCardFrame/SkillCardTab/SkillCardTab.lua:316` |
| `IsCardedID` | query | yes | 1 | `Interface/FrameXML/Util/DraftUtil.lua:130` |
| `IsCardedSpellID` | query | yes | 1 | `Interface/FrameXML/GameTooltip.lua:393` |
| `RemoveCardAtIndex` | mutate |  | 1 | `Interface/FrameXML/Util/SkillCardsUtil.lua:214` |
| `SetCardAtIndex` | mutate |  | 1 | `Interface/FrameXML/Util/SkillCardsUtil.lua:203` |

## `C_Wildcard`

| Method | Kind | OWN | Refs | Evidence (file:line) |
|---|---|---|---:|---|
| `AddDesiredID` | mutate |  | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:102`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:148` |
| `AddUndesiredID` | mutate |  | 3 | `Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:988`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:103`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:156` |
| `CanAddDesiredID` | query |  | 4 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollDesiredSpellListItemMixin.lua:22`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:86`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:30`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:65` |
| `CanAddUndesiredID` | query |  | 5 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:236`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:91`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:104`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:110`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollUndesiredSpellListItemMixin.lua:26` |
| `CanRepurchaseAnyRolls` | query | yes | 1 | `Interface/AddOns/Ascension_RandomModeShared/Gossip/RandomModeGossipMixin.lua:87` |
| `CanRepurchaseRolls` | query |  | 1 | `Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:91` |
| `CanRepurchaseTalentRolls` | query |  | 1 | `Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:128` |
| `CanRollAbilities` | query | yes | 9 | `Interface/AddOns/Ascension_WildCard/WildCard.lua:119`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1057`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1268`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1303`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:293`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:200`<br>… +3 more |
| `CanShowStartingChoice` | query | yes | 6 | `Interface/AddOns/Ascension_WildCard/WildCard.lua:124`<br>`Interface/AddOns/Ascension_WildCard/WildCard.lua:125`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardStartingChoice.lua:328`<br>`Interface/FrameXML/Util/SkillCardsUtil.lua:104`<br>`Interface/FrameXML/Util/WildCardUtil.lua:144`<br>`Interface/FrameXML/Util/WildCardUtil.lua:156` |
| `CanStartRapidRolling` | query |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:318` |
| `CanUseRapidRolling` | query | yes | 5 | `Interface/AddOns/Ascension_BuildCreator/BuildListItem.lua:181`<br>`Interface/AddOns/Ascension_BuildCreator/BuildView.lua:676`<br>`Interface/AddOns/Ascension_CharacterAdvancement/CharacterAdvancement.lua:1393`<br>`Interface/AddOns/Ascension_CharacterAdvancementSeason9/CharacterAdvancement.lua:767`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:199` |
| `CancelRapidRolling` | mutate |  | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:264`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:265` |
| `ClearDesiredSpells` | mutate |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:59` |
| `ClearUndesiredSpells` | mutate |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingSpells.lua:79` |
| `ContinueRapidRolling` | mutate |  | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:297`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:302` |
| `GetFilteredDesiredEntryAtIndex` | read |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollDesiredSpellListItemMixin.lua:14` |
| `GetFilteredUndesiredEntryAtIndex` | read |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollUndesiredSpellListItemMixin.lua:18` |
| `GetMaximumRapidRolls` | read | yes | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:61`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:416` |
| `GetNextUnlearnedID` | read |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollUndesiredSpellListItemMixin.lua:68` |
| `GetNumFilteredDesiredEntries` | read |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:19` |
| `GetNumFilteredUndesiredEntries` | read |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:27` |
| `GetNumRepurchasableRolls` | read | yes | 2 | `Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:66`<br>`Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:98` |
| `GetNumRepurchasableTalentRolls` | read | yes | 2 | `Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:72`<br>`Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:135` |
| `GetRapidRollAbilityBreakpointInfo` | read | yes | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:156`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:423` |
| `GetRapidRollTalentBreakpointInfo` | read | yes | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:175`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:435` |
| `GetRapidRollingState` | read | yes | 6 | `Interface/AddOns/Ascension_WildCard/WildCard.lua:287`<br>`Interface/AddOns/Ascension_WildCard/WildCard.lua:288`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1096`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1097`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:13`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:14` |
| `GetRepurchaseRollCost` | read |  | 1 | `Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:79` |
| `GetRepurchaseTalentRollCost` | read |  | 1 | `Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:117` |
| `GetRollIcons` | read |  | 1 | `Interface/AddOns/Ascension_WildCard/Dice/WildCardRouletteMixin.lua:81` |
| `GetStartingChoiceEntries` | read | yes | 2 | `Interface/AddOns/Ascension_WildCard/Dice/WildCardStartingChoice.lua:332`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardStartingChoice.lua:390` |
| `IsAwaitingRapidRollingTalentUpgradeRoll` | query | yes | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:51`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:52` |
| `IsDesiredID` | query | yes | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollDesiredSpellListItemMixin.lua:18`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:86` |
| `IsUndesiredID` | query | yes | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:91`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollUndesiredSpellListItemMixin.lua:22` |
| `RemoveDesiredID` | mutate |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:164` |
| `RemoveUndesiredID` | mutate |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:172` |
| `RepurchaseRolls` | mutate |  | 1 | `Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:155` |
| `RepurchaseTalentRolls` | mutate |  | 1 | `Interface/AddOns/Ascension_RandomModeShared/Gossip/RepurchaseTabMixin.lua:162` |
| `RerollUnlockedStartingAbilities` | mutate |  | 3 | `Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1304`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1319`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardStartingChoice.lua:510` |
| `RollAbilities` | mutate |  | 4 | `Interface/AddOns/Ascension_WildCard/WildCard.lua:161`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1276`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:294`<br>`Interface/FrameXML/StaticPopup.lua:658` |
| `SetFilteredDesiredEntries` | mutate |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:116` |
| `SetFilteredUndesiredEntries` | mutate |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingRender.lua:125` |
| `SetRapidRollingSelections` | mutate |  | 2 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:96`<br>`Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRollingDB.lua:97` |
| `StartRapidRolling` | mutate |  | 1 | `Interface/AddOns/Ascension_WildCard/RapidRolling/RapidRolling.lua:308` |
| `WillRollFirstNonStartingAbility` | read | yes | 2 | `Interface/AddOns/Ascension_WildCard/WildCard.lua:199`<br>`Interface/FrameXML/Util/SkillCardsUtil.lua:106` |
| `WillRollStartingAbilities` | read | yes | 6 | `Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1291`<br>`Interface/AddOns/Ascension_WildCard/Dice/WildCardDice.lua:1292`<br>`Interface/FrameXML/Util/CharacterAdvancementCostUtil.lua:127`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:269`<br>`Interface/FrameXML/Util/CharacterAdvancementUtil.lua:270`<br>`Interface/FrameXML/Util/SkillCardsUtil.lua:105` |

## Live Interface-only call sites (third-party / companion)

Mined under live `Interface\AddOns` (no FrameXML). Useful as runtime confirmation
that engine APIs exist beyond extract UI:

- Companion: AscBuildschmiede (OWN)
- Also seen: Season10Builder, AscensionLogsCompanion, WeakAuras, Details, AscFastRoll, DragonUI
- **No** `C_BuildEditor` references in live AddOns

## Do not ship

- Any `mutate` row above
- Entire `C_BuildEditor` mutate surface (Add/Remove/Set/Publish/Discard/Edit)
- `C_PrimaryStat:SetPrimaryStat` (Learn path via ConfirmOrLearnID)
- Proprietary extract `.lua` files into the repo

