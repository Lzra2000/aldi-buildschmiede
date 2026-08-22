-- Sammelt alles, was die Buildschmiede ueber den Charakter wissen muss.
--
-- Quellen (aus dem Client-Extract verifiziert, AscensionLuaExtract patch-B):
--   C_CharacterAdvancement.GetKnownSpellEntries()  -> gelernte Abilities
--   C_CharacterAdvancement.GetKnownTalentEntries() -> gelernte Talente
--   C_CharacterAdvancement.GetTalentRankByID(id)   -> Rang eines Talents
--   C_CharacterAdvancement.ExportBuild(true)       -> offizieller Build-Code
--   C_PrimaryStat:GetActivePrimaryStat()           -> Path (heisst intern PrimaryStat)
--   C_PrimaryStat:GetPrimaryStatInfo(id)           -> PATHINFO spellId|icon|name
--   C_PrimaryStat:GetPrimaryStatAura(id)           -> PATHAURA spellId
--   C_CharacterAdvancement.GetRemainingAE/TE()     -> freie Essence (ESSENCE A:/T:)
--   C_CharacterAdvancement.GetGlobalAEInvestment() -> ausgegebene AE (ESSENCE AS:, INVEST AE:)
--   C_CharacterAdvancement.GetGlobalTEInvestment() -> ausgegebene TE (ESSENCE TS:, INVEST TE:)
--   C_CharacterAdvancement.GetLearnedAE/TE()       -> Fallback fuer AS:/TS:
--   C_CharacterAdvancement.GetExpectedAE(level)    -> ESSENCE AX: (erwartet fuer Level)
--   C_CharacterAdvancement.GetSuggestedStats()     -> SUGGEST (Path-Vorschlaege)
--   C_CharacterAdvancement.GetTabTEInvestment(c,s,0) -> INVEST TAB:c:s:n
--   C_CharacterAdvancement.GetEntryBySpellID(sid)  -> intern (QOWN-Fallback)
--   C_CharacterAdvancement.IsLockedID(entryId)     -> gesperrte Eintraege (LOCK)
--   C_CharacterAdvancement.GetActiveSpecID()       -> Spec-Index (SPEC)
--   C_CharacterAdvancement.GetActiveChrSpec()      -> SPEC …|CHR:id (CoA; additiv ab 1.5.1)
--   C_CharacterAdvancement.IsTrait(entryId)        -> TRAIT (Draft-Traits; Safe, wenn API)
--   SpecializationUtil.GetSpecializationInfo(id)  -> Spec-Name (optional)
--   C_GameMode:GetActiveGameModes() / IsGameModeActive -> MODE|WILDCARD|DRAFT|…
--   C_Wildcard.IsDesiredID / IsUndesiredID         -> DESIRE / UNDESIRE (entryIds)
--   C_Wildcard.CanRollAbilities / CanShowStartingChoice / WillRoll* / GetMaximumRapidRolls /
--     CanUseRapidRolling / IsAwaitingRapidRollingTalentUpgradeRoll -> WC|…
--   C_Wildcard.GetRapidRollingState()              -> WC|RRPhase/RRStop/RRLearned/RRDesired/RRCanStart
--   C_Wildcard.GetRapidRollAbilityBreakpointInfo() -> WC|RRAbi:cur/req/next
--   C_Wildcard.GetRapidRollTalentBreakpointInfo()  -> WC|RRTal:cur/req/next
--   C_Wildcard.GetNumRepurchasableRolls / GetNumRepurchasableTalentRolls /
--     CanRepurchaseAnyRolls(false)                 -> WC|RepurchAbi/RepurchTal/CanRepurch
--   C_Wildcard.GetStartingChoiceEntries()          -> STARTCHOICE|entryId;…
--   C_PrimaryStat:GetInternalID(id)                -> PATHENTRY|entryId
--   C_CharacterAdvancement.GetAbilityEssenceCost(sid) / GetTalentEssenceCost(sid) -> ECOST
--   C_CharacterAdvancement.IsMastery(sid)          -> MAST
--   C_CharacterAdvancement.GetClassPointInvestment(class, 0) -> INVEST CP:
-- Alles andere ist Stock-3.3.5a (PaperDollFrame.lua CR_* / UnitResistance).
-- Kein Mutate/Learn/SetCard/Claim — nur lesen.
--
-- Additive Export-Schluessel ab 1.4.0 (FORMAT bleibt 1; Website-Parser bitte ergaenzen):
--   ESSENCE|A:rem|T:rem|AS:spent|TS:spent   (A:/T: unveraendert = Remaining)
--   LOCK|entryId;entryId;…
--   SPEC|id|name
--   MODE|WILDCARD
--   ECOST|spellId:ae:te;…
--   MAST|spellId;…
--   INVEST|AE:n|TE:n|CP:n
--   STAT|…|HITPCT:n|SHITPCT:n|EXP:n|EXPPCT:n|MP5:n|SPECPEN:n
--        |HOLY:n|FIRE:n|NATURE:n|FROST:n|SHADOW:n|ARCANE:n
--   GEAR|Slot|Name|ilvl|quality|subtype|itemId[|ench][|g1|g2|g3|g4]
--        Felder 1–5 unveraendert; itemId und folgende additiv (alte Parser ignorieren Extra).
--   WEAPON|tag|name|ilvlN|speedN|lo-hi|dpsN|loc|sub|itemId[|ench][|g1|g2|g3|g4]
--   Item-Link 3.3.5a: |Hitem:itemId:ench:gem1:gem2:gem3:gem4:suffix:unique:…|h
--
-- Additive Export-Schluessel ab 1.5.0 (FORMAT bleibt 1):
--   ESSENCE|…|AX:expectedAtLevel          (GetExpectedAE(UnitLevel))
--   INVEST|…|TAB:class:spec:n;…           (GetTabTEInvestment, nur >0)
--   SUGGEST|PathName;PathName;…           (GetSuggestedStats → PATH_NAME)
--   PATHINFO|spellId|icon|name            (GetPrimaryStatInfo)
--   PATHAURA|spellId                      (GetPrimaryStatAura)
--   MODE|WILDCARD|DRAFT|…                 (GetActiveGameModes; Tags uppercase)
--   DESIRE|entryId;…                      (C_Wildcard.IsDesiredID)
--   UNDESIRE|entryId;…                    (C_Wildcard.IsUndesiredID)
--   WC|CanRoll:0/1|Starting:0/1|WillStart:0/1|WillFirst:0/1|MaxRapid:n|CanRapid:0/1|AwaitTalent:0/1
--   SCARD/CARDED/SCARDPEND                (siehe SkillCards.lua)
--
-- Additive Export-Schluessel ab 1.5.1 (FORMAT bleibt 1):
--   PATHENTRY|entryId                     (GetInternalID / GetPrimaryStatInfo[2])
--   SPEC|id|name|CHR:chrId                (CHR: nur wenn GetActiveChrSpec greift)
--   TRAIT|entryId;…                       (IsTrait auf bekannten Entries)
--   STARTCHOICE|entryId;…                 (GetStartingChoiceEntries)
--   WC|…|RRPhase:s|RRStop:s|RRLearned:n|RRDesired:0/1|RRCanStart:0/1
--                                         (GetRapidRollingState — nur Skalare)
--
-- Additive Export-Schluessel ab 1.5.2 (FORMAT bleibt 1):
--   WC|…|RRAbi:cur/req/next|RRTal:cur/req/next
--                                         (GetRapidRoll*BreakpointInfo)
--   WC|…|RepurchAbi:n|RepurchTal:n|CanRepurch:0/1
--                                         (GetNumRepurchasable* / CanRepurchaseAnyRolls)
--
-- 1.5.19 (FORMAT bleibt 1): Desire/Undesire scannen ipairs+pairs und Type=0;
--   Filtered-Desire-APIs als Nachzug. Skill Cards: cardId aus Tabelle + :s
--   auch ohne cardId.
-- 1.5.10 (FORMAT bleibt 1): QUALITY/QCOST nicht mehr an Quality.lua koppeln —
--   Fallback-Collector in dieser Datei; fehlende BS.Collect*-Felder kosten
--   eine Zeile, nie den ganzen Export.
-- 1.5.9 (FORMAT bleibt 1): SkillCards :sSPELLID robuster (InfoAtIndex + extra
--   GetCardAtIndex-Werte). Token-Form unveraendert.
-- 1.5.8 (FORMAT bleibt 1, Token-Form unveraendert):
--   ABI/TAL hydrieren Stubs via GetEntryByInternalID; Spell-ID auch aus SpellID
--   und GetKnownSpells-Nachzug. @entryId auch ohne #spellId. Name bevorzugt
--   GetSpellInfo (wie Inspect-UI / Skill Cards) — sonst entry.Name.

local BS = AscBuildschmiede
local Safe, Clean, Num = BS.Safe, BS.Clean, BS.Num

-- Enum.PrimaryStat: 1 Strength, 2 Agility, 3 Intellect, 4 Spirit, 6 Duality.
-- Spirit ist der Path, den die Oberflaeche "Healing" nennt.
local PATH_NAME = {
    [1] = "Strength",
    [2] = "Agility",
    [3] = "Intelligence",
    [4] = "Healing",
    [6] = "Duality",
}

-- PaperDollFrame.lua (3.3.5a): CR_HIT_MELEE=6, CR_HIT_SPELL=8, CR_CRIT_MELEE=9,
-- CR_HASTE_SPELL=20, CR_EXPERTISE=24. UnitResistance: 1 Holy .. 6 Arcane.
local CR_HIT_MELEE = 6
local CR_HIT_SPELL = 8
local CR_CRIT_MELEE = 9
local CR_HASTE_SPELL = 20
local CR_EXPERTISE = 24

local RESIST_FIELDS = {
    { 1, "HOLY" }, { 2, "FIRE" }, { 3, "NATURE" },
    { 4, "FROST" }, { 5, "SHADOW" }, { 6, "ARCANE" },
}

local GEAR_SLOTS = {
    { 1, "Head" }, { 2, "Neck" }, { 3, "Shoulder" }, { 15, "Back" },
    { 5, "Chest" }, { 9, "Wrist" }, { 10, "Hands" }, { 6, "Waist" },
    { 7, "Legs" }, { 8, "Feet" }, { 11, "Ring1" }, { 12, "Ring2" },
    { 13, "Trinket1" }, { 14, "Trinket2" },
    { 16, "MainHand" }, { 17, "OffHand" }, { 18, "Ranged" },
}

local function activePrimaryStatId()
    return Safe(function()
        return C_PrimaryStat and C_PrimaryStat.GetActivePrimaryStat
            and C_PrimaryStat:GetActivePrimaryStat()
    end)
end

local function pathName()
    local id = activePrimaryStatId()
    if not id then return nil end
    -- Der Client haelt den Anzeigenamen in PRIMARY_STAT_<n>_NAME_COA.
    local shown = _G["PRIMARY_STAT_" .. id .. "_NAME_COA"] or _G["PRIMARY_STAT" .. id .. "_NAME"]
    return PATH_NAME[id] or Clean(shown) or ("ID" .. id)
end

-- PATHINFO|spellId|icon|name — GetPrimaryStatInfo (Extract C_PrimaryStat.lua).
function BS.CollectPathInfo()
    local id = activePrimaryStatId()
    if not id then return nil end
    local spellId, _, icon, statName, spellName = Safe(function()
        return C_PrimaryStat and C_PrimaryStat.GetPrimaryStatInfo
            and C_PrimaryStat:GetPrimaryStatInfo(id)
    end)
    spellId = tonumber(spellId)
    if not spellId then return nil end
    local name = Clean(statName or spellName or PATH_NAME[id] or "")
    if name == "" then name = PATH_NAME[id] or ("ID" .. id) end
    return Num(spellId) .. "|" .. Clean(icon or "-") .. "|" .. name
end

-- PATHENTRY|entryId — CA-Internal-ID des aktiven Path (GetInternalID / Info[2]).
function BS.CollectPathEntry()
    local id = activePrimaryStatId()
    if not id then return nil end
    local entryId = Safe(function()
        return C_PrimaryStat and C_PrimaryStat.GetInternalID
            and C_PrimaryStat:GetInternalID(id)
    end)
    entryId = tonumber(entryId)
    if not entryId then
        local _, internalId = Safe(function()
            return C_PrimaryStat and C_PrimaryStat.GetPrimaryStatInfo
                and C_PrimaryStat:GetPrimaryStatInfo(id)
        end)
        entryId = tonumber(internalId)
    end
    if not entryId then return nil end
    return Num(entryId)
end

-- PATHAURA|spellId — Crosscheck gegen den Path-Aura-Buff.
function BS.CollectPathAura()
    local id = activePrimaryStatId()
    if not id then return nil end
    local aura = Safe(function()
        return C_PrimaryStat and C_PrimaryStat.GetPrimaryStatAura
            and C_PrimaryStat:GetPrimaryStatAura(id)
    end)
    aura = tonumber(aura)
    if not aura then return nil end
    return Num(aura)
end

-- Enum.PrimaryStat-Schluessel (String) → Anzeigename fuer SUGGEST.
local function suggestPathLabel(key)
    if key == nil then return nil end
    local id = tonumber(key)
    if not id and Enum and Enum.PrimaryStat then
        id = Enum.PrimaryStat[key]
    end
    if id and PATH_NAME[id] then return PATH_NAME[id] end
    local s = Clean(key)
    if s == "" then return nil end
    -- Client liefert oft "Intellect"; unsere PATH-Zeile nutzt "Intelligence".
    if s == "Intellect" then return "Intelligence" end
    if s == "Spirit" then return "Healing" end
    return s
end

-- SUGGEST|Path;Path;… — GetSuggestedStats (ForcedPrimaryStat.lua).
function BS.CollectSuggestedStats()
    local top, rest = Safe(function()
        return C_CharacterAdvancement and C_CharacterAdvancement.GetSuggestedStats
            and C_CharacterAdvancement.GetSuggestedStats()
    end)
    if not top then return nil end
    local out, seen = {}, {}
    local function add(key)
        local label = suggestPathLabel(key)
        if not label or seen[label] then return end
        seen[label] = true
        out[#out + 1] = label
    end
    add(top)
    if type(rest) == "table" then
        for _, key in pairs(rest) do
            add(key)
        end
    end
    if #out == 0 then return nil end
    return out
end

-- MODE-Tags aus GetActiveGameModes; Fallback IsGameModeActive(WildCard/Draft).
local MODE_TAG = {
    WildCard = "WILDCARD",
    Draft = "DRAFT",
    BuildDraft = "BUILDDRAFT",
    Felforged = "FELFORGED",
    Random = "RANDOM",
    Ironman = "IRONMAN",
    Survivalist = "SURVIVALIST",
    Resolute = "RESOLUTE",
    Nightmare = "NIGHTMARE",
    FreepickRarities = "FREEPICKRARITIES",
    Crusader = "CRUSADER",
}

function BS.CollectGameModes()
    local modes = Safe(function()
        return C_GameMode and C_GameMode.GetActiveGameModes
            and C_GameMode:GetActiveGameModes()
    end)
    local out, seen = {}, {}
    local function push(tag)
        if not tag or seen[tag] then return end
        seen[tag] = true
        out[#out + 1] = tag
    end
    if type(modes) == "table" then
        -- Bekannte Reihenfolge zuerst, dann Rest.
        for _, key in ipairs({
            "WildCard", "Draft", "BuildDraft", "Felforged",
            "Random", "Ironman", "Survivalist", "Resolute",
            "Nightmare", "FreepickRarities", "Crusader",
        }) do
            if modes[key] then push(MODE_TAG[key] or string.upper(key)) end
        end
        for key, on in pairs(modes) do
            if on and key ~= "None" then
                push(MODE_TAG[key] or string.upper(tostring(key)))
            end
        end
    end
    if #out == 0 then
        -- Fallback ohne GetActiveGameModes.
        if Safe(function()
            return C_GameMode and C_GameMode.IsGameModeActive
                and Enum and Enum.GameMode and Enum.GameMode.WildCard
                and C_GameMode:IsGameModeActive(Enum.GameMode.WildCard)
        end) then push("WILDCARD") end
        if Safe(function()
            return C_GameMode and C_GameMode.IsGameModeActive
                and Enum and Enum.GameMode and Enum.GameMode.Draft
                and C_GameMode:IsGameModeActive(Enum.GameMode.Draft)
        end) then push("DRAFT") end
    end
    if #out == 0 then return nil end
    return out
end

-- Desire/Undesire: Katalog + bekannte Entries. Type=0 (Ability) nicht
-- als fehlend werten — sonst bleibt die Wunschliste leer.
local function collectWildcardFlagged(checker)
    if type(checker) ~= "function" then return nil end
    local out, seen = {}, {}
    local function consider(e)
        local eid
        if type(e) == "table" then
            eid = tonumber(e.ID or e.EntryID or e.InternalID or e.internalID or e.entryId)
        else
            eid = tonumber(e)
        end
        if not eid or seen[eid] then return end
        local etype = type(e) == "table" and (e.Type or e.EntryType) or nil
        local yes = Safe(function()
            return checker(eid)
        end)
        if not yes and etype ~= nil then
            yes = Safe(function()
                return checker(eid, etype)
            end)
        end
        if yes then
            seen[eid] = true
            out[#out + 1] = Num(eid)
        end
    end
    local function scan(list)
        if type(list) ~= "table" then return end
        for _, e in ipairs(list) do consider(e) end
        for _, e in pairs(list) do consider(e) end
    end
    scan(Safe(function()
        return C_CharacterAdvancement and C_CharacterAdvancement.GetAllEntries
            and C_CharacterAdvancement.GetAllEntries()
    end))
    scan(Safe(function()
        return C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries
            and C_CharacterAdvancement.GetKnownSpellEntries()
    end))
    scan(Safe(function()
        return C_CharacterAdvancement and C_CharacterAdvancement.GetKnownTalentEntries
            and C_CharacterAdvancement.GetKnownTalentEntries()
    end))
    if #out == 0 then return nil end
    table.sort(out, function(a, b) return tonumber(a) < tonumber(b) end)
    return out
end

local function mergeFilteredIds(out, nFn, atFn)
    if type(nFn) ~= "function" or type(atFn) ~= "function" then return out end
    local n = tonumber((Safe(nFn)))
    if not n or n <= 0 then return out end
    out = out or {}
    local seen = {}
    for _, id in ipairs(out) do seen[tonumber(id)] = true end
    for i = 0, n do
        local e = Safe(function() return atFn(i) end)
        local eid
        if type(e) == "table" then
            eid = tonumber(e.ID or e.EntryID or e.InternalID or e.entryId)
        else
            eid = tonumber(e)
        end
        if eid and not seen[eid] then
            seen[eid] = true
            out[#out + 1] = Num(eid)
        end
    end
    if #out == 0 then return nil end
    table.sort(out, function(a, b) return tonumber(a) < tonumber(b) end)
    return out
end

function BS.CollectDesired()
    local out = collectWildcardFlagged(C_Wildcard and C_Wildcard.IsDesiredID)
    if C_Wildcard then
        out = mergeFilteredIds(out,
            C_Wildcard.GetNumFilteredDesiredEntries,
            C_Wildcard.GetFilteredDesiredEntryAtIndex)
    end
    return out
end

function BS.CollectUndesired()
    local out = collectWildcardFlagged(C_Wildcard and C_Wildcard.IsUndesiredID)
    if C_Wildcard then
        out = mergeFilteredIds(out,
            C_Wildcard.GetNumFilteredUndesiredEntries,
            C_Wildcard.GetFilteredUndesiredEntryAtIndex)
    end
    return out
end

-- WC|… — nur Safe-bestaetigte Read-Getter (keine Roll/Add/Clear).
function BS.CollectWildcardStatus()
    if type(C_Wildcard) ~= "table" then return nil end
    local parts = {}
    local function flag(key, fn)
        if type(fn) ~= "function" then return end
        local v = Safe(fn)
        if v == nil then return end
        parts[#parts + 1] = key .. ":" .. (v and 1 or 0)
    end
    local function num(key, fn)
        if type(fn) ~= "function" then return end
        -- Safe kann Mehrfachwerte liefern; Klammern → nur erstes an tonumber.
        local v = tonumber((Safe(fn)))
        if v == nil then return end
        parts[#parts + 1] = key .. ":" .. Num(v)
    end
    flag("CanRoll", C_Wildcard.CanRollAbilities)
    flag("Starting", C_Wildcard.CanShowStartingChoice)
    flag("WillStart", C_Wildcard.WillRollStartingAbilities)
    flag("WillFirst", C_Wildcard.WillRollFirstNonStartingAbility)
    num("MaxRapid", C_Wildcard.GetMaximumRapidRolls)
    flag("CanRapid", C_Wildcard.CanUseRapidRolling)
    flag("AwaitTalent", C_Wildcard.IsAwaitingRapidRollingTalentUpgradeRoll)

    -- GetRapidRollingState: Tabelle; nur Skalare (Phase/StopCode/Learned/Desired/CanStart).
    local state = Safe(function()
        return C_Wildcard.GetRapidRollingState and C_Wildcard.GetRapidRollingState()
    end)
    if type(state) == "table" then
        if state.Phase ~= nil then
            parts[#parts + 1] = "RRPhase:" .. Clean(state.Phase)
        end
        if state.StopCode ~= nil and tostring(state.StopCode) ~= "" then
            parts[#parts + 1] = "RRStop:" .. Clean(state.StopCode)
        end
        local learned = tonumber(state.LearnedEntryID)
        if learned then
            parts[#parts + 1] = "RRLearned:" .. Num(learned)
        end
        if state.IsDesired ~= nil then
            parts[#parts + 1] = "RRDesired:" .. (state.IsDesired and 1 or 0)
        end
        if state.CanStart ~= nil then
            parts[#parts + 1] = "RRCanStart:" .. (state.CanStart and 1 or 0)
        end
    end

    -- Breakpoints: currentRolls, rollsRequired, nextMaxRoll (RapidRollingRender).
    local function breakpoint(key, fn)
        if type(fn) ~= "function" then return end
        local cur, req, nxt = Safe(fn)
        cur, req, nxt = tonumber(cur), tonumber(req), tonumber(nxt)
        if cur == nil and req == nil and nxt == nil then return end
        -- UI blendet aus wenn rollsRequired == 0; dann nichts exportieren.
        if (req or 0) <= 0 and (cur or 0) <= 0 then return end
        parts[#parts + 1] = key .. ":" .. Num(cur or 0) .. "/" .. Num(req or 0) .. "/" .. Num(nxt or 0)
    end
    breakpoint("RRAbi", C_Wildcard.GetRapidRollAbilityBreakpointInfo)
    breakpoint("RRTal", C_Wildcard.GetRapidRollTalentBreakpointInfo)

    -- Repurchase-Kontingent (nur Anzahl / Can*; Kosten brauchen amount+gold — UI).
    num("RepurchAbi", C_Wildcard.GetNumRepurchasableRolls)
    num("RepurchTal", C_Wildcard.GetNumRepurchasableTalentRolls)
    if type(C_Wildcard.CanRepurchaseAnyRolls) == "function" then
        local v = Safe(function()
            return C_Wildcard.CanRepurchaseAnyRolls(false)
        end)
        if v ~= nil then
            parts[#parts + 1] = "CanRepurch:" .. (v and 1 or 0)
        end
    end

    if #parts == 0 then return nil end
    return parts
end

-- STARTCHOICE|entryId;… — offene Starting-Choice (WildCardStartingChoice.lua).
function BS.CollectStartingChoice()
    local entries = Safe(function()
        return C_Wildcard and C_Wildcard.GetStartingChoiceEntries
            and C_Wildcard.GetStartingChoiceEntries()
    end)
    if type(entries) ~= "table" then return nil end
    local out, seen = {}, {}
    for _, e in ipairs(entries) do
        local eid = nil
        if type(e) == "table" then
            eid = tonumber(e.EntryID or e.InternalID or e.internalID or e.ID)
        else
            eid = tonumber(e)
        end
        if eid and not seen[eid] then
            seen[eid] = true
            out[#out + 1] = Num(eid)
        end
    end
    if #out == 0 then return nil end
    return out
end

local function entryList(getter)
    local list = Safe(getter)
    if type(list) ~= "table" then return {} end
    -- ipairs zuerst (stabile Array-Reihenfolge); pairs faengt Loecher
    -- und id-indizierte Tabellen — sonst fehlen Eintraege still.
    local out, seen = {}, {}
    for _, e in ipairs(list) do
        if type(e) == "table" and not seen[e] then
            seen[e] = true
            out[#out + 1] = e
        end
    end
    for _, e in pairs(list) do
        if type(e) == "table" and not seen[e] then
            seen[e] = true
            out[#out + 1] = e
        end
    end
    return out
end

function BS.EntryByInternalID(entryId)
    entryId = tonumber(entryId)
    if not entryId then return nil end
    local entry = Safe(function()
        return C_CharacterAdvancement and C_CharacterAdvancement.GetEntryByInternalID
            and C_CharacterAdvancement.GetEntryByInternalID(entryId)
    end)
    if type(entry) == "table" then return entry end
    return nil
end

function BS.EntryBySpellID(spellId)
    spellId = tonumber(spellId)
    if not spellId then return nil end
    local entry = Safe(function()
        return C_CharacterAdvancement and C_CharacterAdvancement.GetEntryBySpellID
            and C_CharacterAdvancement.GetEntryBySpellID(spellId)
    end)
    if type(entry) == "table" then return entry end
    return nil
end

-- Stubs (nur ID/Rank) mit GetEntryByInternalID auffuellen — sonst fehlen
-- Name und Spells[] und ABI/TAL gehen ohne IDs raus oder ganz verloren.
function BS.HydrateEntry(e)
    if type(e) ~= "table" then return nil end
    local eid = tonumber(e.ID or e.EntryId or e.InternalID or e.internalID)
    local hasName = e.Name and tostring(e.Name) ~= ""
    local hasSpells = type(e.Spells) == "table"
    if eid and (not hasName or not hasSpells) then
        local full = BS.EntryByInternalID(eid)
        if type(full) == "table" then
            return {
                ID = eid,
                Name = (hasName and e.Name) or full.Name,
                Spells = hasSpells and e.Spells or full.Spells,
                Rank = e.Rank or full.Rank,
                Type = e.Type or full.Type,
                Class = e.Class or full.Class,
                Tab = e.Tab or full.Tab,
                Spec = e.Spec or full.Spec,
                SpecID = e.SpecID or full.SpecID,
                SpellID = e.SpellID or e.spellID or full.SpellID or full.spellID,
            }
        end
    end
    if eid and not e.ID then
        e = {
            ID = eid,
            Name = e.Name,
            Spells = e.Spells,
            Rank = e.Rank,
            Type = e.Type,
            Class = e.Class,
            Tab = e.Tab,
            Spec = e.Spec,
            SpecID = e.SpecID,
            SpellID = e.SpellID or e.spellID,
        }
    end
    return e
end

-- Spell-ID: Spells[rank], Spells[1], SpellID-Feld, hydrierter Entry.
function BS.SpellFromEntry(e, rank)
    e = BS.HydrateEntry(e) or e
    if type(e) ~= "table" then return nil end
    rank = tonumber(rank) or tonumber(e.Rank) or 1
    if type(e.Spells) == "table" then
        local sid = tonumber(e.Spells[rank]) or tonumber(e.Spells[1])
        if sid then return sid end
    end
    local sid = tonumber(e.SpellID) or tonumber(e.spellID)
    if sid then return sid end
    return nil
end

-- Anzeigename wie die Client-UI: GetSpellInfo(sid), sonst entry.Name.
function BS.SpellDisplayName(sid, entry)
    sid = tonumber(sid)
    if sid then
        local n = Safe(function()
            return GetSpellInfo(sid)
        end)
        n = Clean(n)
        if n ~= "" then return n end
    end
    if type(entry) == "table" and entry.Name then
        local n = Clean(entry.Name)
        if n ~= "" then return n end
    end
    return nil
end

local function spellFromEntry(e, rank)
    return BS.SpellFromEntry(e, rank)
end

local function spellFromEntryOrApi(e, rank)
    return BS.SpellFromEntry(e, rank)
end

-- Encoding: Name[:rank][#spellId][@entryId].
-- @entryId auch ohne Spell-ID (Seite liest @ zuerst). Leerer Name wird ein
-- Leerzeichen — der Parser braucht ein Zeichen vor #/@, trimmt dann leer
-- und akzeptiert eid/sid (namesCompatible).
function BS.EncodeAbiTalToken(name, rank, spellId, entryId)
    name = Clean(name)
    if name == "" then name = " " end
    local tag = name
    if rank then
        tag = tag .. ":" .. Num(rank)
    end
    spellId = tonumber(spellId)
    entryId = tonumber(entryId)
    if spellId then
        tag = tag .. "#" .. Num(spellId)
    end
    if entryId then
        tag = tag .. "@" .. Num(entryId)
    end
    return tag
end

local function encodeToken(name, rank, spellId, entryId)
    return BS.EncodeAbiTalToken(name, rank, spellId, entryId)
end

local function isTalentEntry(e, sid)
    if type(e) == "table" then
        local kind = e.Type
        if kind == "Talent" or kind == "TalentAbility" then
            return true
        end
        local eid = tonumber(e.ID)
        if eid then
            local yes = Safe(function()
                return C_CharacterAdvancement.IsTalentID
                    and (C_CharacterAdvancement.IsTalentID(eid)
                        or (C_CharacterAdvancement.IsTalentAbilityID
                            and C_CharacterAdvancement.IsTalentAbilityID(eid)))
            end)
            if yes then return true end
        end
    end
    sid = tonumber(sid)
    if sid then
        local rank = Safe(function()
            return C_CharacterAdvancement.GetTalentRankBySpellID
                and C_CharacterAdvancement.GetTalentRankBySpellID(sid)
        end)
        if tonumber(rank) then return true end
        local yes = Safe(function()
            return (C_CharacterAdvancement.IsTalentSpellID
                    and C_CharacterAdvancement.IsTalentSpellID(sid))
                or (C_CharacterAdvancement.IsTalentAbilitySpellID
                    and C_CharacterAdvancement.IsTalentAbilitySpellID(sid))
        end)
        if yes then return true end
    end
    return false
end

-- GetKnownSpells = vollstaendige Spell-ID-Liste (Build-Editor ImportCurrentBuild).
-- Faengt Eintraege, die in GetKnown*Entries fehlen.
local function knownSpellIds()
    local list = Safe(function()
        return C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpells
            and C_CharacterAdvancement.GetKnownSpells()
    end)
    if type(list) ~= "table" then return {} end
    local out, seen = {}, {}
    local function add(sid)
        sid = tonumber(sid)
        if not sid or seen[sid] then return end
        seen[sid] = true
        out[#out + 1] = sid
    end
    for _, sid in ipairs(list) do add(sid) end
    for _, sid in pairs(list) do add(sid) end
    return out
end

-- |Hitem:itemId:ench:gem1:gem2:gem3:gem4:…|h  — Stock-3.3.5a Linkformat.
local function parseItemLink(link)
    if type(link) ~= "string" then return nil end
    local itemId, ench, g1, g2, g3, g4 = link:match(
        "item:(%-?%d+):(%-?%d*):(%-?%d*):(%-?%d*):(%-?%d*):(%-?%d*)"
    )
    itemId = tonumber(itemId)
    if not itemId then return nil end
    return {
        itemId = itemId,
        ench = tonumber(ench) or 0,
        g1 = tonumber(g1) or 0,
        g2 = tonumber(g2) or 0,
        g3 = tonumber(g3) or 0,
        g4 = tonumber(g4) or 0,
    }
end

-- Haengt itemId und optional Enchant/Gems an eine bereits gebaute Zeile.
local function appendLinkIds(line, link)
    local p = parseItemLink(link)
    if not p then return line end
    line = line .. "|" .. Num(p.itemId)
    local hasExtra = p.ench > 0 or p.g1 > 0 or p.g2 > 0 or p.g3 > 0 or p.g4 > 0
    if hasExtra then
        line = line .. "|" .. Num(p.ench)
            .. "|" .. Num(p.g1) .. "|" .. Num(p.g2)
            .. "|" .. Num(p.g3) .. "|" .. Num(p.g4)
    end
    return line
end

local function talentRankOf(e)
    local eid = e and tonumber(e.ID)
    if eid then
        local rank = Safe(function()
            return C_CharacterAdvancement.GetTalentRankByID(eid)
        end)
        rank = tonumber(rank)
        if rank then return rank end
    end
    return tonumber(e and e.Rank) or 1
end

function BS.CollectAbilities()
    local out, seenEid, seenSid = {}, {}, {}
    local function add(e, sid, eid)
        e = BS.HydrateEntry(e) or e
        sid = tonumber(sid) or spellFromEntry(e, tonumber(e and e.Rank) or 1)
        eid = tonumber(eid) or (e and tonumber(e.ID))
        if not sid and not eid then return end
        if eid and seenEid[eid] then return end
        if sid and seenSid[sid] then return end
        local name = BS.SpellDisplayName(sid, e)
        -- Ohne Name/ID nichts exportieren — ein leeres Token wuerde nur rauschen.
        if not name and not sid and not eid then return end
        if eid then seenEid[eid] = true end
        if sid then seenSid[sid] = true end
        out[#out + 1] = encodeToken(name, nil, sid, eid)
    end

    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries)) do
        if e then add(e) end
    end

    -- Nachzug: Spell-IDs, die der Build-Editor kennt, Entries aber weglassen.
    for _, sid in ipairs(knownSpellIds()) do
        if not seenSid[sid] then
            local e = BS.EntryBySpellID(sid)
            if not isTalentEntry(e, sid) then
                add(e, sid, e and e.ID)
            end
        end
    end

    table.sort(out)
    return out
end

function BS.CollectTalents()
    local out, seenEid, seenSid = {}, {}, {}
    local function add(e, sid, eid, rank)
        e = BS.HydrateEntry(e) or e
        rank = tonumber(rank) or talentRankOf(e)
        sid = tonumber(sid) or spellFromEntry(e, rank)
        eid = tonumber(eid) or (e and tonumber(e.ID))
        if not sid and not eid then return end
        if eid and seenEid[eid] then return end
        if sid and seenSid[sid] then return end
        local name = BS.SpellDisplayName(sid, e)
        if not name and not sid and not eid then return end
        if eid then seenEid[eid] = true end
        if sid then seenSid[sid] = true end
        out[#out + 1] = encodeToken(name, rank, sid, eid)
    end

    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownTalentEntries)) do
        if e then add(e) end
    end

    for _, sid in ipairs(knownSpellIds()) do
        if not seenSid[sid] and isTalentEntry(BS.EntryBySpellID(sid), sid) then
            local e = BS.EntryBySpellID(sid)
            local rank = Safe(function()
                return C_CharacterAdvancement.GetTalentRankBySpellID
                    and C_CharacterAdvancement.GetTalentRankBySpellID(sid)
            end)
            add(e, sid, e and e.ID, tonumber(rank))
        end
    end

    table.sort(out)
    return out
end

-- Seltenheits-Budget. Canonical hier, damit der Export nicht abstuerzt wenn
-- Quality.lua fehlt, nicht geladen hat oder BS.CollectQuality nie gesetzt hat.
-- Quality.lua darf dieselben Funktionen zuerst setzen; wir fuellen nur Luecken.
local QNAME = {
    [2] = "Uncommon",
    [3] = "Rare",
    [4] = "Epic",
    [5] = "Legendary",
}

if type(BS.CollectQuality) ~= "function" then
    function BS.CollectQuality()
        local out = {}
        for q = 2, 5 do
            local count = Safe(function()
                return C_CharacterAdvancement.GetQualityCount(q)
            end)
            local limit = Safe(function()
                return C_CharacterAdvancement.GetQualityLimit(q)
            end)
            if count or limit then
                out[#out + 1] = QNAME[q] .. ":" .. Num(count or 0) .. "/" .. Num(limit or 0)
            end
        end
        return out
    end
end

if type(BS.CollectQualityCost) ~= "function" then
    function BS.CollectQualityCost()
        local entries = Safe(function()
            return C_CharacterAdvancement.GetAllEntries()
        end)
        if type(entries) ~= "table" then return nil end

        local lo, hi, seen = {}, {}, false
        for _, e in ipairs(entries) do
            local spellID = e and e.Spells
            if type(spellID) == "table" then spellID = spellID[1] end
            if spellID then
                local q, cost = Safe(function()
                    return C_CharacterAdvancement.GetQualityInfo(spellID)
                end)
                q = tonumber(q)
                cost = tonumber(cost)
                if q and QNAME[q] and cost and cost > 0 then
                    seen = true
                    if not lo[q] or cost < lo[q] then lo[q] = cost end
                    if not hi[q] or cost > hi[q] then hi[q] = cost end
                end
            end
        end
        if not seen then return nil end

        local out = {}
        for q = 2, 5 do
            if lo[q] then
                out[#out + 1] = QNAME[q] .. ":" .. Num(lo[q]) ..
                    (hi[q] ~= lo[q] and ("-" .. Num(hi[q])) or "")
            end
        end
        return out
    end
end

-- Pro besessenem Eintrag: spellId:quality:cost — damit die Seite Budget
-- gegen echte Kosten rechnen kann, nicht nur gegen den Katalogdurchschnitt.
function BS.CollectOwnedQuality()
    local out, seen = {}, {}
    local function add(e, rank)
        e = BS.HydrateEntry(e) or e
        local sid = spellFromEntry(e, rank)
        if not sid or seen[sid] then return end
        seen[sid] = true
        local q, cost = Safe(function()
            return C_CharacterAdvancement.GetQualityInfo(sid)
        end)
        q, cost = tonumber(q), tonumber(cost)
        if q and cost and cost > 0 then
            out[#out + 1] = Num(sid) .. ":" .. Num(q) .. ":" .. Num(cost)
        end
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries)) do
        if e then add(e, tonumber(e.Rank) or 1) end
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownTalentEntries)) do
        if e then
            local rank = Safe(function()
                return C_CharacterAdvancement.GetTalentRankByID(e.ID)
            end)
            add(e, tonumber(rank) or tonumber(e.Rank) or 1)
        end
    end
    table.sort(out)
    return out
end

-- Entry-IDs, die der Spieler gesperrt hat (Wildcard-Lock). Nur bekannte
-- Spell-/Talent-Eintraege pruefen — IsLockedID auf dem ganzen Katalog waere teuer.
function BS.CollectLocked()
    local out, seen = {}, {}
    local function add(e)
        local eid = e and tonumber(e.ID)
        if not eid or seen[eid] then return end
        local locked = Safe(function()
            return C_CharacterAdvancement.IsLockedID(eid)
        end)
        if locked then
            seen[eid] = true
            out[#out + 1] = Num(eid)
        end
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries)) do
        add(e)
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownTalentEntries)) do
        add(e)
    end
    table.sort(out, function(a, b) return tonumber(a) < tonumber(b) end)
    return out
end

-- Spec-Index plus Anzeigename, falls SpecializationUtil erreichbar ist.
-- Optional CHR: aus GetActiveChrSpec (CoA; getrennt von GetActiveSpecID).
function BS.CollectSpec()
    local id = Safe(function()
        return C_CharacterAdvancement.GetActiveSpecID()
    end)
    id = tonumber(id)
    if not id then return nil end
    local name = Safe(function()
        if not SpecializationUtil or not SpecializationUtil.GetSpecializationInfo then
            return nil
        end
        local n = SpecializationUtil.GetSpecializationInfo(id)
        return n
    end)
    name = Clean(name)
    if name == "" then name = nil end
    local chr = Safe(function()
        return C_CharacterAdvancement.GetActiveChrSpec
            and C_CharacterAdvancement.GetActiveChrSpec()
    end)
    chr = tonumber(chr)
    return id, name, chr
end

-- TRAIT|entryId;… — IsTrait auf bekannten Ability-/Talent-Entries (DraftCardMixin).
function BS.CollectTraits()
    if not (C_CharacterAdvancement and type(C_CharacterAdvancement.IsTrait) == "function") then
        return nil
    end
    local out, seen = {}, {}
    local function add(e)
        local eid = e and tonumber(e.ID)
        if not eid or seen[eid] then return end
        local yes = Safe(function()
            return C_CharacterAdvancement.IsTrait(eid)
        end)
        if yes then
            seen[eid] = true
            out[#out + 1] = Num(eid)
        end
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement.GetKnownSpellEntries)) do
        add(e)
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement.GetKnownTalentEntries)) do
        add(e)
    end
    if #out == 0 then return nil end
    table.sort(out, function(a, b) return tonumber(a) < tonumber(b) end)
    return out
end

function BS.IsWildCardMode()
    local yes = Safe(function()
        return C_GameMode and C_GameMode.IsGameModeActive
            and Enum and Enum.GameMode and Enum.GameMode.WildCard
            and C_GameMode:IsGameModeActive(Enum.GameMode.WildCard)
    end)
    return yes and true or false
end

-- AE/TE-Kosten je bekannter Spell-ID (Faehigkeiten und Talente).
function BS.CollectEssenceCosts()
    local out, seen = {}, {}
    local function add(sid)
        sid = tonumber(sid)
        if not sid or seen[sid] then return end
        seen[sid] = true
        local ae = Safe(function()
            return C_CharacterAdvancement.GetAbilityEssenceCost(sid)
        end)
        local te = Safe(function()
            return C_CharacterAdvancement.GetTalentEssenceCost(sid)
        end)
        ae, te = tonumber(ae), tonumber(te)
        if (ae and ae > 0) or (te and te > 0) then
            out[#out + 1] = Num(sid) .. ":" .. Num(ae or 0) .. ":" .. Num(te or 0)
        end
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries)) do
        if e then add(spellFromEntry(e, tonumber(e.Rank) or 1)) end
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownTalentEntries)) do
        if e then
            local rank = Safe(function()
                return C_CharacterAdvancement.GetTalentRankByID(e.ID)
            end)
            add(spellFromEntry(e, tonumber(rank) or tonumber(e.Rank) or 1))
        end
    end
    table.sort(out)
    return out
end

-- Masteries unter den bekannten Faehigkeiten (IsMastery(spellId)).
function BS.CollectMasteries()
    local out, seen = {}, {}
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries)) do
        local sid = spellFromEntry(e, 1)
        if sid and not seen[sid] then
            local yes = Safe(function()
                return C_CharacterAdvancement.IsMastery(sid)
            end)
            if yes then
                seen[sid] = true
                out[#out + 1] = Num(sid)
            end
        end
    end
    table.sort(out, function(a, b) return tonumber(a) < tonumber(b) end)
    return out
end

-- Globale Investments: AE/TE global, CP summiert ueber Klassen der bekannten Entries.
-- TAB:class:spec:n aus GetTabTEInvestment (nur Werte > 0; Args wie CAClassButton).
function BS.CollectInvestment()
    local ae = Safe(function() return C_CharacterAdvancement.GetGlobalAEInvestment() end)
    if ae == nil then
        ae = Safe(function() return C_CharacterAdvancement.GetLearnedAE() end)
    end
    local te = Safe(function() return C_CharacterAdvancement.GetGlobalTEInvestment() end)
    if te == nil then
        te = Safe(function() return C_CharacterAdvancement.GetLearnedTE() end)
    end

    local cpTotal, classes, tabs, tabSeen = 0, {}, {}, {}
    local function noteClass(e)
        local class = e and e.Class
        if class == nil or classes[class] then return end
        classes[class] = true
        local n = Safe(function()
            return C_CharacterAdvancement.GetClassPointInvestment(class, 0)
        end)
        n = tonumber(n)
        if n then cpTotal = cpTotal + n end
    end
    local function noteTab(e)
        local class = e and e.Class
        local spec = e and (e.Tab or e.Spec or e.SpecID)
        if class == nil or spec == nil then return end
        local key = tostring(class) .. ":" .. tostring(spec)
        if tabSeen[key] then return end
        tabSeen[key] = true
        local n = Safe(function()
            return C_CharacterAdvancement.GetTabTEInvestment(class, spec, 0)
        end)
        n = tonumber(n)
        if n and n > 0 then
            tabs[#tabs + 1] = "TAB:" .. Num(class) .. ":" .. Num(spec) .. ":" .. Num(n)
        end
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries)) do
        noteClass(e)
        noteTab(e)
    end
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownTalentEntries)) do
        noteClass(e)
        noteTab(e)
    end

    if ae == nil and te == nil and next(classes) == nil and #tabs == 0 then
        return nil
    end
    local out = {
        "AE:" .. Num(ae or 0),
        "TE:" .. Num(te or 0),
        "CP:" .. Num(cpTotal),
    }
    table.sort(tabs)
    for _, t in ipairs(tabs) do
        out[#out + 1] = t
    end
    return out
end

-- Spell Power ist auf Ascension fuer alle Schulen gleich; trotzdem das Maximum
-- nehmen, falls ein Effekt eine Schule einzeln anhebt.
local function bonusDamage()
    local best = 0
    for school = 2, 7 do
        local v = tonumber(GetSpellBonusDamage(school)) or 0
        if v > best then best = v end
    end
    return best
end

local function hitPercent(ratingIndex, modifierFn)
    local pct = tonumber(GetCombatRatingBonus(ratingIndex)) or 0
    if type(modifierFn) == "function" then
        local extra = Safe(modifierFn)
        pct = pct + (tonumber(extra) or 0)
    end
    return pct
end

function BS.CollectStats()
    local s = {}

    local names = { "STR", "AGI", "STA", "INT", "SPI" }
    for i = 1, 5 do
        local _, stat = UnitStat("player", i)
        s[#s + 1] = names[i] .. ":" .. Num(stat)
    end

    local ap, apPos, apNeg = UnitAttackPower("player")
    local rap, rapPos, rapNeg = UnitRangedAttackPower("player")
    local _, armor = UnitArmor("player")

    s[#s + 1] = "SP:" .. Num(bonusDamage())
    s[#s + 1] = "HEAL:" .. Num(GetSpellBonusHealing())
    s[#s + 1] = "AP:" .. Num((ap or 0) + (apPos or 0) + (apNeg or 0))
    s[#s + 1] = "RAP:" .. Num((rap or 0) + (rapPos or 0) + (rapNeg or 0))
    s[#s + 1] = "CRIT:" .. Num(GetCritChance(), 2)
    s[#s + 1] = "SCRIT:" .. Num(GetSpellCritChance(2), 2)
    s[#s + 1] = "HASTERATING:" .. Num(GetCombatRating(CR_HASTE_SPELL))
    s[#s + 1] = "CRITRATING:" .. Num(GetCombatRating(CR_CRIT_MELEE))
    s[#s + 1] = "HITRATING:" .. Num(GetCombatRating(CR_HIT_MELEE))
    s[#s + 1] = "ARMOR:" .. Num(armor)
    s[#s + 1] = "DODGE:" .. Num(GetDodgeChance(), 2)
    s[#s + 1] = "PARRY:" .. Num(GetParryChance(), 2)
    s[#s + 1] = "ARPEN:" .. Num(GetArmorPenetration and GetArmorPenetration() or 0, 2)

    -- QW-3: Prozent-/Nebenwerte aus Stock-PaperDoll (additive Keys).
    s[#s + 1] = "HITPCT:" .. Num(hitPercent(CR_HIT_MELEE, GetHitModifier), 2)
    s[#s + 1] = "SHITPCT:" .. Num(hitPercent(CR_HIT_SPELL, GetSpellHitModifier), 2)

    local expMH = Safe(function() return GetExpertise() end)
    local expPct = Safe(function() return GetExpertisePercent() end)
    s[#s + 1] = "EXP:" .. Num(expMH or 0)
    s[#s + 1] = "EXPPCT:" .. Num(expPct or 0, 2)
    s[#s + 1] = "EXPRATING:" .. Num(GetCombatRating(CR_EXPERTISE))

    local mp5 = 0
    if UnitHasMana and UnitHasMana("player") then
        local base = Safe(function() return GetManaRegen() end)
        -- PaperDoll: GetManaRegen liefert Mana/Sekunde; Anzeige = *5.
        mp5 = math.floor((tonumber(base) or 0) * 5)
    end
    s[#s + 1] = "MP5:" .. Num(mp5)
    s[#s + 1] = "SPECPEN:" .. Num(GetSpellPenetration and GetSpellPenetration() or 0)

    for _, def in ipairs(RESIST_FIELDS) do
        local _, total = UnitResistance("player", def[1])
        s[#s + 1] = def[2] .. ":" .. Num(total or 0)
    end

    return s
end

function BS.CollectWeapons()
    local out = {}
    local mainSpeed, offSpeed = UnitAttackSpeed("player")
    local lo, hi, offLo, offHi = UnitDamage("player")

    -- equipLoc entscheidet, welcher der beiden Path-Boni ueberhaupt greift -
    -- jeder Path hat einen fuer Einhand und einen fuer Zweihand.
    local function line(tag, slot, speed, low, high)
        local link = GetInventoryItemLink("player", slot)
        local name, ilvl, loc, sub = "-", 0, "-", "-"
        if link then
            local n, _, _, il, _, _, subType, _, equipLoc = GetItemInfo(link)
            name = Clean(n or link)
            ilvl = tonumber(il) or 0
            loc = Clean(equipLoc or "-")
            sub = Clean(subType or "-")
        end
        local dps = 0
        if speed and speed > 0 and low and high then
            dps = ((low + high) / 2) / speed
        end
        local row = table.concat({
            tag, name, "ilvl" .. Num(ilvl), "speed" .. Num(speed or 0, 2),
            Num(low or 0) .. "-" .. Num(high or 0), "dps" .. Num(dps, 1),
            loc, sub,
        }, "|")
        out[#out + 1] = appendLinkIds(row, link)
    end

    line("MH", 16, mainSpeed, lo, hi)
    if offSpeed and offSpeed > 0 then
        line("OH", 17, offSpeed, offLo, offHi)
    end

    -- Distanzwaffe getrennt: Faehigkeiten mit "ranged weapon damage" rechnen
    -- damit, nicht mit der Haupthand.
    local rSpeed, rLo, rHi = UnitRangedDamage("player")
    if rSpeed and rSpeed > 0 and rLo and rLo > 0 then
        line("RANGED", 18, rSpeed, rLo, rHi)
    end
    return out
end

function BS.CollectGear()
    local out = {}
    local total, count = 0, 0
    for _, def in ipairs(GEAR_SLOTS) do
        local slot, label = def[1], def[2]
        local link = GetInventoryItemLink("player", slot)
        if link then
            local name, _, quality, ilvl, _, _, subType = GetItemInfo(link)
            ilvl = tonumber(ilvl) or 0
            total = total + ilvl
            count = count + 1
            local row = label .. "|" .. Clean(name or link) ..
                "|" .. Num(ilvl) .. "|" .. Num(quality or 0) ..
                "|" .. Clean(subType or "-")
            out[#out + 1] = appendLinkIds(row, link)
        end
    end
    local avg = count > 0 and (total / count) or 0
    return out, avg
end

-- Fehlende oder abstuerzende Collector: eine Exportzeile weglassen, nie alles.
local function tryCollect(name)
    local fn = BS[name]
    if type(fn) ~= "function" then return nil end
    local ok, a, b, c = pcall(fn)
    if not ok then return nil end
    return a, b, c
end

-- Baut den Textblock, den der Spieler kopiert.
function BS.BuildExport()
    local db = BS.DB()
    local L = {}

    local name = UnitName("player")
    local level = UnitLevel("player")
    local race = UnitRace("player")
    local class = UnitClass("player")

    L[#L + 1] = "=== BUILDSCHMIEDE v" .. BS.FORMAT .. " ==="
    L[#L + 1] = "ADDON|" .. BS.VERSION
    L[#L + 1] = "CHAR|" .. Clean(name) .. "|" .. Num(level) .. "|" ..
        Clean(race) .. "|" .. Clean(class)

    local path = pathName()
    L[#L + 1] = "PATH|" .. (path or "unbekannt")

    local pathInfo = tryCollect("CollectPathInfo")
    if pathInfo then
        L[#L + 1] = "PATHINFO|" .. pathInfo
    end
    local pathEntry = tryCollect("CollectPathEntry")
    if pathEntry then
        L[#L + 1] = "PATHENTRY|" .. pathEntry
    end
    local pathAura = tryCollect("CollectPathAura")
    if pathAura then
        L[#L + 1] = "PATHAURA|" .. pathAura
    end

    local suggest = tryCollect("CollectSuggestedStats")
    if suggest and #suggest > 0 then
        L[#L + 1] = "SUGGEST|" .. table.concat(suggest, ";")
    end

    local remA = Safe(function() return C_CharacterAdvancement.GetRemainingAE() end)
    local remT = Safe(function() return C_CharacterAdvancement.GetRemainingTE() end)
    local spentA = Safe(function() return C_CharacterAdvancement.GetGlobalAEInvestment() end)
    if spentA == nil then
        spentA = Safe(function() return C_CharacterAdvancement.GetLearnedAE() end)
    end
    local spentT = Safe(function() return C_CharacterAdvancement.GetGlobalTEInvestment() end)
    if spentT == nil then
        spentT = Safe(function() return C_CharacterAdvancement.GetLearnedTE() end)
    end
    local expectedA = Safe(function()
        return C_CharacterAdvancement.GetExpectedAE(level)
    end)
    if remA or remT or spentA or spentT or expectedA then
        local parts = {
            "A:" .. Num(remA or 0),
            "T:" .. Num(remT or 0),
        }
        if spentA ~= nil then parts[#parts + 1] = "AS:" .. Num(spentA) end
        if spentT ~= nil then parts[#parts + 1] = "TS:" .. Num(spentT) end
        if expectedA ~= nil then parts[#parts + 1] = "AX:" .. Num(expectedA) end
        L[#L + 1] = "ESSENCE|" .. table.concat(parts, "|")
    end

    local invest = tryCollect("CollectInvestment")
    if invest then
        L[#L + 1] = "INVEST|" .. table.concat(invest, "|")
    end

    local specId, specName, chrSpec = tryCollect("CollectSpec")
    if specId then
        local specLine = "SPEC|" .. Num(specId) .. (specName and ("|" .. specName) or "")
        if chrSpec then
            -- Name-Feld bleibt Feld 2; CHR: ist additiv (alte Parser ignorieren).
            if not specName then
                specLine = specLine .. "|"
            end
            specLine = specLine .. "|CHR:" .. Num(chrSpec)
        end
        L[#L + 1] = specLine
    end

    local modes = tryCollect("CollectGameModes")
    if modes and #modes > 0 then
        L[#L + 1] = "MODE|" .. table.concat(modes, "|")
    end

    local desire = tryCollect("CollectDesired")
    if desire and #desire > 0 then
        L[#L + 1] = "DESIRE|" .. table.concat(desire, ";")
    end
    local undesire = tryCollect("CollectUndesired")
    if undesire and #undesire > 0 then
        L[#L + 1] = "UNDESIRE|" .. table.concat(undesire, ";")
    end

    local wc = tryCollect("CollectWildcardStatus")
    if wc and #wc > 0 then
        L[#L + 1] = "WC|" .. table.concat(wc, "|")
    end

    local startChoice = tryCollect("CollectStartingChoice")
    if startChoice and #startChoice > 0 then
        L[#L + 1] = "STARTCHOICE|" .. table.concat(startChoice, ";")
    end

    if db.includeStats then
        local stats = tryCollect("CollectStats")
        if type(stats) == "table" then
            L[#L + 1] = "STAT|" .. table.concat(stats, "|")
        end
        local weapons = tryCollect("CollectWeapons")
        if type(weapons) == "table" then
            for _, w in ipairs(weapons) do
                L[#L + 1] = "WEAPON|" .. w
            end
        end
    end

    if db.includeGear then
        local gear, avg = tryCollect("CollectGear")
        if type(gear) == "table" then
            L[#L + 1] = "ILVL|" .. Num(avg, 2)
            for _, g in ipairs(gear) do
                L[#L + 1] = "GEAR|" .. g
            end
        end
    end

    -- Seltenheits-Budget: die zweite Grenze neben der Platzzahl.
    local q = tryCollect("CollectQuality")
    if q and #q > 0 then
        L[#L + 1] = "QUALITY|" .. table.concat(q, "|")
    end
    local qc = tryCollect("CollectQualityCost")
    if qc and #qc > 0 then
        L[#L + 1] = "QCOST|" .. table.concat(qc, "|")
    end
    local qo = tryCollect("CollectOwnedQuality")
    if qo and #qo > 0 then
        L[#L + 1] = "QOWN|" .. table.concat(qo, ";")
    end

    local locked = tryCollect("CollectLocked")
    if locked and #locked > 0 then
        L[#L + 1] = "LOCK|" .. table.concat(locked, ";")
    end

    local ecost = tryCollect("CollectEssenceCosts")
    if ecost and #ecost > 0 then
        L[#L + 1] = "ECOST|" .. table.concat(ecost, ";")
    end

    local mast = tryCollect("CollectMasteries")
    if mast and #mast > 0 then
        L[#L + 1] = "MAST|" .. table.concat(mast, ";")
    end

    local traits = tryCollect("CollectTraits")
    if traits and #traits > 0 then
        L[#L + 1] = "TRAIT|" .. table.concat(traits, ";")
    end

    local abi = tryCollect("CollectAbilities") or {}
    local tal = tryCollect("CollectTalents") or {}
    L[#L + 1] = "ABI|" .. table.concat(abi, ";")
    L[#L + 1] = "TAL|" .. table.concat(tal, ";")
    L[#L + 1] = "COUNT|A:" .. #abi .. "|T:" .. #tal

    local code = Safe(function() return C_CharacterAdvancement.ExportBuild(true) end)
    if code and code ~= "" then
        L[#L + 1] = "CODE|" .. Clean(code)
    end

    L[#L + 1] = "=== ENDE ==="
    return table.concat(L, "\n")
end
