-- Read-only Skill-Card-Slots (Roadmap M-2 / Addon 1.5.0).
--
-- Quellen (DraftCardMixin / SkillCardsFrame / SkillCardsUtil, Extract verifiziert):
--   C_SkillCard.GetMaxCardCount(cardType)       -> Slot-Anzahl
--   C_SkillCard.GetCardAtIndex(cardType, index) -> cardId (0 = leer); Index 0-basiert
--   C_SkillCard.IsCardAtIndexBlocked(cardType, index)
--   C_SkillCard.IsCardAtIndexActive(cardType, index) -> aktiver Slot
--   C_SkillCard.IsCardedSpellID(spellID)        -> Spell liegt auf einer Karte
--   C_SkillCard.IsCardedID(entryId)             -> isCarded, cardType, active
--   C_SkillCard.GetSkillCardQuality(cardId, rank) -> Qualitaet (SCARD :qN)
-- Optional (nur Aufloesung, Safe):
--   C_SkillCard.GetSkillCardInfo(cardId[, rank]) -> .SpellID
--   C_SkillCard.GetCardSpellID(cardId, rank)
--   C_CharacterAdvancement.GetEntryBySpellID(sid) -> Entry-Fallback
-- Pending (Collection, read-only):
--   C_SkillCardCollection.GetNumPendingSkillCards()
--   C_SkillCardCollection.GetPendingSkillCardAtIndex(i) -> UUID, cardID
--
-- Kein Purchase/Claim/Set — nur lesen.
--
-- Export-Format (FORMAT bleibt 1; additiv ab 1.5.7):
--   SCARD|TAG:cardId@index;TAG:cardId@index:qN:A:sSPELLID;…
--     TAG = DEFAULT_NORMAL|DEFAULT_GOLDEN|STARTER_NORMAL|STARTER_GOLDEN|
--           LUCKY_NORMAL|LUCKY_GOLDEN|TALENT_NORMAL|TALENT_GOLDEN
--     index ist 0-basiert (wie GetCardAtIndex)
--     nur belegte Slots (cardId ~= 0); blockierte leere Slots: TAG:B@index
--     :qN = GetSkillCardQuality (wenn API greift); :A = IsCardAtIndexActive
--     :sSPELLID = Spell der Karte (GetCardSpellID / GetSkillCardInfo) —
--       Website loest Namen ueber Katalog-spellId (nameBySid), nicht ueber cardId
--   CARDED|spellId;spellId;…
--     Spell-IDs aus IsCardedSpellID / IsCardedID auf bekannten ABI/TAL + Slot-Spells
--   SCARDPEND|n                 (GetNumPendingSkillCards; nur wenn API und n>=0)
--
-- WildCard/Draft: MODE|… bleibt in Collect. Skill Cards werden
-- exportiert, sobald die API Daten liefert — auch ausserhalb von WildCard.

local BS = AscBuildschmiede
local Safe, Num = BS.Safe, BS.Num

-- Kurztags fuer den Export; Werte = Enum.SkillCardType / DraftCardMixin-Strings.
local CARD_TYPES = {
    { tag = "DEFAULT_NORMAL", type = "SKILL_CARD_DEFAULT_NORMAL" },
    { tag = "DEFAULT_GOLDEN", type = "SKILL_CARD_DEFAULT_GOLDEN" },
    { tag = "STARTER_NORMAL", type = "SKILL_CARD_STARTER_NORMAL" },
    { tag = "STARTER_GOLDEN", type = "SKILL_CARD_STARTER_GOLDEN" },
    { tag = "LUCKY_NORMAL",   type = "SKILL_CARD_LUCKY_NORMAL" },
    { tag = "LUCKY_GOLDEN",   type = "SKILL_CARD_LUCKY_GOLDEN" },
    { tag = "TALENT_NORMAL",  type = "SKILL_CARD_TALENT_NORMAL" },
    { tag = "TALENT_GOLDEN",  type = "SKILL_CARD_TALENT_GOLDEN" },
}

local function apiReady()
    return C_SkillCard
        and C_SkillCard.GetMaxCardCount
        and C_SkillCard.GetCardAtIndex
end

local function maxCount(cardType)
    local n = Safe(function()
        return C_SkillCard.GetMaxCardCount(cardType)
    end)
    return tonumber(n) or 0
end

-- Nur den ersten Rueckgabewert: GetCardAtIndex kann Mehrfachwerte liefern;
-- tonumber(f()) wuerde den zweiten als base (2–36) lesen → "base out of range".
local function cardAt(cardType, index)
    local id = Safe(function()
        return C_SkillCard.GetCardAtIndex(cardType, index)
    end)
    return id
end

local function blockedAt(cardType, index)
    local yes = Safe(function()
        return C_SkillCard.IsCardAtIndexBlocked
            and C_SkillCard.IsCardAtIndexBlocked(cardType, index)
    end)
    return yes and true or false
end

local function activeAt(cardType, index)
    local yes = Safe(function()
        return C_SkillCard.IsCardAtIndexActive
            and C_SkillCard.IsCardAtIndexActive(cardType, index)
    end)
    return yes and true or false
end

local function cardQuality(cardId)
    cardId = tonumber(cardId)
    if not cardId or cardId == 0 then return nil end
    local q = Safe(function()
        return C_SkillCard.GetSkillCardQuality
            and C_SkillCard.GetSkillCardQuality(cardId, 1)
    end)
    return tonumber(q)
end

local function spellFromCard(cardId)
    cardId = tonumber(cardId)
    if not cardId or cardId == 0 then return nil end
    local sid = Safe(function()
        if C_SkillCard.GetCardSpellID then
            return C_SkillCard.GetCardSpellID(cardId, 1)
        end
    end)
    sid = tonumber(sid)
    if sid then return sid end
    local info = Safe(function()
        return C_SkillCard.GetSkillCardInfo and C_SkillCard.GetSkillCardInfo(cardId)
    end)
    if type(info) == "table" then
        sid = tonumber(info.SpellID)
        if sid then return sid end
    end
    return nil
end

local function isCardedSpell(spellId)
    spellId = tonumber(spellId)
    if not spellId then return false end
    local yes = Safe(function()
        return C_SkillCard.IsCardedSpellID and C_SkillCard.IsCardedSpellID(spellId)
    end)
    if yes then return true end
    -- IsCardedID braucht Entry-ID; Spell → Entry falls moeglich.
    local entry = BS.EntryBySpellID and BS.EntryBySpellID(spellId)
    local eid = entry and tonumber(entry.ID)
    if not eid then return false end
    local carded = Safe(function()
        return C_SkillCard.IsCardedID and C_SkillCard.IsCardedID(eid)
    end)
    return carded and true or false
end

local function isCardedEntry(entryId)
    entryId = tonumber(entryId)
    if not entryId then return false end
    local yes = Safe(function()
        return C_SkillCard.IsCardedID and C_SkillCard.IsCardedID(entryId)
    end)
    return yes and true or false
end

-- Belegte / blockierte Slots als Token-Liste (SCARD-Inhalt ohne Praefix).
function BS.CollectSkillCardSlots()
    local out = {}
    if not apiReady() then return out end

    for _, def in ipairs(CARD_TYPES) do
        local max = maxCount(def.type)
        if max > 0 then
            -- DraftCardMixin: Index 0 .. max-1
            for i = 0, max - 1 do
                local cardId = tonumber(cardAt(def.type, i)) or 0
                if cardId and cardId ~= 0 then
                    local tok = def.tag .. ":" .. Num(cardId) .. "@" .. Num(i)
                    local q = cardQuality(cardId)
                    if q then tok = tok .. ":q" .. Num(q) end
                    if activeAt(def.type, i) then tok = tok .. ":A" end
                    -- Spell-ID fuer Namensaufloesung auf der Seite (Katalog via sid).
                    local sid = spellFromCard(cardId)
                    if sid then tok = tok .. ":s" .. Num(sid) end
                    out[#out + 1] = tok
                elseif blockedAt(def.type, i) then
                    out[#out + 1] = def.tag .. ":B@" .. Num(i)
                end
            end
        end
    end
    return out
end

-- Spell-IDs, die aktuell als Skill Card aktiv/belegt gelten.
function BS.CollectCardedSpellIDs()
    local out, seen = {}, {}
    if not apiReady() then return out end

    local function add(sid)
        sid = tonumber(sid)
        if not sid or seen[sid] then return end
        seen[sid] = true
        out[#out + 1] = Num(sid)
    end

    -- Aus Slots (auch wenn IsCardedSpellID auf dem Realm fehlt).
    for _, def in ipairs(CARD_TYPES) do
        local max = maxCount(def.type)
        for i = 0, max - 1 do
            local cardId = tonumber(cardAt(def.type, i)) or 0
            if cardId ~= 0 then
                add(spellFromCard(cardId))
            end
        end
    end

    -- Bekannte Abilities/Talente gegen IsCardedSpellID / IsCardedID.
    local function scanEntries(getter)
        local list = Safe(getter)
        if type(list) ~= "table" then return end
        for _, e in ipairs(list) do
            if type(e) == "table" then
                local rank = tonumber(e.Rank) or 1
                local sid = nil
                if type(e.Spells) == "table" then
                    sid = tonumber(e.Spells[rank]) or tonumber(e.Spells[1])
                end
                local eid = tonumber(e.ID)
                if (sid and isCardedSpell(sid)) or (eid and isCardedEntry(eid)) then
                    if not sid and eid then
                        local via = Safe(function()
                            return C_CharacterAdvancement.GetEntryByInternalID
                                and C_CharacterAdvancement.GetEntryByInternalID(eid)
                        end)
                        if type(via) == "table" and type(via.Spells) == "table" then
                            sid = tonumber(via.Spells[1])
                        end
                    end
                    add(sid)
                end
            end
        end
    end
    scanEntries(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries)
    scanEntries(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownTalentEntries)

    table.sort(out, function(a, b) return tonumber(a) < tonumber(b) end)
    return out
end

-- Anzahl ausstehender Skill Cards (Collection, read-only).
function BS.CollectPendingSkillCardCount()
    local n = Safe(function()
        return C_SkillCardCollection and C_SkillCardCollection.GetNumPendingSkillCards
            and C_SkillCardCollection.GetNumPendingSkillCards()
    end)
    n = tonumber(n)
    if n == nil then return nil end
    return n
end

-- Zeilen fuer den Export (oder leer, wenn API nichts liefert).
-- Schluessel exakt SCARD / CARDED / SCARDPEND (nicht CARD) — Website-parseExport.
function BS.SkillCardExportLines()
    local lines = {}

    if apiReady() then
        local slots = BS.CollectSkillCardSlots()
        if slots and #slots > 0 then
            lines[#lines + 1] = "SCARD|" .. table.concat(slots, ";")
        end

        local carded = BS.CollectCardedSpellIDs()
        if carded and #carded > 0 then
            lines[#lines + 1] = "CARDED|" .. table.concat(carded, ";")
        end
    end

    local pend = BS.CollectPendingSkillCardCount()
    if pend ~= nil then
        lines[#lines + 1] = "SCARDPEND|" .. Num(pend)
    end
    return lines
end

-- Collect.lua besitzt BuildExport; wir haengen additiv vor === ENDE === an,
-- ohne Collect anzufassen (parallele Agenten). Skill-Card-Fehler duerfen den
-- Rest-Export nicht verschlucken — pcall, dann nur ohne SCARD/CARDED/SCARDPEND.
do
    local prev = BS.BuildExport
    if type(prev) == "function" then
        function BS.BuildExport()
            local text = prev()
            local ok, extra = pcall(BS.SkillCardExportLines)
            if not ok or type(extra) ~= "table" or #extra == 0 then
                return text
            end
            local block = table.concat(extra, "\n")
            if text:find("=== ENDE ===", 1, true) then
                return (text:gsub("=== ENDE ===", block .. "\n=== ENDE ===", 1))
            end
            return text .. "\n" .. block
        end
    end
end
