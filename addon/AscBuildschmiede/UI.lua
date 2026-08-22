-- Export-Fenster: Ascension-Panel-Chrome.
--
-- Matched (engine templates / shared texture paths — nothing copied into repo):
--   Outer: PortraitFrameTemplate + PortraitFrame_SetTitle / SetIcon
--          (PrestigeModeUI, SkillCardsFrame, EnchantCollection, Ascension CharacterFrame)
--   Fallback outer: UI-DialogBox-Background + UI-DialogBox-Border + UI-DialogBox-Header
--          (AscFastRoll / RaidInfo / StaticPopup family)
--   Text inset: InsetFrameTemplate + UI-Background-Marble when present
--          (CA / SharedXML Inset); else MacroFrameTextBackground tooltip backdrop
--          (UI-Tooltip-Background + UI-Tooltip-Border + TOOLTIP_DEFAULT_*)
--   Controls: UIPanelCloseButton, UIPanelButtonTemplate, UIPanelScrollFrameTemplate,
--             InputBoxTemplate, GameFontNormal / Highlight / HighlightSmall / DisableSmall
--
-- Eigener Build und Fremd-Inspect teilen sich den Frame.

local BS = AscBuildschmiede

local FRAME_W, FRAME_H = 600, 480
local PAD = 16

-- Portrait-Icons wie CharacterAdvancement / Wildcard (client icon paths).
local ICON_OWN = "Interface\\Icons\\trade_archaeology_draenei_tome"
local ICON_FOREIGN = "Interface\\Icons\\misc_rune_pvp_random"

local DIALOG_BACKDROP = {
    bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
    edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
    tile = true, tileSize = 32, edgeSize = 32,
    insets = { left = 11, right = 12, top = 12, bottom = 11 },
}

-- MacroFrameTextBackground (Blizzard_MacroUI) — dark, readable for export text.
local MACRO_INSET_BACKDROP = {
    bgFile = "Interface\\Tooltips\\UI-Tooltip-Background",
    edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
    tile = true, tileSize = 16, edgeSize = 16,
    insets = { left = 5, right = 5, top = 5, bottom = 5 },
}

local frame

local function pcallSet(obj, method, ...)
    if not obj or type(obj[method]) ~= "function" then return false end
    return pcall(obj[method], obj, ...)
end

local function setTitle(f, text)
    if type(PortraitFrame_SetTitle) == "function" then
        pcall(PortraitFrame_SetTitle, f, text)
        if f.TitleText or f.title then return end
    end
    if f.TitleText and f.TitleText.SetText then
        f.TitleText:SetText(text)
    elseif f.title and f.title.SetText then
        f.title:SetText(text)
    end
end

local function setPortraitIcon(f, icon)
    if type(PortraitFrame_SetIcon) == "function" then
        local ok = pcall(PortraitFrame_SetIcon, f, icon)
        if ok then return end
    end
    local portrait = f.portrait
    if f.PortraitFrame and f.PortraitFrame.portrait then
        portrait = f.PortraitFrame.portrait
    end
    if not portrait then return end
    if not pcallSet(portrait, "SetPortraitTexture", icon) then
        portrait:SetTexture(icon)
    end
end

local function tooltipColors()
    local br, bg, bb = 0.5, 0.5, 0.5
    local cr, cg, cb, ca = 0.09, 0.09, 0.11, 1
    if TOOLTIP_DEFAULT_COLOR then
        br = TOOLTIP_DEFAULT_COLOR.r or br
        bg = TOOLTIP_DEFAULT_COLOR.g or bg
        bb = TOOLTIP_DEFAULT_COLOR.b or bb
    end
    if TOOLTIP_DEFAULT_BACKGROUND_COLOR then
        cr = TOOLTIP_DEFAULT_BACKGROUND_COLOR.r or cr
        cg = TOOLTIP_DEFAULT_BACKGROUND_COLOR.g or cg
        cb = TOOLTIP_DEFAULT_BACKGROUND_COLOR.b or cb
    end
    return cr, cg, cb, ca, br, bg, bb
end

-- Classic DialogBox chrome (RaidInfo / AscFastRoll) when PortraitFrameTemplate missing.
local function applyClassicDialogChrome(f)
    f:SetBackdrop(DIALOG_BACKDROP)
    if f.SetBackdropColor then
        f:SetBackdropColor(0, 0, 0, 1)
    end
    if f.SetBackdropBorderColor then
        f:SetBackdropBorderColor(1, 1, 1, 1)
    end

    local header = f:CreateTexture(nil, "ARTWORK")
    header:SetTexture("Interface\\DialogFrame\\UI-DialogBox-Header")
    header:SetWidth(360)
    header:SetHeight(64)
    header:SetPoint("TOP", 0, 12)

    local corner = f:CreateTexture(nil, "OVERLAY")
    corner:SetTexture("Interface\\DialogFrame\\UI-DialogBox-Corner")
    corner:SetWidth(32)
    corner:SetHeight(32)
    corner:SetPoint("TOPRIGHT", -6, -7)

    local title = f:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    title:SetPoint("TOP", header, "TOP", 0, -14)
    title:SetText("Buildschmiede Export")
    f.TitleText = title
    f.title = title

    local closeX = CreateFrame("Button", nil, f, "UIPanelCloseButton")
    closeX:SetPoint("TOPRIGHT", -4, -4)
    closeX:SetScript("OnClick", function() f:Hide() end)
    f.CloseButton = closeX
end

local function createRootFrame()
    local f
    local ok = pcall(function()
        f = CreateFrame("Frame", "AscBuildschmiedeFrame", UIParent, "PortraitFrameTemplate")
    end)
    if ok and f then
        f._ascChrome = "portrait"
        return f
    end

    f = CreateFrame("Frame", "AscBuildschmiedeFrame", UIParent)
    f._ascChrome = "dialog"
    applyClassicDialogChrome(f)
    return f
end

local function createInset(parent)
    local inset
    local ok = pcall(function()
        inset = CreateFrame("Frame", nil, parent, "InsetFrameTemplate")
    end)
    if ok and inset then
        if inset.Bg and inset.Bg.SetTexture then
            inset.Bg:SetTexture("Interface\\FrameGeneral\\UI-Background-Marble", true, true)
            if inset.Bg.SetHorizTile then
                inset.Bg:SetHorizTile(true)
                inset.Bg:SetVertTile(true)
            end
        end
        -- Dark text well on top of marble (MacroFrame readability).
        local well = CreateFrame("Frame", nil, inset)
        well:SetPoint("TOPLEFT", 4, -4)
        well:SetPoint("BOTTOMRIGHT", -4, 4)
        well:SetBackdrop(MACRO_INSET_BACKDROP)
        local cr, cg, cb, ca, br, bg, bb = tooltipColors()
        well:SetBackdropColor(cr, cg, cb, ca)
        well:SetBackdropBorderColor(br, bg, bb, 1)
        inset._textWell = well
        return inset
    end

    inset = CreateFrame("Frame", nil, parent)
    inset:SetBackdrop(MACRO_INSET_BACKDROP)
    local cr, cg, cb, ca, br, bg, bb = tooltipColors()
    inset:SetBackdropColor(cr, cg, cb, ca)
    inset:SetBackdropBorderColor(br, bg, bb, 1)
    return inset
end

local function setPayload(f, payload)
    f.payload = payload or ""
    f.edit:SetText(f.payload)
    f.edit:SetFocus()
    f.edit:HighlightText()
    if f.scroll and f.scroll.SetVerticalScroll then
        f.scroll:SetVerticalScroll(0)
    end
end

local function applyMode(f, mode, meta)
    f.mode = mode
    meta = meta or {}

    if mode == "foreign" then
        setTitle(f, "Fremder Build")
        setPortraitIcon(f, ICON_FOREIGN)
        f.subtitle:SetText(string.format("|cffFFD100Inspect|r  %s", meta.name or "?"))
        f.hint:SetText(
            "Der Text ist markiert. |cffFFD100Strg+C|r, dann auf der Seite unter " ..
            "|cffFFD100VERGLEICH|r einfuegen.")
        f.refresh:SetText("Mein Build")
        f.info:SetTextColor(1, 0.82, 0)
    else
        setTitle(f, "Buildschmiede Export")
        setPortraitIcon(f, ICON_OWN)
        f.subtitle:SetText("|cffAAAAAADein Charakter|r")
        f.hint:SetText(
            "Der Text ist markiert. |cffFFD100Strg+C|r, dann auf der Seite unter " ..
            "|cffFFD100EINFUEGEN|r einfuegen.")
        f.refresh:SetText("Neu einlesen")
        f.info:SetTextColor(0.7, 0.7, 0.7)
    end
end

-- Zusatzinfos nur aus dem Export-Text lesen (kein Collect-Aufruf).
local function richnessFromPayload(payload)
    payload = payload or ""
    local bits = {}

    local specline = payload:match("\nSPEC|([^\n]+)") or payload:match("^SPEC|([^\n]+)")
    if specline then
        local sid, sname = specline:match("^([^|]+)|(.*)$")
        if not sid then sid = specline end
        sname = sname and sname:match("%S") and sname or nil
        if sname then
            bits[#bits + 1] = "Spec " .. sid .. " " .. sname
        else
            bits[#bits + 1] = "Spec " .. sid
        end
    end

    local lockline = payload:match("\nLOCK|([^\n]+)") or payload:match("^LOCK|([^\n]+)")
    if lockline and lockline ~= "" then
        local n = 0
        for _ in lockline:gmatch("[^;]+") do n = n + 1 end
        if n > 0 then bits[#bits + 1] = "LOCK " .. n end
    end

    local mode = payload:match("\nMODE|([^\n|]+)") or payload:match("^MODE|([^\n|]+)")
    if mode and mode ~= "" then
        bits[#bits + 1] = mode
    end

    local gearN = 0
    for line in payload:gmatch("[^\r\n]+") do
        if line:sub(1, 5) == "GEAR|" then gearN = gearN + 1 end
    end
    local ilvl = payload:match("\nILVL|([^\n]+)") or payload:match("^ILVL|([^\n]+)")
    if gearN > 0 or ilvl then
        if gearN > 0 and ilvl then
            bits[#bits + 1] = string.format("%d Items · iLvl %s", gearN, ilvl)
        elseif gearN > 0 then
            bits[#bits + 1] = gearN .. " Items"
        else
            bits[#bits + 1] = "iLvl " .. ilvl
        end
    end

    return bits
end

local function statusOwn(payload)
    local abi, tal = payload:match("COUNT|A:(%d+)|T:(%d+)")
    local char = payload:match("CHAR|([^|]+)")
    local path = payload:match("PATH|([^\n|]+)")
    local db = BS.DB()
    local qline = payload:match("QUALITY|([^\n]+)")
    local parts = {
        string.format("v%s", BS.VERSION),
        char,
        path and ("Path " .. path) or nil,
        string.format("%s ABI · %s TAL", abi or "?", tal or "?"),
    }
    local rich = richnessFromPayload(payload)
    for i = 1, #rich do parts[#parts + 1] = rich[i] end
    parts[#parts + 1] = "Gear: " .. (db.includeGear and "an" or "aus")
    parts[#parts + 1] = "Stats: " .. (db.includeStats and "an" or "aus")
    local out = {}
    for i = 1, #parts do
        if parts[i] then out[#out + 1] = parts[i] end
    end
    local s = table.concat(out, "  |  ")
    if qline then
        s = s .. "  |  " .. qline:gsub("|", " · ")
    end
    return s
end

local function statusForeign(payload)
    local name = payload:match("CHAR|([^|]+)")
    local level = payload:match("CHAR|[^|]+|(%d+)")
    local path = payload:match("PATH|([^\n|]+)")
    local abi, tal = payload:match("COUNT|A:(%d+)|T:(%d+)")
    local who = name or "?"
    if level then who = who .. " L" .. level end
    local parts = {
        "Inspect",
        who,
        path and ("Path " .. path) or nil,
        string.format("%s ABI · %s TAL", abi or "?", tal or "?"),
    }
    local rich = richnessFromPayload(payload)
    for i = 1, #rich do parts[#parts + 1] = rich[i] end
    parts[#parts + 1] = "Zum VERGLEICH auf der Seite"
    local out = {}
    for i = 1, #parts do
        if parts[i] then out[#out + 1] = parts[i] end
    end
    return table.concat(out, "  |  ")
end

local function makeFrame()
    local f = createRootFrame()
    f:SetWidth(FRAME_W)
    f:SetHeight(FRAME_H)
    f:SetPoint("CENTER")
    f:SetFrameStrata("DIALOG")
    f:SetToplevel(true)
    f:SetClampedToScreen(true)
    f:SetMovable(true)
    f:EnableMouse(true)
    f:RegisterForDrag("LeftButton")
    f:SetScript("OnDragStart", f.StartMoving)
    f:SetScript("OnDragStop", f.StopMovingOrSizing)
    f:Hide()
    tinsert(UISpecialFrames, "AscBuildschmiedeFrame")

    setTitle(f, "Buildschmiede Export")
    setPortraitIcon(f, ICON_OWN)

    if f.CloseButton and f.CloseButton.SetScript then
        f.CloseButton:SetScript("OnClick", function() f:Hide() end)
    elseif not f.CloseButton then
        local closeX = CreateFrame("Button", nil, f, "UIPanelCloseButton")
        closeX:SetPoint("TOPRIGHT", 2, 1)
        closeX:SetScript("OnClick", function() f:Hide() end)
        f.CloseButton = closeX
    end

    f.title = f.TitleText or f.title

    -- PortraitFrame title strip sits under the metal top; DialogBox uses header banner.
    local topY = (f._ascChrome == "portrait") and -58 or -36

    local subtitle = f:CreateFontString(nil, "OVERLAY", "GameFontHighlight")
    subtitle:SetPoint("TOPLEFT", PAD + 4, topY)
    subtitle:SetPoint("TOPRIGHT", -(PAD + 28), topY)
    subtitle:SetJustifyH("LEFT")
    f.subtitle = subtitle

    local hint = f:CreateFontString(nil, "OVERLAY", "GameFontHighlightSmall")
    hint:SetPoint("TOPLEFT", PAD + 4, topY - 18)
    hint:SetPoint("TOPRIGHT", -(PAD + 4), topY - 18)
    hint:SetJustifyH("LEFT")
    hint:SetHeight(28)
    f.hint = hint

    local urlLabel = f:CreateFontString(nil, "OVERLAY", "GameFontNormalSmall")
    urlLabel:SetPoint("TOPLEFT", PAD + 4, topY - 50)
    urlLabel:SetText("Seite:")

    local url = CreateFrame("EditBox", "AscBuildschmiedeURL", f, "InputBoxTemplate")
    url:SetAutoFocus(false)
    url:SetHeight(20)
    url:SetPoint("LEFT", urlLabel, "RIGHT", 8, 0)
    url:SetPoint("RIGHT", -(PAD + 8), 0)
    url:SetText(BS.SITE)
    url:SetCursorPosition(0)
    url:SetScript("OnEscapePressed", function(self) self:ClearFocus() end)
    url:SetScript("OnEditFocusGained", function(self) self:HighlightText() end)
    url:SetScript("OnEditFocusLost", function(self)
        self:SetText(BS.SITE)
        self:SetCursorPosition(0)
    end)
    url:SetScript("OnTextChanged", function(self, user)
        if user and self:GetText() ~= BS.SITE then
            self:SetText(BS.SITE)
            self:HighlightText()
        end
    end)
    f.url = url

    -- Soft gold rule under the URL row (AscFastRoll separator idiom).
    local sep = f:CreateTexture(nil, "ARTWORK")
    sep:SetTexture("Interface\\Buttons\\WHITE8X8")
    sep:SetHeight(1)
    sep:SetPoint("TOPLEFT", PAD + 4, topY - 74)
    sep:SetPoint("TOPRIGHT", -(PAD + 4), topY - 74)
    sep:SetVertexColor(0.6, 0.5, 0.3, 0.45)

    local inset = createInset(f)
    inset:SetPoint("TOPLEFT", PAD, topY - 82)
    inset:SetPoint("BOTTOMRIGHT", -(PAD + 4), 78)
    f.inset = inset

    local scrollParent = inset._textWell or inset
    local scroll = CreateFrame("ScrollFrame", "AscBuildschmiedeScroll", scrollParent,
        "UIPanelScrollFrameTemplate")
    scroll:SetPoint("TOPLEFT", 6, -6)
    scroll:SetPoint("BOTTOMRIGHT", -28, 6)
    f.scroll = scroll

    local edit = CreateFrame("EditBox", "AscBuildschmiedeEdit", scroll)
    edit:SetMultiLine(true)
    edit:SetAutoFocus(false)
    edit:SetFontObject(GameFontHighlightSmall)
    edit:SetWidth(FRAME_W - PAD * 2 - 52)
    edit:SetMaxLetters(0)
    edit:SetScript("OnEscapePressed", function(self)
        self:ClearFocus()
        f:Hide()
    end)
    -- Nur Anzeige: User-Eingaben zuruecksetzen, Parser-Text bleibt exakt.
    edit:SetScript("OnTextChanged", function(self, user)
        if user then
            self:SetText(f.payload or "")
            self:HighlightText()
        end
    end)
    scroll:SetScrollChild(edit)
    f.edit = edit

    local info = f:CreateFontString(nil, "OVERLAY", "GameFontDisableSmall")
    info:SetPoint("BOTTOMLEFT", PAD + 4, 52)
    info:SetPoint("BOTTOMRIGHT", -(PAD + 4), 52)
    info:SetJustifyH("LEFT")
    info:SetHeight(18)
    f.info = info

    local copy = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
    copy:SetWidth(140)
    copy:SetHeight(24)
    copy:SetPoint("BOTTOMLEFT", PAD, 18)
    copy:SetText("Alles markieren")
    copy:SetScript("OnClick", function()
        edit:SetFocus()
        edit:HighlightText()
    end)

    local refresh = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
    refresh:SetWidth(120)
    refresh:SetHeight(24)
    refresh:SetPoint("LEFT", copy, "RIGHT", 8, 0)
    refresh:SetText("Neu einlesen")
    refresh:SetScript("OnClick", function()
        -- Fremdmodus: wechselt auf den eigenen Export.
        BS.Refresh()
    end)
    f.refresh = refresh

    local close = CreateFrame("Button", nil, f, "UIPanelButtonTemplate")
    close:SetWidth(100)
    close:SetHeight(24)
    close:SetPoint("BOTTOMRIGHT", -PAD, 18)
    close:SetText("Schliessen")
    close:SetScript("OnClick", function() f:Hide() end)

    applyMode(f, "own")
    return f
end

function BS.Refresh()
    if not frame then return end
    local payload = BS.BuildExport()
    applyMode(frame, "own")
    setPayload(frame, payload)
    frame.info:SetText(statusOwn(payload))
end

-- Fremder Build: gleiches Fenster, eigener Modus — Refresh ersetzt ihn
-- erst, wenn der Spieler "Mein Build" waehlt.
function BS.ShowForeign(payload)
    if not frame then frame = makeFrame() end
    frame:Show()
    local name = payload and payload:match("CHAR|([^|]+)")
    applyMode(frame, "foreign", { name = name })
    setPayload(frame, payload)
    frame.info:SetText(statusForeign(payload or ""))
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
