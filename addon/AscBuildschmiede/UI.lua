-- Ein Fenster, ein Textfeld, ein Knopf. Mehr braucht das nicht.

local BS = AscBuildschmiede

local frame

local function makeFrame()
    local f = CreateFrame("Frame", "AscBuildschmiedeFrame", UIParent)
    f:SetWidth(560)
    f:SetHeight(430)
    f:SetPoint("CENTER")
    f:SetFrameStrata("DIALOG")
    f:SetBackdrop({
        bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
        edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
        tile = true, tileSize = 32, edgeSize = 32,
        insets = { left = 11, right = 12, top = 12, bottom = 11 },
    })
    f:SetMovable(true)
    f:EnableMouse(true)
    f:RegisterForDrag("LeftButton")
    f:SetScript("OnDragStart", f.StartMoving)
    f:SetScript("OnDragStop", f.StopMovingOrSizing)
    f:Hide()
    tinsert(UISpecialFrames, "AscBuildschmiedeFrame")

    local title = f:CreateFontString(nil, "OVERLAY", "GameFontNormalLarge")
    title:SetPoint("TOP", 0, -18)
    title:SetText("Buildschmiede Export")

    local hint = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    hint:SetPoint("TOPLEFT", 22, -44)
    hint:SetPoint("TOPRIGHT", -22, -44)
    hint:SetJustifyH("LEFT")
    hint:SetText("Text ist markiert: |cffFFD100Strg+C|r druecken, dann auf der Seite " ..
        "unter EINFUEGEN reinkopieren.")

    local url = CreateFrame("EditBox", nil, f)
    url:SetAutoFocus(false)
    url:SetFontObject(ChatFontNormal)
    url:SetHeight(20)
    url:SetPoint("TOPLEFT", 22, -74)
    url:SetPoint("TOPRIGHT", -22, -74)
    url:SetText(BS.SITE)
    url:SetScript("OnEscapePressed", function(self) self:ClearFocus() end)
    url:SetScript("OnEditFocusGained", function(self) self:HighlightText() end)
    url:SetScript("OnChar", function(self) self:SetText(BS.SITE); self:HighlightText() end)
    f.url = url

    local scroll = CreateFrame("ScrollFrame", "AscBuildschmiedeScroll", f,
        "UIPanelScrollFrameTemplate")
    scroll:SetPoint("TOPLEFT", 22, -100)
    scroll:SetPoint("BOTTOMRIGHT", -40, 56)

    local edit = CreateFrame("EditBox", nil, scroll)
    edit:SetMultiLine(true)
    edit:SetAutoFocus(false)
    edit:SetFontObject(ChatFontNormal)
    edit:SetWidth(470)
    edit:SetMaxLetters(0)
    edit:SetScript("OnEscapePressed", function(self) self:ClearFocus(); f:Hide() end)
    -- Der Text darf sich nicht aendern lassen: was drin steht, muss exakt das
    -- sein, was die Seite parst.
    edit:SetScript("OnTextChanged", function(self, user)
        if user then
            self:SetText(f.payload or "")
            self:HighlightText()
        end
    end)
    scroll:SetScrollChild(edit)
    f.edit = edit

    local copy = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
    copy:SetWidth(150)
    copy:SetHeight(24)
    copy:SetPoint("BOTTOMLEFT", 22, 20)
    copy:SetText("Alles markieren")
    copy:SetScript("OnClick", function()
        edit:SetFocus()
        edit:HighlightText()
    end)

    local refresh = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
    refresh:SetWidth(110)
    refresh:SetHeight(24)
    refresh:SetPoint("LEFT", copy, "RIGHT", 8, 0)
    refresh:SetText("Neu einlesen")
    refresh:SetScript("OnClick", function() BS.Refresh() end)

    local close = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
    close:SetWidth(90)
    close:SetHeight(24)
    close:SetPoint("BOTTOMRIGHT", -22, 20)
    close:SetText("Schliessen")
    close:SetScript("OnClick", function() f:Hide() end)

    local info = f:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
    info:SetPoint("BOTTOM", 0, 48)
    f.info = info

    return f
end

function BS.Refresh()
    if not frame then return end
    local payload = BS.BuildExport()
    frame.payload = payload
    frame.edit:SetText(payload)
    frame.edit:SetFocus()
    frame.edit:HighlightText()

    local abi, tal = payload:match("COUNT|A:(%d+)|T:(%d+)")
    local db = BS.DB()
    frame.info:SetText(string.format(
        "%s Abilities, %s Talente  |  Gear: %s  |  Stats: %s  |  /bs gear  /bs stats",
        abi or "?", tal or "?",
        db.includeGear and "an" or "aus",
        db.includeStats and "an" or "aus"))
end

-- Ein fremder Build kommt in dasselbe Fenster, aber BS.Refresh darf ihn
-- nicht ueberschreiben - deshalb ein eigener Zustand.
function BS.ShowForeign(payload)
    if not frame then frame = makeFrame() end
    frame:Show()
    frame.payload = payload
    frame.edit:SetText(payload)
    frame.edit:SetFocus()
    frame.edit:HighlightText()
    local name = payload:match("CHAR|([^|]+)")
    local abi, tal = payload:match("COUNT|A:(%d+)|T:(%d+)")
    frame.info:SetText(string.format(
        "Fremder Build: %s  |  %s Abilities, %s Talente  |  Strg+C, dann auf der Seite unter VERGLEICH",
        name or "?", abi or "?", tal or "?"))
end

function BS.Toggle()
    if not frame then frame = makeFrame() end
    if frame:IsShown() then
        frame:Hide()
        return
    end
    frame:Show()
    BS.Refresh()
end
