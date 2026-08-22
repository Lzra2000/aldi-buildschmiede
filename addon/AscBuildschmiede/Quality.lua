-- Das Seltenheits-Budget.
--
-- Ascension begrenzt nicht nur die Anzahl der Plaetze, sondern auch, wie viel
-- Seltenheit ein Build tragen darf: der Client zeigt das als Leiste
-- "3 / 5" pro Qualitaetsstufe (siehe FrameXML/CurrencyBar.lua).
--
--   C_CharacterAdvancement.GetQualityCount(q)      -> aktuell verbraucht
--   C_CharacterAdvancement.GetQualityLimit(q)      -> Obergrenze
--   C_CharacterAdvancement.GetQualityInfo(spellID) -> quality, kosten
--
-- Ohne diese Zahlen kann die Buildschmiede nur Plaetze zaehlen und haelt
-- Builds fuer moeglich, die es im Spiel nicht gibt.

local BS = AscBuildschmiede
local Safe, Num = BS.Safe, BS.Num

-- Enum.SpellQuality: 0 Common ... 4 Legendary. Common hat kein Budget.
local QNAME = { [1] = "Uncommon", [2] = "Rare", [3] = "Epic", [4] = "Legendary" }

function BS.CollectQuality()
    local out = {}
    for q = 1, 4 do
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
            if q and q >= 1 and q <= 4 and cost and cost > 0 then
                seen = true
                if not lo[q] or cost < lo[q] then lo[q] = cost end
                if not hi[q] or cost > hi[q] then hi[q] = cost end
            end
        end
    end
    if not seen then return nil end

    local out = {}
    for q = 1, 4 do
        if lo[q] then
            out[#out + 1] = QNAME[q] .. ":" .. Num(lo[q]) ..
                (hi[q] ~= lo[q] and ("-" .. Num(hi[q])) or "")
        end
    end
    return out
end
