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
--   C_SkillCard.GetSkillCardInfoAtIndex(cardType, index) -> .SpellID (SkillCardsFrame)
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
--     :sSPELLID = Spell der Karte (InfoAtIndex / GetCardSpellID / GetSkillCardInfo) —
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

-- Mehrfachwerte getrennt halten: tonumber(f()) wuerde den zweiten als base lesen.
local function cardAt(cardType, index)
    local id, extra, extra2 = Safe(function()
        return C_SkillCard.GetCardAtIndex(cardType, index)
    end)
    return id, extra, extra2
end

local function cardIdFrom(raw)
    if type(raw) == "number" then
        if raw > 0 then return raw end
        return nil
    end
    if type(raw) == "string" then
        local n = tonumber(raw)
        if n and n > 0 then return n end
        return nil
    end
    if type(raw) ~= "table" then return nil end
    return tonumber(raw.ID or raw.CardID or raw.cardID or raw.CardId
        or raw.SkillCardID or raw.skillCardID)
end

local function resolveCardType(def)
    if Enum and Enum.SkillCardType then
        local e = Enum.SkillCardType
        if e[def.type] ~= nil then return e[def.type] end
        local short = tostring(def.type or ""):gsub("^SKILL_CARD_", "")
        if e[short] ~= nil then return e[short] end
    end
    return def.type
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

-- Spell-ID 0 ist kein Katalogeintrag (Seite braucht echte sid fuer nameBySid).
local function validSid(sid)
    sid = tonumber(sid)
    if sid and sid > 0 then return sid end
    return nil
end

local function sidFromInfo(info)
    if type(info) == "number" then return validSid(info) end
    if type(info) ~= "table" then return nil end
    return validSid(info.SpellID or info.spellID or info.Spell or info.spellId)
end

-- Extra-Rueckgaben von GetCardAtIndex: nur Tabellen mit Spell-Feld.
-- Rohe Zahlen sind oft Rang/Flags — :s1 waere kein Katalog-Spell.
local function sidFromSlotExtra(extra)
    if type(extra) ~= "table" then return nil end
    return sidFromInfo(extra)
end

local function spellFromCard(cardId, cardType, index)
    cardId = tonumber(cardId)
    if not cardId or cardId == 0 then return nil end

    -- Belegter Slot: GetSkillCardInfoAtIndex liefert SpellID (SkillCardsFrame, 1-basiert).
    if cardType and index ~= nil and C_SkillCard.GetSkillCardInfoAtIndex then
        local idx = tonumber(index)
        if idx ~= nil then
            local info = Safe(function()
                return C_SkillCard.GetSkillCardInfoAtIndex(cardType, idx + 1)
            end)
            local sid = sidFromInfo(info)
            if sid then return sid end
            info = Safe(function()
                return C_SkillCard.GetSkillCardInfoAtIndex(cardType, idx)
            end)
            sid = sidFromInfo(info)
            if sid then return sid end
        end
    end

    local sid = Safe(function()
        if C_SkillCard.GetCardSpellID then
            return C_SkillCard.GetCardSpellID(cardId, 1)
        end
    end)
    sid = validSid(sid)
    if sid then return sid end
    sid = Safe(function()
        if C_SkillCard.GetCardSpellID then
            return C_SkillCard.GetCardSpellID(cardId)
        end
    end)
    sid = validSid(sid)
    if sid then return sid end

    local info = Safe(function()
        return C_SkillCard.GetSkillCardInfo and C_SkillCard.GetSkillCardInfo(cardId, 1)
    end)
    sid = sidFromInfo(info)
    if sid then return sid end
    if type(info) == "table" then
        local rank = tonumber(info.CollectedRank or info.Rank)
        if rank and rank > 0 then
            sid = validSid(Safe(function()
                return C_SkillCard.GetCardSpellID and C_SkillCard.GetCardSpellID(cardId, rank)
            end))
            if sid then return sid end
            sid = sidFromInfo(Safe(function()
                return C_SkillCard.GetSkillCardInfo(cardId, rank)
            end))
            if sid then return sid end
        end
    end
    info = Safe(function()
        return C_SkillCard.GetSkillCardInfo and C_SkillCard.GetSkillCardInfo(cardId)
    end)
    return sidFromInfo(info)
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
        local ctype = resolveCardType(def)
        local max = maxCount(ctype)
        if max > 0 then
            -- DraftCardMixin: Index 0 .. max-1
            for i = 0, max - 1 do
                local rawId, extra, extra2 = cardAt(ctype, i)
                local cardId = cardIdFrom(rawId) or cardIdFrom(extra) or 0
                local sid = nil
                if cardId ~= 0 then
                    sid = spellFromCard(cardId, ctype, i)
                        or sidFromSlotExtra(extra)
                        or sidFromSlotExtra(extra2)
                        or sidFromInfo(rawId)
                else
                    sid = sidFromSlotExtra(extra) or sidFromSlotExtra(extra2)
                        or sidFromInfo(rawId)
                    if not sid and C_SkillCard.GetSkillCardInfoAtIndex then
                        sid = sidFromInfo(Safe(function()
                            return C_SkillCard.GetSkillCardInfoAtIndex(ctype, i + 1)
                        end)) or sidFromInfo(Safe(function()
                            return C_SkillCard.GetSkillCardInfoAtIndex(ctype, i)
                        end))
                    end
                end
                if cardId ~= 0 or sid then
                    local tok = def.tag .. ":" .. Num(cardId) .. "@" .. Num(i)
                    local q = cardQuality(cardId)
                    if q then tok = tok .. ":q" .. Num(q) end
                    if activeAt(ctype, i) then tok = tok .. ":A" end
                    if sid then tok = tok .. ":s" .. Num(sid) end
                    out[#out + 1] = tok
                elseif blockedAt(ctype, i) then
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
        sid = validSid(sid)
        if not sid or seen[sid] then return end
        seen[sid] = true
        out[#out + 1] = Num(sid)
    end

    -- Aus Slots (auch wenn IsCardedSpellID auf dem Realm fehlt).
    for _, def in ipairs(CARD_TYPES) do
        local ctype = resolveCardType(def)
        local max = maxCount(ctype)
        for i = 0, max - 1 do
            local rawId, extra, extra2 = cardAt(ctype, i)
            local cardId = cardIdFrom(rawId) or cardIdFrom(extra) or 0
            if cardId ~= 0 then
                add(spellFromCard(cardId, ctype, i)
                    or sidFromSlotExtra(extra)
                    or sidFromSlotExtra(extra2)
                    or sidFromInfo(rawId))
            else
                add(sidFromSlotExtra(extra) or sidFromSlotExtra(extra2)
                    or sidFromInfo(rawId))
            end
        end
    end

    -- Bekannte Abilities/Talente gegen IsCardedSpellID / IsCardedID.
    local function scanEntries(getter)
        local list = Safe(getter)
        if type(list) ~= "table" then return end
        local function eachEntry(src)
            if type(src) ~= "table" then return end
            local seen = {}
            for _, e in ipairs(src) do
                if type(e) == "table" and not seen[e] then
                    seen[e] = true
                    local hyd = BS.HydrateEntry and BS.HydrateEntry(e) or e
                    local rank = tonumber(hyd and hyd.Rank) or tonumber(e.Rank) or 1
                    local sid = BS.SpellFromEntry and BS.SpellFromEntry(hyd, rank) or nil
                    if not sid and type(hyd) == "table" and type(hyd.Spells) == "table" then
                        sid = tonumber(hyd.Spells[rank]) or tonumber(hyd.Spells[1])
                    end
                    local eid = tonumber(hyd and hyd.ID) or tonumber(e.ID)
                    if (sid and isCardedSpell(sid)) or (eid and isCardedEntry(eid)) then
                        if not sid and eid then
                            local via = BS.EntryByInternalID and BS.EntryByInternalID(eid)
                            if type(via) == "table" and type(via.Spells) == "table" then
                                sid = tonumber(via.Spells[1])
                            end
                        end
                        add(sid)
                    end
                end
            end
            for _, e in pairs(src) do
                if type(e) == "table" and not seen[e] then
                    seen[e] = true
                    local hyd = BS.HydrateEntry and BS.HydrateEntry(e) or e
                    local rank = tonumber(hyd and hyd.Rank) or tonumber(e.Rank) or 1
                    local sid = BS.SpellFromEntry and BS.SpellFromEntry(hyd, rank) or nil
                    local eid = tonumber(hyd and hyd.ID) or tonumber(e.ID)
                    if (sid and isCardedSpell(sid)) or (eid and isCardedEntry(eid)) then
                        add(sid)
                    end
                end
            end
        end
        eachEntry(list)
    end
    scanEntries(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries)
    scanEntries(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownTalentEntries)

    -- Nachzug: Spell-IDs, die nur GetKnownSpells kennt.
    local known = Safe(function()
        return C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpells
            and C_CharacterAdvancement.GetKnownSpells()
    end)
    if type(known) == "table" then
        for _, sid in ipairs(known) do
            if isCardedSpell(sid) then add(sid) end
        end
        for _, sid in pairs(known) do
            if isCardedSpell(sid) then add(sid) end
        end
    end

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
