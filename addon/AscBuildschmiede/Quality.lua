-- Das Seltenheits-Budget.
--
-- Ascension begrenzt nicht nur die Anzahl der Plaetze, sondern auch, wie viel
-- Seltenheit ein Build tragen darf: der Client zeigt das als Leiste
-- "3 / 5" pro Qualitaetsstufe (siehe FrameXML/CurrencyBar.lua,
-- Templates/CARarityBar.lua).
--
--   C_CharacterAdvancement.GetQualityCount(q)      -> aktuell verbraucht
--   C_CharacterAdvancement.GetQualityLimit(q)      -> Obergrenze
--   C_CharacterAdvancement.GetQualityInfo(spellID) -> quality, kosten
--
-- q ist Enum.SpellQuality / ItemQuality: 2 Uncommon, 3 Rare, 4 Epic, 5 Legendary.
-- Common (1) hat kein Budget. Die eingewickelten GetQualityCount/Limit mappen
-- ueber Enum.QualityToCAQuality — deshalb diese Zahlen, nicht 1..4.
--
-- Ohne diese Zahlen kann die Buildschmiede nur Plaetze zaehlen und haelt
-- Builds fuer moeglich, die es im Spiel nicht gibt.

local BS = AscBuildschmiede
local Safe, Num = BS.Safe, BS.Num

-- Enum.SpellQuality: Common=1 hat kein Budget; Uncommon..Legendary = 2..5.
local QNAME = {
    [2] = "Uncommon",
    [3] = "Rare",
    [4] = "Epic",
    [5] = "Legendary",
}

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

-- Was kostet ein Eintrag gegen das Budget? Statt zu raten einmal ueber alle
-- Eintraege laufen und nachsehen. Ist der Wert je Stufe einheitlich, steht
-- eine Zahl im Export; wenn nicht, eine Spanne - dann weiss die Seite, dass
-- sie nicht einfach durchzaehlen darf.
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
