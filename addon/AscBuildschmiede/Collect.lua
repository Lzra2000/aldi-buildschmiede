-- Sammelt alles, was die Buildschmiede ueber den Charakter wissen muss.
--
-- Quellen (aus dem Client-Extract verifiziert):
--   C_CharacterAdvancement.GetKnownSpellEntries()  -> gelernte Abilities
--   C_CharacterAdvancement.GetKnownTalentEntries() -> gelernte Talente
--   C_CharacterAdvancement.GetTalentRankByID(id)   -> Rang eines Talents
--   C_CharacterAdvancement.ExportBuild(true)       -> offizieller Build-Code
--   C_PrimaryStat:GetActivePrimaryStat()           -> Path (heisst intern PrimaryStat)
-- Alles andere ist Stock-3.3.5a.

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

local GEAR_SLOTS = {
    { 1, "Head" }, { 2, "Neck" }, { 3, "Shoulder" }, { 15, "Back" },
    { 5, "Chest" }, { 9, "Wrist" }, { 10, "Hands" }, { 6, "Waist" },
    { 7, "Legs" }, { 8, "Feet" }, { 11, "Ring1" }, { 12, "Ring2" },
    { 13, "Trinket1" }, { 14, "Trinket2" },
    { 16, "MainHand" }, { 17, "OffHand" }, { 18, "Ranged" },
}

local function pathName()
    local id = Safe(function()
        return C_PrimaryStat and C_PrimaryStat.GetActivePrimaryStat
            and C_PrimaryStat:GetActivePrimaryStat()
    end)
    if not id then return nil end
    -- Der Client haelt den Anzeigenamen in PRIMARY_STAT_<n>_NAME_COA.
    local shown = _G["PRIMARY_STAT_" .. id .. "_NAME_COA"] or _G["PRIMARY_STAT" .. id .. "_NAME"]
    return PATH_NAME[id] or Clean(shown) or ("ID" .. id)
end

local function entryList(getter)
    local list = Safe(getter)
    if type(list) ~= "table" then return {} end
    return list
end

function BS.CollectAbilities()
    local out = {}
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownSpellEntries)) do
        if e and e.Name then
            out[#out + 1] = Clean(e.Name)
        end
    end
    table.sort(out)
    return out
end

function BS.CollectTalents()
    local out = {}
    for _, e in ipairs(entryList(C_CharacterAdvancement and C_CharacterAdvancement.GetKnownTalentEntries)) do
        if e and e.Name then
            local rank = Safe(function()
                return C_CharacterAdvancement.GetTalentRankByID(e.ID)
            end)
            rank = tonumber(rank) or 1
            out[#out + 1] = Clean(e.Name) .. ":" .. rank
        end
    end
    table.sort(out)
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
    s[#s + 1] = "HASTERATING:" .. Num(GetCombatRating(20))
    s[#s + 1] = "CRITRATING:" .. Num(GetCombatRating(9))
    s[#s + 1] = "HITRATING:" .. Num(GetCombatRating(6))
    s[#s + 1] = "ARMOR:" .. Num(armor)
    s[#s + 1] = "DODGE:" .. Num(GetDodgeChance(), 2)
    s[#s + 1] = "PARRY:" .. Num(GetParryChance(), 2)
    s[#s + 1] = "ARPEN:" .. Num(GetArmorPenetration and GetArmorPenetration() or 0, 2)

    return s
end

function BS.CollectWeapons()
    local out = {}
    local mainSpeed, offSpeed = UnitAttackSpeed("player")
    local lo, hi, offLo, offHi, _, _, pct = UnitDamage("player")

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
        out[#out + 1] = table.concat({
            tag, name, "ilvl" .. Num(ilvl), "speed" .. Num(speed or 0, 2),
            Num(low or 0) .. "-" .. Num(high or 0), "dps" .. Num(dps, 1),
            loc, sub,
        }, "|")
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
            out[#out + 1] = label .. "|" .. Clean(name or link) ..
                "|" .. Num(ilvl) .. "|" .. Num(quality or 0) ..
                "|" .. Clean(subType or "-")
        end
    end
    local avg = count > 0 and (total / count) or 0
    return out, avg
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
    L[#L + 1] = "CHAR|" .. Clean(name) .. "|" .. Num(level) .. "|" ..
        Clean(race) .. "|" .. Clean(class)

    local path = pathName()
    L[#L + 1] = "PATH|" .. (path or "unbekannt")

    local remA = Safe(function() return C_CharacterAdvancement.GetRemainingAE() end)
    local remT = Safe(function() return C_CharacterAdvancement.GetRemainingTE() end)
    if remA or remT then
        L[#L + 1] = "ESSENCE|A:" .. Num(remA or 0) .. "|T:" .. Num(remT or 0)
    end

    if db.includeStats then
        L[#L + 1] = "STAT|" .. table.concat(BS.CollectStats(), "|")
        for _, w in ipairs(BS.CollectWeapons()) do
            L[#L + 1] = "WEAPON|" .. w
        end
    end

    if db.includeGear then
        local gear, avg = BS.CollectGear()
        L[#L + 1] = "ILVL|" .. Num(avg, 2)
        for _, g in ipairs(gear) do
            L[#L + 1] = "GEAR|" .. g
        end
    end

    -- Seltenheits-Budget: die zweite Grenze neben der Platzzahl.
    local q = BS.CollectQuality()
    if q and #q > 0 then
        L[#L + 1] = "QUALITY|" .. table.concat(q, "|")
    end
    local qc = BS.CollectQualityCost()
    if qc and #qc > 0 then
        L[#L + 1] = "QCOST|" .. table.concat(qc, "|")
    end

    local abi = BS.CollectAbilities()
    local tal = BS.CollectTalents()
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
