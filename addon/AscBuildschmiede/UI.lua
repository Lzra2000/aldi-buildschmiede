-- Export-Fenster: Ascension PortraitFrame-Chrome (wie Character Advancement /
-- Prestige / Skill Cards). Texturen nur als Client-Pfade — nichts gerippt.
-- Eigenen Build und Fremd-Inspect teilen sich den Frame.

local BS = AscBuildschmiede

local FRAME_W, FRAME_H = 600, 480
local PAD = 16

-- Icons wie CharacterAdvancement.lua (CA / Wildcard).
local ICON_OWN = "Interface\\Icons\\trade_archaeology_draenei_tome"
local ICON_FOREIGN = "Interface\\Icons\\misc_rune_pvp_random"

-- Fallback, falls PortraitFrameTemplate auf einem Realm fehlt.
local DIALOG_BACKDROP = {
    bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
    edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
    tile = true, tileSize = 32, edgeSize = 32,
    insets = { left = 11, right = 12, top = 12, bottom = 11 },
}

local INSET_BACKDROP = {
    bgFile = "Interface\\FrameGeneral\\UI-Background-Marble",
    edgeFile = "Interface\\Tooltips\\UI-Tooltip-Border",
    tile = true, tileSize = 16, edgeSize = 16,
    insets = { left = 4, right = 4, top = 4, bottom = 4 },
}

-- Metal-NineSlice-TexCoords aus AtlasInfo (UIFrameMetal*), ohne SetAtlas.
local METAL = {
    file = "Interface\\FrameGeneral\\UIFrameMetal",
    hfile = "Interface\\FrameGeneral\\UIFrameMetalHorizontal",
    vfile = "Interface\\FrameGeneral\\UIFrameMetalVertical",
    -- corner: left, right, top, bottom  (132x132 in atlas sheet)
    portraitTL = { 0.263672, 0.521484, 0.263672, 0.521484 },
    topRight   = { 0.00195312, 0.259766, 0.263672, 0.521484 },
    botLeft    = { 0.00195312, 0.259766, 0.00195312, 0.259766 },
    botRight   = { 0.263672, 0.521484, 0.00195312, 0.259766 },
    edgeTop    = { 0, 1, 0.263672, 0.521484 },
    edgeBot    = { 0, 1, 0.00195312, 0.259766 },
    edgeLeft   = { 0.00195312, 0.259766, 0, 1 },
    edgeRight  = { 0.263672, 0.521484, 0, 1 },
}

local frame

local function pcallSet(obj, method, ...)
    if not obj or type(obj[method]) ~= "function" then return false end
    return pcall(obj[method], obj, ...)
end

local function setTitle(f, text)
    if type(PortraitFrame_SetTitle) == "function" then
        PortraitFrame_SetTitle(f, text)
        return
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

local function tryAtlas(tex, atlas)
    if not tex or not atlas then return false end
    if type(tex.SetAtlas) ~= "function" then return false end
    -- IgnoreAtlasSize-Aequivalent: zweites Arg true = useAtlasSize auf manchen Clients.
    local ok = pcall(tex.SetAtlas, tex, atlas, true)
    if ok then return true end
    return pcall(tex.SetAtlas, tex, atlas)
end

local function texCorner(parent, point, path, mirrorH, mirrorV, size)
    local t = parent:CreateTexture(nil, "OVERLAY")
    t:SetTexture(path)
    t:SetWidth(size or 16)
    t:SetHeight(size or 16)
    t:SetPoint(point, parent, point, 0, 0)
    local l, r, to, bo = 0, 1, 0, 1
    if mirrorH then l, r = 1, 0 end
    if mirrorV then to, bo = 1, 0 end
    t:SetTexCoord(l, r, to, bo)
    return t
end

-- Goldrahmen-Akzent wie COMMON/GoldBorder-Atlanten (CA-Sidebar-Flair).
local function decorateGoldCorners(parent)
    local path = "Interface\\COMMON\\GoldBorder-Corner-TL"
    texCorner(parent, "TOPLEFT", path, false, false, 14)
    texCorner(parent, "TOPRIGHT", path, true, false, 14)
    texCorner(parent, "BOTTOMLEFT", path, false, true, 14)
    texCorner(parent, "BOTTOMRIGHT", path, true, true, 14)
end

-- CA-Ecken zusaetzlich (klein, Ascension-spezifisch).
local function decorateCACorners(parent)
    local path = "Interface\\CharacterAdvancement\\caCorner"
    local size = 22
    local offsets = {
        { "TOPLEFT", 2, -2, false, false },
        { "TOPRIGHT", -2, -2, true, false },
        { "BOTTOMLEFT", 2, 2, false, true },
        { "BOTTOMRIGHT", -2, 2, true, true },
    }
    for i = 1, #offsets do
        local o = offsets[i]
        local t = parent:CreateTexture(nil, "OVERLAY")
        t:SetTexture(path)
        t:SetWidth(size)
        t:SetHeight(size)
        t:SetPoint(o[1], parent, o[1], o[2], o[3])
        local l, r, to, bo = 0, 1, 0, 1
        if o[4] then l, r = 1, 0 end
        if o[5] then to, bo = 1, 0 end
        t:SetTexCoord(l, r, to, bo)
        t:SetVertexColor(1, 0.85, 0.45, 0.95)
    end
end

local function addMetalPiece(parent, layer, file, w, h, point, x, y, coords)
    local t = parent:CreateTexture(nil, layer or "OVERLAY")
    t:SetTexture(file)
    t:SetWidth(w)
    t:SetHeight(h)
    t:SetPoint(point, parent, point, x or 0, y or 0)
    if coords then
        t:SetTexCoord(coords[1], coords[2], coords[3], coords[4])
    end
    return t
end

-- Manuelles Portrait-/Metal-Chrome, wenn das XML-Template fehlt.
local function applyManualMetalChrome(f)
    local bg = f:CreateTexture(nil, "BACKGROUND")
    bg:SetTexture("Interface\\FrameGeneral\\UI-Background-Rock")
    bg:SetPoint("TOPLEFT", 6, -22)
    bg:SetPoint("BOTTOMRIGHT", -6, 6)
    if bg.SetHorizTile then
        bg:SetHorizTile(true)
        bg:SetVertTile(true)
    end
    f.Bg = bg

    local corner = 36
    addMetalPiece(f, "OVERLAY", METAL.file, corner, corner, "TOPLEFT", -8, 10, METAL.portraitTL)
    addMetalPiece(f, "OVERLAY", METAL.file, corner, corner, "TOPRIGHT", 2, 10, METAL.topRight)
    addMetalPiece(f, "OVERLAY", METAL.file, corner, corner, "BOTTOMLEFT", -8, -2, METAL.botLeft)
    addMetalPiece(f, "OVERLAY", METAL.file, corner, corner, "BOTTOMRIGHT", 2, -2, METAL.botRight)

    local top = f:CreateTexture(nil, "BORDER")
    top:SetTexture(METAL.hfile)
    top:SetHeight(28)
    top:SetPoint("TOPLEFT", f, "TOPLEFT", corner - 8, 10)
    top:SetPoint("TOPRIGHT", f, "TOPRIGHT", -(corner - 2), 10)
    top:SetTexCoord(METAL.edgeTop[1], METAL.edgeTop[2], METAL.edgeTop[3], METAL.edgeTop[4])

    local bot = f:CreateTexture(nil, "BORDER")
    bot:SetTexture(METAL.hfile)
    bot:SetHeight(28)
    bot:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", corner - 8, -2)
    bot:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", -(corner - 2), -2)
    bot:SetTexCoord(METAL.edgeBot[1], METAL.edgeBot[2], METAL.edgeBot[3], METAL.edgeBot[4])

    local left = f:CreateTexture(nil, "BORDER")
    left:SetTexture(METAL.vfile)
    left:SetWidth(28)
    left:SetPoint("TOPLEFT", f, "TOPLEFT", -8, -(corner - 10))
    left:SetPoint("BOTTOMLEFT", f, "BOTTOMLEFT", -8, corner - 2)
    left:SetTexCoord(METAL.edgeLeft[1], METAL.edgeLeft[2], METAL.edgeLeft[3], METAL.edgeLeft[4])

    local right = f:CreateTexture(nil, "BORDER")
    right:SetTexture(METAL.vfile)
    right:SetWidth(28)
    right:SetPoint("TOPRIGHT", f, "TOPRIGHT", 2, -(corner - 10))
    right:SetPoint("BOTTOMRIGHT", f, "BOTTOMRIGHT", 2, corner - 2)
    right:SetTexCoord(METAL.edgeRight[1], METAL.edgeRight[2], METAL.edgeRight[3], METAL.edgeRight[4])

    local portrait = f:CreateTexture(nil, "ARTWORK")
    portrait:SetWidth(56)
    portrait:SetHeight(56)
    portrait:SetPoint("TOPLEFT", 4, -2)
    portrait:SetTexture(ICON_OWN)
    f.portrait = portrait

    local ring = f:CreateTexture(nil, "OVERLAY")
    ring:SetTexture("Interface\\COMMON\\WhiteIconFrame")
    ring:SetWidth(60)
    ring:SetHeight(60)
    ring:SetPoint("CENTER", portrait, "CENTER", 0, 0)

    local title = f:CreateFontString(nil, "OVERLAY", "GameFontNormal")
    title:SetPoint("TOP", 0, -4)
    title:SetPoint("LEFT", portrait, "RIGHT", 10, 0)
    title:SetPoint("RIGHT", -36, 0)
    title:SetJustifyH("LEFT")
    f.TitleText = title
    f.title = title

    local closeX = CreateFrame("Button", nil, f, "UIPanelCloseButton")
    closeX:SetPoint("TOPRIGHT", 2, 2)
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
    f._ascChrome = "manual"
    f:SetBackdrop(DIALOG_BACKDROP)
    applyManualMetalChrome(f)
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
        -- CA-Header-Streifen oben im Inset (Atlas oder TexCoord-Fallback).
        local header = inset:CreateTexture(nil, "ARTWORK")
        header:SetHeight(36)
        header:SetPoint("TOPLEFT", 2, -2)
        header:SetPoint("TOPRIGHT", -2, -2)
        if not tryAtlas(header, "ca-background-header") then
            header:SetTexture("Interface\\CharacterAdvancement\\CharacterAdvancementBackgrounds")
            -- ca-background-header TexCoords aus AtlasInfo
            header:SetTexCoord(0.001953125, 0.38916015625, 0.82568359375, 0.96142578125)
        end
        header:SetVertexColor(1, 1, 1, 0.85)
        inset._caHeader = header
        decorateGoldCorners(inset)
        inset._decorated = true
        return inset
    end

    inset = CreateFrame("Frame", nil, parent)
    inset:SetBackdrop(INSET_BACKDROP)
    inset:SetBackdropColor(0.12, 0.11, 0.1, 0.95)
    inset:SetBackdropBorderColor(0.55, 0.48, 0.3, 1)
    decorateCACorners(inset)
    inset._decorated = true
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
            "Text ist markiert: |cffFFD100Strg+C|r, dann auf der Seite unter " ..
            "|cffFFD100VERGLEICH|r einfuegen.")
        f.refresh:SetText("Eigenen Build")
        f.info:SetTextColor(1, 0.82, 0)
    else
        setTitle(f, "Buildschmiede Export")
        setPortraitIcon(f, ICON_OWN)
        f.subtitle:SetText("|cffAAAAAADein Charakter|r")
        f.hint:SetText(
            "Text ist markiert: |cffFFD100Strg+C|r, dann auf der Seite unter " ..
            "|cffFFD100EINFUEGEN|r ablegen.")
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
    parts[#parts + 1] = "Gear:" .. (db.includeGear and "an" or "aus")
    parts[#parts + 1] = "Stats:" .. (db.includeStats and "an" or "aus")
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
    parts[#parts + 1] = "→ VERGLEICH auf der Seite"
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

    -- CloseButton vom Template nutzen; sonst bereits in applyManualMetalChrome.
    if f.CloseButton and f.CloseButton.SetScript then
        f.CloseButton:SetScript("OnClick", function() f:Hide() end)
    elseif not f.CloseButton then
        local closeX = CreateFrame("Button", nil, f, "UIPanelCloseButton")
        closeX:SetPoint("TOPRIGHT", 2, 1)
        closeX:SetScript("OnClick", function() f:Hide() end)
        f.CloseButton = closeX
    end

    -- TitleText vom Template als f.title spiegeln (Status/Modus).
    f.title = f.TitleText or f.title

    -- Leichter CA-Hintergrund hinter dem Inhalt (Atlas wenn verfuegbar).
    local bodyBg = f:CreateTexture(nil, "BACKGROUND")
    bodyBg:SetPoint("TOPLEFT", 8, -28)
    bodyBg:SetPoint("BOTTOMRIGHT", -8, 8)
    if not tryAtlas(bodyBg, "ca-background-browser") then
        bodyBg:SetTexture("Interface\\FrameGeneral\\UI-Background-Marble")
        if bodyBg.SetHorizTile then
            bodyBg:SetHorizTile(true)
            bodyBg:SetVertTile(true)
        end
    end
    bodyBg:SetVertexColor(0.85, 0.85, 0.9, 0.55)
    f.bodyBg = bodyBg

    local topY = -58
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

    local inset = createInset(f)
    inset:SetPoint("TOPLEFT", PAD, topY - 78)
    inset:SetPoint("BOTTOMRIGHT", -(PAD + 4), 78)
    f.inset = inset
    if not inset._decorated then
        decorateCACorners(inset)
    end

    local scroll = CreateFrame("ScrollFrame", "AscBuildschmiedeScroll", inset,
        "UIPanelScrollFrameTemplate")
    scroll:SetPoint("TOPLEFT", 8, -8)
    scroll:SetPoint("BOTTOMRIGHT", -28, 8)
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
-- erst, wenn der Spieler "Eigenen Build" waehlt.
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
