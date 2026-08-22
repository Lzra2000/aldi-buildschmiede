-- Den Build des Ziels auslesen.
--
-- Ablauf laut Client (Ascension_InspectUI/Panels/InspectBuildPanel.lua):
--   C_CharacterAdvancement.InspectUnit(unit)
--   -> Event INSPECT_CHARACTER_ADVANCEMENT_RESULT
--   -> C_CharacterAdvancement.GetInspectedBuild(unit, spec) liefert
--      { { EntryId = n, Rank = n }, ... }
--   -> C_CharacterAdvancement.GetEntryByInternalID(EntryId) gibt den Namen.
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

local pending, waiter

local function entryName(id)
    local e = Safe(function()
        return C_CharacterAdvancement.GetEntryByInternalID(id)
    end)
    if type(e) == "table" and e.Name then
        return Clean(e.Name), e.Type
    end
    return nil
end

local function buildFromInspect(unit)
    local entries = Safe(function()
        return C_CharacterAdvancement.GetInspectedBuild(unit)
    end)
    if type(entries) ~= "table" or #entries == 0 then return nil end

    local abi, tal = {}, {}
    for _, e in ipairs(entries) do
        local id = e and (e.EntryId or e.ID)
        if id then
            local name, kind = entryName(id)
            if name then
                local rank = tonumber(e.Rank) or 1
                -- Type 1 sind Talente; ohne verlaessliches Type-Feld
                -- entscheidet der Rang: Talente haben Raenge, Abilities nicht.
                if kind == 1 or (rank and rank > 1) then
                    tal[#tal + 1] = name .. ":" .. rank
                else
                    abi[#abi + 1] = name
                end
            end
        end
    end
    table.sort(abi)
    table.sort(tal)
    return abi, tal
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
    local abi, tal = buildFromInspect(unit)
    if not abi then return nil end

    local L = {}
    L[#L + 1] = "=== BUILDSCHMIEDE v" .. BS.FORMAT .. " ==="
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

    pending = UnitName(unit)
    BS.Print("Lese " .. tostring(pending) .. " aus ...")

    if not waiter then
        waiter = CreateFrame("Frame")
        waiter:SetScript("OnEvent", function()
            if not pending then return end
            local payload = BS.BuildInspectExport("target")
            pending = nil
            waiter:UnregisterEvent("INSPECT_CHARACTER_ADVANCEMENT_RESULT")
            if payload then
                BS.ShowForeign(payload)
            else
                BS.Print("Der Server hat nichts geschickt. Nochmal versuchen.")
            end
        end)
    end
    waiter:RegisterEvent("INSPECT_CHARACTER_ADVANCEMENT_RESULT")

    local ok = Safe(function()
        return C_CharacterAdvancement.InspectUnit(unit)
    end)
    if ok == nil then
        -- Fallback auf die Standardfunktion; manche Realms haengen dort dran.
        Safe(function() InspectUnit(unit) end)
    end

    -- Wenn nach acht Sekunden nichts kam, nicht ewig weiterhorchen.
    if Timer and Timer.After then
        Timer.After(8, function()
            if pending then
                pending = nil
                waiter:UnregisterEvent("INSPECT_CHARACTER_ADVANCEMENT_RESULT")
                BS.Print("Keine Antwort vom Server.")
            end
        end)
    end
end
