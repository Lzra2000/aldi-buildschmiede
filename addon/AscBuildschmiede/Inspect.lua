-- Den Build des Ziels auslesen.
--
-- Ablauf laut Client (Ascension_InspectUI/Panels/InspectBuildPanel.lua):
--   C_CharacterAdvancement.InspectUnit(unit)
--   -> Event INSPECT_CHARACTER_ADVANCEMENT_RESULT ("CA_INSPECT_OK" oder Fehler)
--   -> C_CharacterAdvancement.GetInspectInfo(unit) -> activeSpec, unlockedSpecs[]
--   -> C_CharacterAdvancement.GetInspectedBuild(unit, spec) liefert
--      { { EntryId = n, Rank = n }, ... }
--   -> C_CharacterAdvancement.GetEntryByInternalID(EntryId) gibt den Namen.
--   Talente erkennen: IsTalentID / IsTalentAbilityID (nicht Rank — Rank waehlt
--   bei Abilities nur den Spell in entry.Spells[rank]).
--
-- Additive Zeilen (FORMAT bleibt 1):
--   SPEC|n|name   aktive Spec aus GetInspectInfo (Name via SpecializationUtil)
--   SPECS|1;2;3   freigeschaltete Specs (unlockedSpecs), nur wenn vorhanden
--
-- Das Ergebnis kommt in dasselbe Textformat wie der eigene Export, nur mit
-- INSPECT|1 markiert - die Seite legt es dann als Vergleichsbuild ab statt
-- als deinen eigenen.

local BS = AscBuildschmiede
local Safe, Clean, Num = BS.Safe, BS.Clean, BS.Num

local PATH_NAME = {
    [1] = "Strength", [2] = "Agility", [3] = "Intelligence",
    [4] = "Healing", [6] = "Duality",
}

local GEAR_SLOTS = {
    { 1, "Head" }, { 2, "Neck" }, { 3, "Shoulder" }, { 15, "Back" },
    { 5, "Chest" }, { 9, "Wrist" }, { 10, "Hands" }, { 6, "Waist" },
    { 7, "Legs" }, { 8, "Feet" }, { 11, "Ring1" }, { 12, "Ring2" },
    { 13, "Trinket1" }, { 14, "Trinket2" },
    { 16, "MainHand" }, { 17, "OffHand" }, { 18, "Ranged" },
}

local pending, waiter, timeoutAt

local function entryName(id)
    local e = Safe(function()
        return C_CharacterAdvancement.GetEntryByInternalID(id)
    end)
    if type(e) == "table" and e.Name then
        return Clean(e.Name), e.Type
    end
    return nil
end

local function isTalentEntry(id, kind)
    if kind == "Talent" or kind == "TalentAbility" then
        return true
    end
    local yes = Safe(function()
        return C_CharacterAdvancement.IsTalentID(id)
            or (C_CharacterAdvancement.IsTalentAbilityID
                and C_CharacterAdvancement.IsTalentAbilityID(id))
    end)
    return yes and true or false
end

-- GetInspectInfo(unit) -> activeSpec, unlockedSpecs[] (Ascension_InspectUI).
local function inspectSpecInfo(unit)
    local active, unlocked = Safe(function()
        return C_CharacterAdvancement.GetInspectInfo(unit)
    end)
    active = tonumber(active)
    local unlockedList = {}
    if type(unlocked) == "table" then
        for _, s in ipairs(unlocked) do
            local n = tonumber(s)
            if n then unlockedList[#unlockedList + 1] = Num(n) end
        end
    end
    return active, unlockedList
end

local function specDisplayName(id)
    id = tonumber(id)
    if not id then return nil end
    local name = Safe(function()
        if not SpecializationUtil or not SpecializationUtil.GetSpecializationInfo then
            return nil
        end
        return SpecializationUtil.GetSpecializationInfo(id)
    end)
    name = Clean(name)
    if name == "" then return nil end
    return name
end

local function buildFromInspect(unit)
    local rawSpec, unlocked = inspectSpecInfo(unit)
    local spec = rawSpec or 1

    local entries = Safe(function()
        return C_CharacterAdvancement.GetInspectedBuild(unit, spec)
    end)
    -- Manche Realms liefern ohne Spec; einmal ohne Argument nachziehen.
    if type(entries) ~= "table" or #entries == 0 then
        entries = Safe(function()
            return C_CharacterAdvancement.GetInspectedBuild(unit)
        end)
    end
    if type(entries) ~= "table" or #entries == 0 then return nil end

    local abi, tal = {}, {}
    for _, e in ipairs(entries) do
        local id = e and (e.EntryId or e.ID)
        if id then
            local name, kind = entryName(id)
            if name then
                local rank = tonumber(e.Rank) or 1
                local entry = Safe(function()
                    return C_CharacterAdvancement.GetEntryByInternalID(id)
                end)
                local sid
                if type(entry) == "table" and type(entry.Spells) == "table" then
                    sid = tonumber(entry.Spells[rank]) or tonumber(entry.Spells[1])
                end
                local eid = tonumber(id)
                local tag = name
                if isTalentEntry(id, kind) then
                    tag = name .. ":" .. rank
                    if sid then
                        tag = tag .. "#" .. Num(sid)
                        if eid then tag = tag .. "@" .. Num(eid) end
                    end
                    tal[#tal + 1] = tag
                else
                    if sid then
                        tag = tag .. "#" .. Num(sid)
                        if eid then tag = tag .. "@" .. Num(eid) end
                    end
                    abi[#abi + 1] = tag
                end
            end
        end
    end
    table.sort(abi)
    table.sort(tal)
    -- rawSpec nur wenn GetInspectInfo geliefert hat — kein erfundenes SPEC|1.
    return abi, tal, rawSpec, unlocked
end

local function gearOf(unit)
    local out, total, count = {}, 0, 0
    for _, def in ipairs(GEAR_SLOTS) do
        local link = GetInventoryItemLink(unit, def[1])
        if link then
            local name, _, quality, ilvl, _, _, subType = GetItemInfo(link)
            ilvl = tonumber(ilvl) or 0
            total = total + ilvl
            count = count + 1
            out[#out + 1] = def[2] .. "|" .. Clean(name or link) .. "|" ..
                Num(ilvl) .. "|" .. Num(quality or 0) .. "|" .. Clean(subType or "-")
        end
    end
    return out, (count > 0 and total / count or 0)
end

function BS.BuildInspectExport(unit)
    local abi, tal, specId, unlocked = buildFromInspect(unit)
    if not abi then return nil end

    local L = {}
    L[#L + 1] = "=== BUILDSCHMIEDE v" .. BS.FORMAT .. " ==="
    L[#L + 1] = "ADDON|" .. BS.VERSION
    L[#L + 1] = "INSPECT|1"
    L[#L + 1] = "CHAR|" .. Clean(UnitName(unit)) .. "|" .. Num(UnitLevel(unit)) ..
        "|" .. Clean(UnitRace(unit) or "?") .. "|" .. Clean(UnitClass(unit) or "?")

    local pid = Safe(function()
        return C_PrimaryStat and C_PrimaryStat.GetUnitPrimaryStat
            and C_PrimaryStat:GetUnitPrimaryStat(unit)
    end)
    if pid and PATH_NAME[pid] then
        L[#L + 1] = "PATH|" .. PATH_NAME[pid]
    end

    -- SPEC aus GetInspectInfo; Name optional (SpecializationUtil, wie Collect).
    if specId then
        local sName = specDisplayName(specId)
        L[#L + 1] = "SPEC|" .. Num(specId) .. (sName and ("|" .. sName) or "")
    end
    if type(unlocked) == "table" and #unlocked > 0 then
        L[#L + 1] = "SPECS|" .. table.concat(unlocked, ";")
    end

    local gear, avg = gearOf(unit)
    if #gear > 0 then
        L[#L + 1] = "ILVL|" .. Num(avg, 2)
        for _, g in ipairs(gear) do
            L[#L + 1] = "GEAR|" .. g
        end
    end

    L[#L + 1] = "ABI|" .. table.concat(abi, ";")
    L[#L + 1] = "TAL|" .. table.concat(tal, ";")
    L[#L + 1] = "COUNT|A:" .. #abi .. "|T:" .. #tal
    L[#L + 1] = "=== ENDE ==="
    return table.concat(L, "\n")
end

local function clearPending(msg)
    if not pending then return end
    pending = nil
    timeoutAt = nil
    if waiter then
        waiter:UnregisterEvent("INSPECT_CHARACTER_ADVANCEMENT_RESULT")
        waiter:SetScript("OnUpdate", nil)
    end
    if msg then BS.Print(msg) end
end

local function finishInspect()
    if not pending then return end
    local payload = BS.BuildInspectExport("target")
    clearPending()
    if payload then
        BS.ShowForeign(payload)
    else
        BS.Print("Der Server hat nichts geschickt. Nochmal versuchen.")
    end
end

-- Inspizieren ist asynchron: anstossen, auf das Ergebnis warten, dann das
-- Fenster mit dem fremden Build fuellen.
function BS.InspectTarget()
    local unit = "target"
    if not UnitExists(unit) then
        BS.Print("Kein Ziel. Klick jemanden an und versuch es nochmal.")
        return
    end
    if not UnitIsPlayer(unit) then
        BS.Print("Das ist kein Spieler.")
        return
    end
    if not CheckInteractDistance(unit, 1) and not UnitIsUnit(unit, "player") then
        BS.Print("Zu weit weg zum Inspizieren.")
        return
    end

    clearPending()
    pending = UnitName(unit)
    BS.Print("Lese " .. tostring(pending) .. " aus ...")

    if not waiter then
        waiter = CreateFrame("Frame")
        waiter:SetScript("OnEvent", function(_, _, result)
            if not pending then return end
            -- pcall ohne Fehler heisst nicht, dass der Server geliefert hat.
            if result and result ~= "CA_INSPECT_OK" then
                clearPending("Inspect fehlgeschlagen: " .. tostring(_G[result] or result))
                return
            end
            finishInspect()
        end)
    end
    waiter:RegisterEvent("INSPECT_CHARACTER_ADVANCEMENT_RESULT")

    -- InspectUnit liefert oft nichts Zurueck; Erfolg = Funktion existiert und
    -- pcall nicht gekracht — nicht am Returnwert messen.
    local called = false
    if C_CharacterAdvancement and type(C_CharacterAdvancement.InspectUnit) == "function" then
        local ok = pcall(C_CharacterAdvancement.InspectUnit, unit)
        called = ok
    end
    if not called then
        -- Fallback auf die Standardfunktion; manche Realms haengen dort dran.
        Safe(function() InspectUnit(unit) end)
    end

    -- Wenn nach acht Sekunden nichts kam, nicht ewig weiterhorchen.
    -- Timer.After gibt es auf Ascension; OnUpdate faengt Realms ohne Timer ab.
    timeoutAt = GetTime() + 8
    if Timer and Timer.After then
        local expect = pending
        Timer.After(8, function()
            if pending == expect then
                clearPending("Keine Antwort vom Server.")
            end
        end)
    else
        waiter:SetScript("OnUpdate", function()
            if not pending or not timeoutAt then
                waiter:SetScript("OnUpdate", nil)
                return
            end
            if GetTime() >= timeoutAt then
                clearPending("Keine Antwort vom Server.")
            end
        end)
    end
end
