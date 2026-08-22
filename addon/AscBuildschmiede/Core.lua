-- Buildschmiede Companion - Kern.
--
-- Zweck: den kompletten Charakter in einen Textblock schreiben, den man in die
-- Buildschmiede einfuegen kann. Kein Netzwerk, kein Autoupload - nur Text im
-- Fenster, den der Spieler selbst kopiert.

local ADDON = ...

AscBuildschmiede = AscBuildschmiede or {}
local BS = AscBuildschmiede

BS.VERSION = "1.5.10"
BS.FORMAT = 1
BS.SITE = "https://lzra2000.github.io/aldi-buildschmiede/"

local DEFAULTS = {
    includeGear = true,
    includeStats = true,
    autoOpenOnLevel = false,
}

function BS.DB()
    AscBuildschmiedeDB = AscBuildschmiedeDB or {}
    for k, v in pairs(DEFAULTS) do
        if AscBuildschmiedeDB[k] == nil then
            AscBuildschmiedeDB[k] = v
        end
    end
    return AscBuildschmiedeDB
end

function BS.Print(msg)
    DEFAULT_CHAT_FRAME:AddMessage("|cff4FC3D6Buildschmiede|r " .. tostring(msg))
end

-- Ascension-APIs koennen je nach Realm fehlen. Nie hart darauf zugreifen.
function BS.Safe(fn, ...)
    if type(fn) ~= "function" then return nil end
    local ok, a, b, c, d, e = pcall(fn, ...)
    if not ok then return nil end
    return a, b, c, d, e
end

-- Zahl mit fester Nachkommastelle, ohne Locale-Komma.
function BS.Num(v, decimals)
    v = tonumber(v) or 0
    if decimals and decimals > 0 then
        return string.format("%." .. decimals .. "f", v)
    end
    return string.format("%d", math.floor(v + 0.5))
end

-- Trennzeichen aus Namen entfernen, damit das Format beim Parsen haelt.
function BS.Clean(s)
    s = tostring(s or "")
    s = s:gsub("[|;\r\n]", " ")
    s = s:gsub("%s+", " ")
    return (s:gsub("^%s*(.-)%s*$", "%1"))
end

local f = CreateFrame("Frame")
f:RegisterEvent("ADDON_LOADED")
f:SetScript("OnEvent", function(self, event, name)
    if event == "ADDON_LOADED" and name == ADDON then
        BS.DB()
        self:UnregisterEvent("ADDON_LOADED")
    end
end)

SLASH_ASCBUILDSCHMIEDE1 = "/bs"
SLASH_ASCBUILDSCHMIEDE2 = "/buildschmiede"
SlashCmdList["ASCBUILDSCHMIEDE"] = function(msg)
    msg = (msg or ""):lower():gsub("^%s*(.-)%s*$", "%1")
    local db = BS.DB()

    if msg == "gear" then
        db.includeGear = not db.includeGear
        BS.Print("Gear im Export: " .. (db.includeGear and "an" or "aus"))
        if BS.Refresh then BS.Refresh() end
        return
    end
    if msg == "stats" then
        db.includeStats = not db.includeStats
        BS.Print("Stats im Export: " .. (db.includeStats and "an" or "aus"))
        if BS.Refresh then BS.Refresh() end
        return
    end
    if msg == "target" or msg == "ziel" then
        BS.InspectTarget()
        return
    end
    if msg == "help" or msg == "?" then
        BS.Print("/bs — Exportfenster (Text markieren, Strg+C, auf der Seite unter EINFUEGEN einfuegen).")
        BS.Print("/bs target — Build des Ziels auslesen (Fenster → unter VERGLEICH auf der Seite einfuegen).")
        BS.Print("/bs gear — Gear im Export an/aus.  /bs stats — Stats an/aus.")
        BS.Print("Export-Felder u. a.: SPEC, LOCK, MODE, ESSENCE; GEAR/WEAPON mit itemId wenn vorhanden.")
        BS.Print(BS.SITE)
        return
    end

    BS.Toggle()
end
