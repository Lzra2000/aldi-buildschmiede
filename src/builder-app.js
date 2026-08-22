(function () {
  "use strict";

  var D = JSON.parse(document.getElementById("data").textContent);
  var CAT = D.cat;          // [name, kind, class, quality, level, desc]
  var REL = D.rel;          // [baseIdx, needsIdx, refs[], dupGroup, gate, cdGroup]
  var ARCH = D.arch;        // archetyp -> [idx]
  var SPR = D.spr;          // {cols, tile, idx[]}
  var CDG = D.cdg || [];    // Namen der Shared-Cooldown-Gruppen
  var BM = D.bm || {};      // Basis-Index -> Talente, die sie verbessern
  var UB = D.ub || {};      // Variante -> Basis aus Katalogtext "uses X modifiers"
  var TAG = D.tag || [];    // Bitmaske: woraus zieht ein Eintrag seinen Wert
  var SC = D.sc || [];      // aus den Tooltips gelesene Skalierungszahlen
  var MC = D.mc || [];      // Cooldown, Castzeit, Kosten aus Spell.dbc
  var METH = D.meth || null; // pipeline/methods.py → Tempo/Hitze/Lücken/Resmap
  var TREE = D.tree || [];  // Spec-/Schul-Tab (DataMiner), "" wenn unbekannt
  var DES = D.des || null;  // 1 = Desire-Board-fähig (CatalogData)
  var STAGS = D.stags || D.spelltags || null; // method-spelltags.json → DBC SpellTags
  var SID = D.sid || [];    // Katalogindex -> spellId (Addon-Export)
  var EID = D.eid || [];    // Katalogindex -> entryId (Addon-Export)
  var ITEMICONS = D.iic || D.itemicons || D.iico || null;
  var WPN = D.wpn || null;  // itemId -> {n,q,ilvl,dmg,b} aus weapons.py
  var ILB = D.ilb || null;  // ItemStat-Stufenbänder (ilvl / w1h / w2h / armor)
  var TAGN = D.tagn || null;   // SpellTagTypes Namen + bySpell
  var SSUG = D.ssug || null;   // SpellStatSuggestions path-codes (≠ PrimaryStat-IDs)
  var SSUGSP = D.ssugsp || null; // SpellSpellSuggestions related-graph (optional)
  var FRM = D.frm || [];       // Form-Familie (formtags.py), "" wenn unbekannt
  var PREQ = D.preq || null;   // harte Path-Requires (pathreq.py) ≠ D.ssug

  // SpellTag-Index: Katalogindex → {facets[], schools[], tagCount}
  var STAG_BY_I = {};
  if (STAGS && STAGS.entries) {
    STAGS.entries.forEach(function (e) {
      if (e && e.i !== undefined) STAG_BY_I[e.i] = e;
    });
  }

  // Talent-Vererbung: relations.base, sonst Text-usesbase (modifiers.py).
  // Schulvariante erbt TALENTE der Basis — nicht die Basisfähigkeit selbst.
  function inheritBase(i) {
    var b = REL[i][0];
    if (b !== null && b !== undefined) return b;
    var u = UB[i];
    if (u === undefined || u === null) u = UB[String(i)];
    return (u === undefined || u === null) ? null : +u;
  }
  function bmOf(i) {
    if (i === null || i === undefined) return [];
    return BM[i] || BM[String(i)] || [];
  }
  function pushUniq(arr, x) {
    if (arr.indexOf(x) < 0) arr.push(x);
  }
  // Schulvarianten, die die Talente von Basis b erben (ohne b selbst).
  var VARIANTS = null;
  function variantsOf(b) {
    if (b === null || b === undefined) return [];
    if (!VARIANTS) {
      VARIANTS = {};
      for (var vi = 0; vi < CAT.length; vi++) {
        var vb = inheritBase(vi);
        if (vb === null || vb === undefined) continue;
        (VARIANTS[vb] = VARIANTS[vb] || []).push(vi);
      }
    }
    return VARIANTS[b] || VARIANTS[String(b)] || [];
  }
  function sameGcdSlot(a, b) {
    if (a === b) return true;
    var g = REL[a] && REL[a][3];
    return g >= 0 && REL[b] && REL[b][3] === g;
  }
  // Basis selbst oder eine Schulvariante davon steht im Build.
  function haveInherited(have, base) {
    if (base === null || base === undefined) return false;
    if (have[base]) return true;
    var vs = variantsOf(base);
    for (var hi = 0; hi < vs.length; hi++) {
      if (have[vs[hi]]) return true;
    }
    return false;
  }
  // Gewählte Ziele: genannte Basis oder Variante, die deren Talente erbt.
  function liveFromBases(have, bases) {
    var out = [];
    (bases || []).forEach(function (base) {
      if (have[base]) pushUniq(out, base);
      variantsOf(base).forEach(function (v) {
        if (have[v]) pushUniq(out, v);
      });
    });
    return out;
  }

  function tagTypeName(id) {
    if (!TAGN || !TAGN.types) return "";
    var t = TAGN.types[id] || TAGN.types[String(id)];
    return t ? (t.name || t.cat || "") : "";
  }
  function spellTagIds(i) {
    if (!TAGN || !TAGN.bySpell) return [];
    var sid = SID[i];
    if (!sid) return [];
    return TAGN.bySpell[sid] || TAGN.bySpell[String(sid)] || [];
  }
  // DBC-Path-Code-Label (SpellStatSuggestions) — Codes 0/1/3/4, nicht PrimaryStat-IDs.
  function ssugPathLabel(i) {
    if (!SSUG || !SSUG.path) return "";
    return SSUG.path[i] || "";
  }
  // Harte Path-Sperre (CatalogData / Katalog / relations.Pfad) — nicht ssug.
  var PATH_REQ_DE = {
    str: "Strength", agi: "Agility", int: "Intelligence",
    heal: "Healing", dua: "Duality"
  };
  function pathReqKeys(i) {
    if (!PREQ || !PREQ.req) return [];
    var s = PREQ.req[i];
    if (s === undefined || s === null) s = PREQ.req[String(i)];
    if (!s) return [];
    return String(s).split("+").filter(Boolean);
  }
  function pathReqRaw(i) {
    if (!PREQ || !PREQ.raw) return "";
    return PREQ.raw[i] || PREQ.raw[String(i)] || "";
  }
  function pathReqLabel(keys) {
    return (keys || []).map(function (k) {
      return PATH_REQ_DE[k] || k;
    }).join(" / ");
  }
  // Related-Spell-Graph (SpellSpellSuggestions) — flat [idx, weight, …], keine Kanten erfinden.
  function ssugspPairs(i) {
    if (!SSUGSP || !SSUGSP.rel) return [];
    var flat = SSUGSP.rel[i];
    if (!flat || !flat.length) return [];
    var out = [];
    for (var k = 0; k + 1 < flat.length; k += 2) {
      var j = +flat[k], w = +flat[k + 1] || 0;
      if (j >= 0 && j < CAT.length && CAT[j]) out.push({ j: j, w: w });
    }
    return out;
  }
  function schoolDe(s) {
    return SCHOOL_DE[s] || s;
  }
  function verwandteHtml(i, lim, bare) {
    var pairs = ssugspPairs(i);
    if (!pairs.length) return "";
    lim = lim || 4;
    var chips = pairs.slice(0, lim).map(function (p) {
      return '<span class="bdg" data-add="' + p.j +
        '" title="Verwandt (SpellSpellSuggestions, Gewicht ' + p.w +
        ') — klicken zum Hinzufügen">' + esc(CAT[p.j][0]) + "</span>";
    }).join("");
    var rest = pairs.length > lim
      ? '<span class="meta">+' + (pairs.length - lim) + "</span>"
      : "";
    if (bare) return chips + rest;
    return '<span class="bdgs">' +
      '<span class="meta">Verwandte</span>' + chips + rest +
      "</span>";
  }

  // Facetten-Gewichte wie pipeline/_method_spelltags.py (Level 10–60).
  var STAG_WEIGHT = {
    mobility: 12, interrupt: 14, hard_cc: 8, soft_cc: 10,
    defensive: 9, direct_heal: 7, hot: 4, absorb: 5,
    dot: 3, aoe: 6, cleave: 4, single: 2,
    melee: 1, magic: 1, ranged: 1, dispel: 6,
    raid_buff: 5, taunt: 3
  };
  var STAG_LABEL_DE = {
    mobility: "Mobilität", interrupt: "Interrupt", hard_cc: "Hard-CC",
    soft_cc: "Soft-CC", defensive: "Defensiv", direct_heal: "Direkte Heilung",
    hot: "HoT", absorb: "Absorb", dot: "DoT", aoe: "AoE",
    cleave: "Cleave", single: "Einzelziel", melee: "Nahkampf",
    magic: "Magie", ranged: "Distanz", dispel: "Dispel",
    raid_buff: "Raid-/Gruppenbuff", taunt: "Spott"
  };
  var SCHOOL_DE = {
    Physical: "Physisch", Fire: "Feuer", Frost: "Frost", Nature: "Natur",
    Holy: "Heilig", Shadow: "Schatten", Arcane: "Arkan"
  };

  function stagFacetList() {
    if (STAGS && STAGS.facets && STAGS.facets.length) return STAGS.facets;
    return Object.keys(STAG_WEIGHT).map(function (k) {
      return { key: k, label: STAG_LABEL_DE[k] || k, weight: STAG_WEIGHT[k] };
    });
  }
  function stagLabel(key) {
    if (STAG_LABEL_DE[key]) return STAG_LABEL_DE[key];
    var facets = STAGS && STAGS.facets;
    if (facets) {
      for (var fi = 0; fi < facets.length; fi++) {
        if (facets[fi].key === key) return facets[fi].label || key;
      }
    }
    return key;
  }
  function stagWeight(f) {
    if (f && typeof f === "object") {
      if (f.weight != null) return +f.weight || 1;
      if (STAG_WEIGHT[f.key] != null) return STAG_WEIGHT[f.key];
      return 1;
    }
    if (typeof f === "string" && STAG_WEIGHT[f] != null) return STAG_WEIGHT[f];
    return 1;
  }
  var QN = ["Normal", "Uncommon", "Rare", "Epic", "Legendary"];
  var MAX_A = 30, MAX_T = 25;

  // Umkehrindex: Katalogposition -> Archetypname
  var archOf = {};
  Object.keys(ARCH).forEach(function (k) {
    ARCH[k].forEach(function (i) { archOf[i] = k; });
  });

  // ID-Indizes: first wins — gleiche Spell-ID kann bei Varianten mehrfach
  // vorkommen; der erste Katalogtreffer reicht fuer den Import.
  var BYSID = {}, BYEID = {};
  SID.forEach(function (id, i) {
    if (id && BYSID[id] === undefined) BYSID[id] = i;
  });
  EID.forEach(function (id, i) {
    if (id && BYEID[id] === undefined) BYEID[id] = i;
  });

  var picked = Object.create(null);   // idx -> true
  var el = {};
  ["q", "fKind", "fClass", "fTree", "fQual", "fDesire", "fScale", "fSort", "fPathReq", "list", "hits", "slotsA", "slotsT",
   "cA", "cT", "cF", "flags", "url", "toast"].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  function treeLabel(t) {
    if (!t) return "";
    return t === "BeastMastery" ? "Beast Mastery" : t;
  }

  // CatalogData.desiredEligible — Rapid-Roll / Desire-Board, nicht die
  // persoenliche Wunschliste aus dem Addon-Export (isDesiredIdx).
  // D.meth.rollgate.blocked deckt dieselbe Menge ab (Fallback ohne D.des).
  var ROLLGATE_BLOCK = Object.create(null);
  if (METH && METH.rollgate && METH.rollgate.blocked) {
    METH.rollgate.blocked.forEach(function (b) {
      if (b && b.i !== undefined) ROLLGATE_BLOCK[b.i] = 1;
    });
  }
  // methods.gaps: ehrliche Lücken (kein Koeffizient erfunden). Index für Badges.
  var METH_GAP = Object.create(null);
  if (METH && METH.gaps && METH.gaps.items) {
    METH.gaps.items.forEach(function (it) {
      if (it && it.i !== undefined) METH_GAP[it.i] = it;
    });
  }
  function isDesireEligIdx(i) {
    if (ROLLGATE_BLOCK[i]) return false;
    return !DES || DES[i] !== 0;
  }

  // ---------- Hilfen ----------
  // Der Versatz im Sprite haengt von der ANGEZEIGTEN Kachelgroesse ab,
  // nicht von der Groesse im Bild. Wer background-size ueberschreibt, muss
  // die Position mitskalieren - sonst zeigt der Ausschnitt ins Leere.
  // Genau das war der Grund, warum die Icons in "Dein Build" fehlten.
  function iconStyle(i, size) {
    var t = SPR.idx[i];
    // No background shorthand — it would wipe the sprite background-image.
    if (t < 0) return "background-image:none;background-color:var(--sunken)";
    size = size || SPR.tile;
    var x = (t % SPR.cols) * size, y = Math.floor(t / SPR.cols) * size;
    return "background-position:-" + x + "px -" + y + "px;" +
      "background-size:" + (SPR.cols * size) + "px auto";
  }
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }
  // Progressive disclosure: Kurzfassung zuerst, Rest in <details class="more">.
  function wrapDetails(html, label) {
    if (!html) return "";
    return '<details class="more"><summary>' + esc(label) + "</summary>" +
      '<div class="more-body">' + html + "</div></details>";
  }
  function toast(msg) {
    el.toast.textContent = msg;
    el.toast.classList.add("on");
    clearTimeout(toast._t);
    toast._t = setTimeout(function () { el.toast.classList.remove("on"); }, 1900);
  }
  function counts() {
    var a = 0, t = 0;
    for (var k in picked) { if (CAT[k][1] === 1) t++; else a++; }
    return { a: a, t: t };
  }

  // ---------- Klassen- und Spec-Filter füllen ----------
  (function () {
    var cs = {};
    CAT.forEach(function (r) { cs[r[2]] = 1; });
    Object.keys(cs).sort().forEach(function (c) {
      var o = document.createElement("option");
      o.value = c; o.textContent = c;
      el.fClass.appendChild(o);
    });
    if (el.fTree) {
      var ts = {};
      TREE.forEach(function (t) { if (t) ts[t] = 1; });
      Object.keys(ts).sort().forEach(function (t) {
        var o = document.createElement("option");
        o.value = t; o.textContent = treeLabel(t);
        el.fTree.appendChild(o);
      });
    }
  })();

  // ---------- Katalogliste ----------
  var shown = [];
  function render() {
    var q = el.q.value.trim().toLowerCase();
    var fk = el.fKind.value, fc = el.fClass.value, fq = el.fQual.value;
    var ft = el.fTree ? el.fTree.value : "";
    var fd = el.fDesire ? el.fDesire.value : "";
    var fs = el.fScale.value;
    var hit = [], CAP = 300;
    for (var i = 0; i < CAT.length; i++) {
      var r = CAT[i];
      if (fk !== "" && String(r[1]) !== fk) continue;
      if (fc !== "" && r[2] !== fc) continue;
      if (ft !== "" && TREE[i] !== ft) continue;
      if (fq !== "" && String(r[3]) !== fq) continue;
      if (fd !== "" && String(isDesireEligIdx(i) ? 1 : 0) !== fd) continue;
      if (!scaleMatch(i, fs)) continue;
      if (q && r[0].toLowerCase().indexOf(q) < 0 && r[5].toLowerCase().indexOf(q) < 0) continue;
      hit.push(i);
    }
    var total = hit.length;
    var so = el.fSort.value;
    if (so) {
      hit.sort(function (a, b) {
        var ka = sortKey(so, a), kb = sortKey(so, b);
        return ka < kb ? -1 : ka > kb ? 1 : a - b;
      });
    }
    var rows = hit.slice(0, CAP).map(function (i) { return row(i, CAT[i]); });
    el.hits.textContent = total + " Treffer" +
      (total > rows.length ? " (" + rows.length + " gezeigt)" : "");
    el.list.innerHTML = rows.join("");
    syncFiltMore();
  }

  // Kurztext immer. Clamp: .row.compact .desc (CSS-Lane) bzw. .ds.
  // Kein Tooltip-<details> — das wäre eine extra Chrome-Zeile.
  function rowDesc(tip) {
    if (!tip) return "";
    return '<span class="desc ds" title="' + esc(tip) + '">' + esc(tip) + "</span>";
  }

  function row(i, r) {
    var tr = treeLabel(TREE[i]);
    var block = tooHigh(i) ? " lock" : (overBudget(i) && !picked[i] ? " lock" : "");
    return '<div class="row compact' + (picked[i] ? " picked" : block) + '" data-i="' + i + '" role="button" tabindex="0">' +
      '<span class="icon qf' + r[3] + '" style="width:32px;height:32px;flex:0 0 32px;' + iconStyle(i) + '"></span>' +
      '<span class="body"><span class="nm q' + r[3] + '">' + esc(r[0]) + "</span>" +
      rowDesc(r[5]) + badges(i) +
      "</span>" +
      '<span class="meta">' + (r[1] ? "TAL" : "ABI") + " · " + esc(r[2]) +
      (tr ? " · " + esc(tr) : "") +
      " · " + (tooHigh(i) ? '<span class="lvlbad">lvl' + r[4] + "</span>" : "lvl" + r[4]) +
      "</span></div>";
  }

  el.list.addEventListener("click", function (e) {
    // Verwandte-Chips (data-add) nicht als Katalogzeilen-Toggle werten.
    if (e.target.closest("[data-add]")) return;
    if (e.target.closest("details.more")) return;
    var t = e.target.closest(".row");
    if (t) toggle(+t.dataset.i);
  });
  el.list.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.closest("[data-add]")) return;
    if (e.target.closest("details.more")) return;
    var t = e.target.closest(".row");
    if (t) { e.preventDefault(); toggle(+t.dataset.i); }
  });
  // Tippen soll nicht bei jedem Zeichen 3.071 Eintraege durchrechnen.
  var renderTimer;
  function renderSoon() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(render, 110);
  }
  el.q.addEventListener("input", renderSoon);
  ["fKind", "fClass", "fTree", "fQual", "fDesire", "fScale", "fSort"].forEach(function (id) {
    if (el[id]) el[id].addEventListener("input", render);
  });

  // Weitere Filter: aktive Nebenfilter sichtbar halten, auch wenn details zu ist.
  function syncFiltMore() {
    var ids = ["fSort", "fScale", "fQual"];
    var n = 0;
    ids.forEach(function (id) {
      if (el[id] && el[id].value) n++;
    });
    var box = document.getElementById("filtMore");
    var badge = document.getElementById("filtMoreN");
    if (box) box.classList.toggle("active", n > 0);
    if (badge) {
      if (n) {
        badge.hidden = false;
        badge.textContent = " · " + n;
      } else {
        badge.hidden = true;
        badge.textContent = "";
      }
    }
  }
  var filtReset = document.getElementById("filtMoreReset");
  if (filtReset) {
    filtReset.addEventListener("click", function (e) {
      e.preventDefault();
      ["fSort", "fScale", "fQual"].forEach(function (id) {
        if (el[id]) el[id].value = "";
      });
      render();
    });
  }

  function toggle(i) {
    if (picked[i]) { delete picked[i]; }
    else {
      var c = counts();
      if (CAT[i][1] === 1 && c.t >= MAX_T) { toast("Talente voll (" + MAX_T + ")"); return; }
      if (CAT[i][1] === 0 && c.a >= MAX_A) { toast("Abilities voll (" + MAX_A + ")"); return; }
      // Zwei Grenzen, die es nur mit importiertem Charakter gibt.
      if (tooHigh(i)) {
        toast(CAT[i][0] + " braucht Stufe " + CAT[i][4] + " — du bist " + CHAR.level);
        return;
      }
      if (overBudget(i)) {
        toast(QN[entryQual(i)] + "-Budget ist voll (" + qualityLimit(entryQual(i)) + ")");
        return;
      }
      picked[i] = true;
    }
    refresh();
  }

  // ---------- Slots ----------
  function slots() {
    var A = [], T = [];
    Object.keys(picked).map(Number).forEach(function (i) {
      (CAT[i][1] ? T : A).push(i);
    });
    var by = function (x, y) { return CAT[y][3] - CAT[x][3] || CAT[x][0].localeCompare(CAT[y][0]); };
    A.sort(by); T.sort(by);
    el.slotsA.innerHTML = A.length ? A.map(slotRow).join("") :
      '<div class="empty">Noch nichts gewählt</div>';
    el.slotsT.innerHTML = T.length ? T.map(slotRow).join("") :
      '<div class="empty">Noch nichts gewählt</div>';
    var c = counts();
    el.cA.textContent = c.a + " / " + MAX_A;
    el.cT.textContent = c.t + " / " + MAX_T;
    el.cA.className = "cnt " + (c.a === MAX_A ? "full" : c.a ? "ok" : "");
    el.cT.className = "cnt " + (c.t === MAX_T ? "full" : c.t ? "ok" : "");
  }
  function slotRow(i) {
    var r = CAT[i];
    return '<div class="slot"><span class="icon qf' + r[3] +
      '" style="width:20px;height:20px;flex:0 0 20px;' +
      iconStyle(i, 20) + '"></span>' +
      '<span class="nm q' + r[3] + '" title="' + esc(r[5]) + '">' +
      esc(r[0]) + "</span>" +
      '<button type="button" class="rm" data-rm="' + i +
      '" aria-label="Entfernen">×</button></div>';
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-rm]");
    if (b) { delete picked[+b.dataset.rm]; refresh(); }
  });

  // ---------- Analyse ----------
  function analyse() {
    var ids = Object.keys(picked).map(Number);
    var have = {}; ids.forEach(function (i) { have[i] = 1; });
    var out = [];

    // 1. Dubletten = derselbe GCD-Slot (nicht parallel stapelbar)
    var groups = {};
    ids.forEach(function (i) {
      var g = REL[i][3];
      if (g >= 0) (groups[g] = groups[g] || []).push(i);
    });
    Object.keys(groups).forEach(function (g) {
      if (groups[g].length > 1) {
        out.push('<div class="flag dup"><b>Gleicher GCD</b> — ' +
          groups[g].map(function (i) { return esc(CAT[i][0]); }).join(" · ") +
          " sind Schulvarianten derselben Fähigkeit und teilen sich <b>einen</b> GCD. " +
          "Zwei davon zu nehmen verdoppelt deinen Takt nicht — du hast nur " +
          "verschiedene Schulen auf demselben Slot. Nimm eine.</div>");
      }
    });

    // 2. Fehlende Voraussetzungen
    ids.forEach(function (i) {
      var need = REL[i][1];
      if (need !== null && need !== undefined && !have[need]) {
        out.push('<div class="flag pre"><b>Skaliert nicht</b> — ' + esc(CAT[i][0]) +
          " braucht <b>" + esc(CAT[need][0]) + "</b>. Ohne das ist der Effekt inaktiv.</div>");
      }
    });

    // 3. Basis-Vererbung.
    //    Wichtig: eine Variante wie Burning Slam erbt die TALENTE von Slam,
    //    nicht die Faehigkeit Slam. Ob Slam selbst im Build steht, ist
    //    voellig egal - entscheidend ist, ob ein Talent gewaehlt wurde, das
    //    die Basis verbessert.
    ids.forEach(function (i) {
      var base = inheritBase(i);
      if (base === null || base === undefined) return;
      var mods = BM[base] || [];
      var active = mods.filter(function (j) { return have[j]; });
      if (active.length) {
        out.push('<div class="flag syn"><b>Skaliert</b> — ' + esc(CAT[i][0]) +
          " erbt " + esc(CAT[base][0]) + "-Modifikatoren, und du hast " +
          active.map(function (j) { return "<b>" + esc(CAT[j][0]) + "</b>"; }).join(", ") +
          " gewählt. Wirkt voll.</div>");
      } else if (mods.length) {
        var sug = mods.slice(0, 4).map(function (j) { return esc(CAT[j][0]); }).join(", ");
        out.push('<div class="flag pre"><b>Skaliert gerade nicht</b> — ' + esc(CAT[i][0]) +
          " erbt <b>" + esc(CAT[base][0]) + "</b>-Modifikatoren, aber du hast kein Talent " +
          "gewählt, das " + esc(CAT[base][0]) + " verbessert. " +
          "In Frage kämen: " + sug + ".</div>");
      } else {
        out.push('<div class="flag syn"><b>Vererbung</b> — ' + esc(CAT[i][0]) +
          " nutzt " + esc(CAT[base][0]) + "-Modifikatoren. Für diese Basis gibt es im " +
          "Katalog allerdings kein eigenes Talent.</div>");
      }
    });

    // 4. Querverweise zwischen gewählten Einträgen = echte Synergie
    var seen = {};
    ids.forEach(function (i) {
      (REL[i][2] || []).forEach(function (j) {
        if (!have[j]) return;
        var k = Math.min(i, j) + ":" + Math.max(i, j);
        if (seen[k]) return;
        seen[k] = 1;
        out.push('<div class="flag syn"><b>Synergie</b> — ' + esc(CAT[i][0]) +
          " nennt <b>" + esc(CAT[j][0]) + "</b> im Tooltip. Beide sind gewählt.</div>");
      });
    });

    // 4b. Harte Voraussetzungen (Path / Item / Waffe / Stat / Rang)
    ids.forEach(function (i) {
      var g = REL[i][4];
      if (!g) return;
      out.push('<div class="flag pre"><b>' + esc(g[0]) + ' nötig</b> — ' + esc(CAT[i][0]) +
        " setzt <b>" + esc(g[1]) + "</b> voraus. Fehlt das, passiert nichts.</div>");
    });

    // 4c. Geteilte Cooldowns
    var cdg = {};
    ids.forEach(function (i) {
      var g = REL[i][5];
      if (g >= 0) (cdg[g] = cdg[g] || []).push(i);
    });
    Object.keys(cdg).forEach(function (g) {
      if (cdg[g].length > 1) {
        out.push('<div class="flag dup"><b>Geteilter Cooldown</b> — ' +
          cdg[g].map(function (i) { return esc(CAT[i][0]); }).join(" · ") +
          " teilen sich einen Cooldown (" + esc(CDG[g] || "gemeinsam") +
          "). Mehr als einen davon zu nehmen bringt dir keine zusätzliche Uptime.</div>");
      }
    });

    // 5. Talente ohne passende Fähigkeit (häufigster stiller Fehler)
    ids.forEach(function (i) {
      if (CAT[i][1] !== 1) return;
      var refs = [];
      (REL[i][2] || []).forEach(function (j) { pushUniq(refs, j); });
      (MODOF[i] || []).forEach(function (j) { pushUniq(refs, j); });
      if (!refs.length) return;
      var anyHave = refs.some(function (j) { return haveInherited(have, j); });
      if (!anyHave) {
        var names = refs.slice(0, 3).map(function (j) { return esc(CAT[j][0]); }).join(", ");
        out.push('<div class="flag pre"><b>Wirkt nicht</b> — ' + esc(CAT[i][0]) +
          " verbessert " + names + ". Nichts davon steht in deinem Build " +
          "(auch keine Schulvariante, die deren Talente erbt).</div>");
      }
    });

    var dup = out.filter(function (s) { return s.indexOf("flag dup") > 0; }).length;
    var bad = out.filter(function (s) { return s.indexOf("flag pre") > 0; }).length;
    var good = out.filter(function (s) { return s.indexOf("flag syn") > 0; }).length;
    el.cF.textContent = ids.length ? (good + " Synergien · " + (dup + bad) + " Warnungen") : "—";
    el.cF.className = "cnt " + (bad + dup ? "over" : good ? "ok" : "");
    if (!out.length) {
      el.flags.innerHTML = '<div class="empty">' +
        (ids.length ? "Keine Auffälligkeiten." : "Wähle etwas aus.") + "</div>";
      return;
    }
    var warn = [], syn = [];
    out.forEach(function (s) {
      if (s.indexOf("flag syn") > 0) syn.push(s);
      else warn.push(s);
    });
    var synHead = syn.slice(0, 2);
    var synMore = syn.slice(2);
    el.flags.innerHTML = warn.concat(synHead).join("") +
      (synMore.length
        ? wrapDetails(synMore.join(""), "Weitere Synergien (" + synMore.length + ")")
        : "");
  }

  // ---------- Paths ----------
  // Tooltips wortgetreu aus dem Client uebernommen (Stand Season 10).
  // sp = Multiplikator auf Spell Power aus Items und Effekten.
  var PATHS = [
    {
      k: "str", n: "Path of Strength", sp: 1,
      core: "Gibt dir Strength obendrauf, und jeder Punkt Strength gibt dir " +
            "zusätzlich Attack Power und Parry.",
      oneH: "Devastating Strikes — Einhand: Armor Penetration +20 %.",
      twoH: "Heavy Swings — Zweihand: physische Melee- und Ranged-Fähigkeiten " +
            "machen 10 % mehr Schaden.",
      good: "Rein physische Waffen-Builds. Schwere Einzeltreffer, Plattenträger.",
      bad: "Kein Spell-Power-Multiplikator — Zauber in deinem Build skalieren " +
           "hier nur mit dem Rohwert."
    },
    {
      k: "agi", n: "Path of Agility", sp: 1,
      core: "Gibt dir Agility obendrauf, und jeder Punkt gibt dir Attack Power, " +
            "Crit-Chance und Crit-Schaden.",
      oneH: "Agile Strikes — Einhand: globaler Cooldown und Kosten deiner " +
            "Melee- und Ranged-Fähigkeiten −8 %.",
      twoH: "Fatal Wounds — Zweihand: kritischer Schadensbonus deiner " +
            "Melee- und Ranged-Fähigkeiten +20 %.",
      good: "Schnelle Waffen-Builds, die von Crit leben. Leder und Kette.",
      bad: "Wie Strength: kein Spell-Power-Multiplikator."
    },
    {
      k: "dua", n: "Path of Duality", sp: 1.75,
      core: "Attack Power in Höhe deines besseren Attributs — Strength oder Agility, " +
            "je nachdem, was höher ist. Spell Power aus Items und Effekten ×1,75. " +
            "Intellect gibt hier Melee-Crit, Agility gibt Spell-Crit. " +
            "Zaubern setzt deinen Autoangriff nicht mehr zurück.",
      oneH: "Twin Flurry — Einhand: Spell-, Ranged- und Melee-Haste +10 %.",
      twoH: "Unleashed Force — Zweihand: magischer <em>und</em> physischer Schaden +6 %.",
      good: "Alles, was Waffenschaden als Element austeilt. Der Path für Hybriden.",
      bad: "In einer reinen Rolle schlägt ihn der Spezialist: ×1,75 ist weniger als ×2."
    },
    {
      k: "int", n: "Path of Intelligence", sp: 2,
      core: "Gibt dir Spell Power, Intellect und Spirit obendrauf. Spell Power aus " +
            "Items und Effekten wird <strong>verdoppelt</strong>.",
      oneH: "Devastating Spells — Einhand: Zauberschaden +5 %.",
      twoH: "Magic Acceleration — Zweihand: Spell Haste +12 %.",
      good: "Zauberlastige Builds. Der stärkste Spell-Power-Multiplikator im Spiel.",
      bad: "Strength und Agility bekommen nichts dazu. Dein Melee-Crit bleibt auf " +
           "dem Rohwert deiner Agility."
    },
    {
      k: "heal", n: "Path of Healing", sp: 1,
      core: "Gibt dir Healing Power, Intellect und Spirit obendrauf. Jeder Punkt " +
            "Spell Power erhöht zusätzlich deine Healing Power.",
      oneH: "Empowered Mending — Einhand: Heilung +5 %.",
      twoH: "Spiritual Acceleration — Zweihand: Spell Haste +10 %, Spell-Crit +3 %.",
      good: "Die Heiler-Rolle. Ohne diesen Path gibt es keine echte Healing Power.",
      bad: "Der Schaden ist deutlich niedriger als auf jedem anderen Path."
    }
  ];
  var PATHBY = {};
  PATHS.forEach(function (p) { PATHBY[p.k] = p; });

  var T_WEAPON = 1, T_MAGIC = 2, T_HEAL = 4, T_PHYS = 8,
      T_CRIT = 256, T_ARPEN = 1024;

  var forcedPath = null;

  // Magieschule aus scaling.json — Physical zählt nicht als Duality-Hybrid.
  function isMagicSchool(name) {
    if (!name) return false;
    var n = String(name).toLowerCase();
    return n !== "physical" && n !== "phys" && n !== "pysical" && n !== "bleed";
  }

  // Ascension-*strike (Shadowstrike, Firestrike, …) = Waffe als Element.
  function isStrikeSchool(name) {
    return !!name && /strike$/i.test(String(name));
  }

  // Path-Flags: Tag-Bits plus scaling (Waffenschaden als Element).
  // „65% Shadowstrike weapon damage“ ist oft nur WEAPON getaggt — ohne sch/fsch
  // würde Duality unterzählen und Intelligence fälschlich gewinnen.
  function pathFlags(i) {
    var t = TAG[i] || 0;
    var sc = SC[i] || {};
    var school = sc.sch || sc.fsch || "";
    var isW = !!(t & T_WEAPON) || !!sc.w;
    var isM = !!(t & T_MAGIC);
    // TAG + SC: Waffen-% plus Magieschule → Duality-Hybrid (wm).
    if (sc.w && isMagicSchool(school)) isM = true;
    else if (!isM && !sc.w && isMagicSchool(sc.fsch || sc.sch)) isM = true;
    if (isStrikeSchool(school)) {
      isW = true;
      isM = true;
    }
    // Explizit Physical/Bleed + Waffen-% ist kein Hybrid — auch wenn der Tag
    // wegen einer Nebenklausel MAGIC trägt (Scourge Strike / Shadow-Rider).
    // Ohne gemessene Schule bleibt Tag-MAGIC: Frost Strike / Flameshred
    // haben „as Frost/Firestrike“ im Text, scaling zieht die Schule nicht immer.
    if (sc.w && school && !isMagicSchool(school)) isM = false;
    var isH = !!(t & T_HEAL) || !!sc.heal;
    // Heil-Hauptjob nur bei gemessener Tooltip-Heilung — nicht bei
    // „healing reduced“ / Bleed-Schnipseln, und nicht auf Waffen-Hybriden.
    var healPrimary = !!sc.heal && !sc.w && !(isW && isM);
    return {
      w: isW,
      m: isM,
      wm: isW && isM,
      h: isH,
      hPrimary: healPrimary,
      phys: !!(t & T_PHYS) || (!!sc.w && !isMagicSchool(school) && !isM),
      crit: !!(t & T_CRIT),
      // Crit-Gewicht nur für Waffen/Phys — Magie-Crit gehört nicht zu Agility.
      critMelee: !!(t & T_CRIT) && isW && !isM,
      arpen: !!(t & T_ARPEN)
    };
  }

  function profile(ids) {
    var p = {
      w: 0, m: 0, h: 0, hPrimary: 0, wm: 0,
      crit: 0, critMelee: 0, arpen: 0, phys: 0, n: ids.length,
      ssugStr: 0, ssugAgi: 0, ssugInt: 0, ssugHeal: 0
    };
    ids.forEach(function (i) {
      var f = pathFlags(i);
      if (f.w) p.w++;
      if (f.m) p.m++;
      if (f.wm) p.wm++;
      if (f.h) p.h++;
      if (f.hPrimary) p.hPrimary++;
      if (f.phys) p.phys++;
      if (f.crit) p.crit++;
      if (f.critMelee) p.critMelee++;
      if (f.arpen) p.arpen++;
      var lab = ssugPathLabel(i);
      if (lab === "Strength") p.ssugStr++;
      else if (lab === "Agility") p.ssugAgi++;
      else if (lab === "Intelligence") p.ssugInt++;
      else if (lab === "Healing") p.ssugHeal++;
    });
    p.pw = p.w - p.wm;
    p.pm = p.m - p.wm;
    return p;
  }

  // Punkte + Begruendung. Bewusst grob: der Builder kennt dein Gear nicht.
  // Alle fünf Paths: Hybride (wm) → Duality; reine Magie → Int; reine Waffe →
  // Str/Agi; echte Heiler → Healing. Nebenheilung und Magie-Crit dürfen nicht
  // den falschen Path gewinnen.
  function scorePaths(p) {
    var n = p.n || 1;
    var healV = p.hPrimary * 4 + Math.max(0, p.h - p.hPrimary);
    // Healing nur klar vorne, wenn Heilung der Schwerpunkt ist.
    if (p.hPrimary < 3 && p.hPrimary < n * 0.3) healV = Math.floor(healV * 0.45);

    var intV = p.pm * 3 + (p.pm ? 1 : 0);
    // Mit echtem Waffen-als-Element ist Duality die Heimat — Int dämpfen.
    if (p.wm >= 2) intV = Math.floor(intV * 0.5);
    else if (p.wm === 1) intV = Math.floor(intV * 0.75);

    var duaV = p.wm * 6 + Math.min(p.pw, p.pm) * 3;
    if (p.wm >= 2) duaV += 5;
    // Hybridkern: wm ist die größte Schublade — nicht schon bei einem Token-Hybrid.
    if (p.wm >= 1 && p.wm >= p.pw && p.wm >= p.pm) duaV += 2;

    // Physisch zählt für Strength und Agility gleich — ArPen vs. Waffen-Crit trennt.
    var strV = p.pw * 2 + p.arpen * 3 + p.phys;
    var agiV = p.pw * 2 + p.critMelee * 2 + p.phys;
    // Rein physisch ohne Hybrid: leichter Bonus vs. Duality-Nullscore.
    if (p.wm === 0 && p.pw >= 3 && p.pm === 0) {
      strV += 2;
      agiV += 2;
    }

    // SpellStatSuggestions: weicher Hinweis (max +2), kein Override bei Hybridkern.
    function ssugHint(n) { return Math.min(n || 0, 2); }
    if (p.wm < 2) intV += ssugHint(p.ssugInt);
    healV += ssugHint(p.ssugHeal);
    strV += ssugHint(p.ssugStr);
    agiV += ssugHint(p.ssugAgi);

    var s = [
      {
        k: "heal", v: healV,
        why: p.hPrimary
          ? p.hPrimary + (p.hPrimary === 1 ? " klarer Heilzauber" : " klare Heilzauber") +
            " im Build"
          : (p.h ? "nur Nebenheilung — kein Heiler-Schwerpunkt"
                 : "nichts Heilendes gewählt")
      },
      {
        k: "int", v: intV,
        why: p.pm
          ? p.pm + (p.pm === 1 ? " reiner Zauber" : " reine Zauber") +
            " ohne Waffenanteil" +
            (p.wm ? " (Hybridanteil dämpft Intelligence)" : "")
          : "keine reinen Zauber"
      },
      {
        k: "dua", v: duaV,
        why: p.wm
          ? p.wm + "× Waffenschaden als Element — genau der Fall, für den es " +
            "den Path gibt"
          : (Math.min(p.pw, p.pm)
            ? "physische und magische Anteile gemischt"
            : "kein Hybridanteil")
      },
      {
        k: "str", v: strV,
        why: p.arpen
          ? p.arpen + "× Armor Penetration im Build"
          : (p.pw
            ? p.pw + (p.pw === 1 ? " rein physischer Waffenangriff"
                                 : " rein physische Waffenangriffe")
            : "keine reinen Waffenangriffe")
      },
      {
        k: "agi", v: agiV,
        why: p.critMelee
          ? p.critMelee + (p.critMelee === 1 ? " Waffen-Eintrag mit Crit-Fokus"
                                            : " Waffen-Einträge mit Crit-Fokus")
          : (p.pw
            ? p.pw + (p.pw === 1 ? " rein physischer Waffenangriff"
                                 : " rein physische Waffenangriffe")
            : "keine reinen Waffenangriffe")
      }
    ];
    s.sort(function (a, b) { return b.v - a.v || a.k.localeCompare(b.k); });
    return s;
  }

  // Leerzustand: eine Zeile sichtbar, Erklärung zugeklappt.
  function emptyState(line, moreHtml, moreLabel) {
    return '<div class="empty">' + line + "</div>" +
      (moreHtml ? wrapDetails(moreHtml, moreLabel || "Mehr dazu") : "");
  }
  function emptyHint(line, moreHtml, moreLabel) {
    return '<div class="qhint">' + line + "</div>" +
      (moreHtml ? wrapDetails(moreHtml, moreLabel || "Mehr dazu") : "");
  }

  function renderPaths(ids) {
    var box = document.getElementById("paths");
    var hd = document.getElementById("cP");
    if (!ids.length) {
      hd.textContent = "—"; hd.className = "cnt";
      box.innerHTML = emptyState(
        "Wähle Fähigkeiten.",
        "<p>Dann kommt hier die Path-Empfehlung mit Begründung.</p>");
      return;
    }
    var p = profile(ids);
    var sc = scorePaths(p);
    var top = forcedPath || sc[0].k;
    var P = PATHBY[top];
    var auto = sc[0].k;

    hd.textContent = P.n.replace("Path of ", "");
    hd.className = "cnt ok";

    var o = [];

    o.push('<div class="pathpick">' +
      '<div class="pathname">' + esc(P.n) + (forcedPath && forcedPath !== auto ?
        ' <span class="tagm">manuell gesetzt</span>' :
        ' <span class="tagm">empfohlen</span>') + "</div>" +
      '<p class="fit"><strong>Passt, weil:</strong> ' + esc(sc.filter(function (x) {
        return x.k === top; })[0].why) + ". " + esc(P.good) + "</p>" +
      "</div>");
    o.push(wrapDetails(
      "<p>" + P.core + "</p>" +
      '<p class="fit warnline"><strong>Der Haken:</strong> ' + esc(P.bad) + "</p>" +
      '<div class="wpn"><div><b>Mit Einhandwaffe</b>' + P.oneH + "</div>" +
      "<div><b>Mit Zweihandwaffe</b>" + P.twoH + "</div></div>",
      "Path im Detail"));

    // Rangliste
    o.push('<div class="ranklist">');
    sc.forEach(function (x, n) {
      var q = PATHBY[x.k];
      o.push('<button class="prow' + (x.k === top ? " on" : "") + '" data-path="' +
        x.k + '"><span class="rk">' + (n + 1) + "</span>" +
        '<span class="pn">' + esc(q.n.replace("Path of ", "")) + "</span>" +
        '<span class="pw">' + (q.sp > 1 ? "SP ×" + String(q.sp).replace(".", ",") : "SP ×1") +
        "</span>" +
        '<span class="pv">' + x.v + " Pkt</span>" +
        '<span class="pwhy">' + esc(x.why) + "</span></button>");
    });
    o.push("</div>");

    // Was der Path konkret mit deiner Auswahl macht
    var notes = pathNotes(ids, P, p);
    if (notes.length) {
      var noteHead = notes.slice(0, 1);
      var noteMore = notes.slice(1);
      o.push('<div class="pnotes"><b>Was ' + esc(P.n) + " mit deiner Auswahl macht</b>" +
        noteHead.join("") + "</div>");
      if (noteMore.length) {
        o.push(wrapDetails(noteMore.join(""),
          "Weitere Path-Hinweise (" + noteMore.length + ")"));
      }
    }
    // SpellStatSuggestions-Path-Codes im Build (DBC 0/1/3/4 → Namen, nicht PrimaryStat-IDs)
    if (SSUG && SSUG.path) {
      var sugCount = {};
      ids.forEach(function (i) {
        var lab = ssugPathLabel(i);
        if (lab) sugCount[lab] = (sugCount[lab] || 0) + 1;
      });
      var sugKeys = Object.keys(sugCount);
      if (sugKeys.length) {
        o.push('<div class="wepline"><b>DBC-Path-Codes</b> ' +
          sugKeys.map(function (k) {
            return esc(k) + " ×" + sugCount[k];
          }).join(" · ") +
          ' <span class="gid" title="SpellStatSuggestions: Codes 0/1/3/4 = Strength/Agility/Intelligence/Healing — nur Hinweis, kein Override bei Waffenschaden-als-Element">(Hinweis, kein Override)</span></div>');
      }
    }
    box.innerHTML = o.join("");
  }

  // Konkrete, benannte Skalierungsaussagen statt Allgemeinplaetze.
  function pathNotes(ids, P, p) {
    var out = [], shown = 0, MAX = 6;
    var wm = [], pm = [], pw = [], hl = [];
    ids.forEach(function (i) {
      var f = pathFlags(i);
      if (f.wm) wm.push(i);
      else if (f.m) pm.push(i);
      else if (f.w) pw.push(i);
      if (f.hPrimary) hl.push(i);
    });
    function nm(list, k) {
      return list.slice(0, k).map(function (i) { return "<b>" + esc(CAT[i][0]) + "</b>"; })
        .join(", ") + (list.length > k ? " (+" + (list.length - k) + " weitere)" : "");
    }

    if (wm.length) {
      shown++;
      if (P.sp > 1) {
        out.push('<div class="pn-row good">' + nm(wm, 3) +
          " teilen Waffenschaden als Element aus. Auf " + esc(P.n) +
          " zählt deine Spell Power aus Items " + (P.sp === 2 ? "doppelt" : "1,75-fach") +
          " — und weil 14 Spell Power = 1 Waffen-DPS sind, landet dieser Bonus " +
          "<em>voll im Waffenanteil</em>. Der Elementanteil ignoriert obendrein Rüstung." +
          "</div>");
      } else {
        out.push('<div class="pn-row warn">' + nm(wm, 3) +
          " teilen Waffenschaden als Element aus. " + esc(P.n) +
          " gibt dir keinen Spell-Power-Multiplikator — der Elementanteil bleibt auf " +
          "dem Rohwert deiner Items. Path of Duality würde hier ×1,75 draufgeben." +
          "</div>");
      }
    }
    if (pm.length && shown < MAX) {
      shown++;
      if (P.k === "int") {
        out.push('<div class="pn-row good">' + nm(pm, 3) +
          " sind reine Zauber. Spell Power ×2 ist der stärkste Multiplikator im Spiel — " +
          "hier holst du das Maximum raus.</div>");
      } else if (P.sp > 1) {
        out.push('<div class="pn-row good">' + nm(pm, 3) +
          " sind reine Zauber und bekommen ×" + String(P.sp).replace(".", ",") +
          " Spell Power. Solide, aber Path of Intelligence gäbe ×2.</div>");
      } else {
        out.push('<div class="pn-row warn">' + nm(pm, 3) +
          " sind reine Zauber ohne jeden Multiplikator auf diesem Path. " +
          "Das sind " + pm.length + " von " + p.n + " Plätzen, die kaum skalieren." +
          "</div>");
      }
    }
    if (pw.length && shown < MAX) {
      shown++;
      if (P.k === "str" || P.k === "agi") {
        out.push('<div class="pn-row good">' + nm(pw, 3) +
          " sind rein physisch. " + esc(P.n) + " pumpt genau das: Bonus auf dein " +
          "Primärattribut, das jeder Punkt in Attack Power weiterreicht.</div>");
      } else if (P.k === "dua") {
        out.push('<div class="pn-row good">' + nm(pw, 3) +
          " sind rein physisch. Duality gibt dir Attack Power in Höhe deines " +
          "besseren Attributs — du verlierst hier also nichts.</div>");
      } else {
        out.push('<div class="pn-row warn">' + nm(pw, 3) +
          " sind rein physisch und ziehen ihren Schaden aus Attack Power. " +
          esc(P.n) + " gibt dir weder Strength noch Agility dazu. Diese Angriffe " +
          "werden nur noch besser, wenn du eine bessere Waffe findest.</div>");
      }
    }
    if (hl.length && shown < MAX) {
      shown++;
      if (P.k === "heal") {
        out.push('<div class="pn-row good">' + nm(hl, 3) +
          " heilen. Nur auf diesem Path wird deine Spell Power zusätzlich in " +
          "Healing Power übersetzt.</div>");
      } else if (hl.length >= 3) {
        out.push('<div class="pn-row warn">' + nm(hl, 3) +
          " heilen. Auf " + esc(P.n) + " wird deine Spell Power aber nicht in " +
          "Healing Power umgerechnet. Bei " + hl.length +
          " heilenden Einträgen lohnt der Blick auf Path of Healing.</div>");
      }
    }
    if (p.crit && (P.k === "int") && p.pw + p.wm > 0 && shown < MAX) {
      out.push('<div class="pn-row warn">Dein Build schlägt mit der Waffe zu, aber ' +
        "Intellect gibt dir <em>keinen</em> Melee-Crit. Genau diese Trennung hebt " +
        "<b>Path of Duality</b> auf: dort gibt Intellect Melee-Crit und " +
        "Agility Spell-Crit.</div>");
    }
    // SpellStatSuggestions Intelligence ↔ Magie: Path-Hinweis, kein Coeff erfinden
    if (SSUG && SSUG.path && shown < MAX) {
      var intSug = [], magGap = [];
      ids.forEach(function (i) {
        if (ssugPathLabel(i) === "Intelligence") intSug.push(i);
        var f = pathFlags(i), s = SC[i] || {};
        if (f.m && !f.w && !(s.sp || s.spb)) magGap.push(i);
      });
      if (intSug.length) {
        shown++;
        if (P.k === "int") {
          out.push('<div class="pn-row good">SpellStatSuggestions markiert ' +
            nm(intSug, 3) + " mit „Intelligence“. Path of Intelligence " +
            "passt dazu (Item-SP ×2) — das ist kein Tooltip-Koeffizient, " +
            "nur der DBC-Path-Code.</div>");
        } else if (P.k === "dua" && p.wm >= 2) {
          out.push('<div class="pn-row">SpellStatSuggestions markiert ' +
            nm(intSug, 3) + " mit „Intelligence“. Das ist nur ein DBC-Hinweis — " +
            "bei " + p.wm + "× Waffenschaden als Element bleibt Duality die Heimat, " +
            "Intelligence würde die Hybride unterzählen.</div>");
        } else {
          out.push('<div class="pn-row warn">SpellStatSuggestions markiert ' +
            nm(intSug, 3) + " mit „Intelligence“. Auf " + esc(P.n) +
            " fehlt der ×2-SP-Multiplikator; Path of Intelligence wäre der " +
            "DBC-Hinweis — ohne dass wir fehlende Tooltip-% erfinden." +
            (magGap.length
              ? " " + magGap.length + " Magie-Einträge ohne SP-% bleiben Lücken."
              : "") +
            "</div>");
        }
      }
    }
    return out;
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-path]");
    if (!b) return;
    var k = b.dataset.path;
    forcedPath = (forcedPath === k) ? null : k;
    renderPaths(Object.keys(picked).map(Number));
  });

  // ---------- Import aus dem Spiel ----------
  // Gegenstueck zum Companion-Addon (/bs). Der Text kommt zeilenweise,
  // jede Zeile faengt mit einem Schluesselwort an. Absichtlich nachsichtig
  // geparst: unbekannte Zeilen werden ignoriert, statt alles abzulehnen.

  var CHAR = null;          // zuletzt importierter Charakter
  var UNMATCHED = [];       // Namen aus dem Spiel, die im Katalog fehlen

  // Namensindex ueber den Katalog, einmalig.
  var BYNAME = {};
  CAT.forEach(function (r, i) {
    var k = r[0].toLowerCase();
    if (BYNAME[k] === undefined) BYNAME[k] = i;
  });

  // ABI: Name[#spellId][@entryId]  TAL: Name:rank[#spellId][@entryId]
  // Reihenfolge der Suffixe ist fest (# vor @); alte Name-only Exporte bleiben ok.
  function stripIds(raw) {
    var s = String(raw || ""), eid = 0, id = 0;
    var at = s.lastIndexOf("@");
    if (at > 0) {
      eid = parseInt(s.slice(at + 1), 10) || 0;
      s = s.slice(0, at);
    }
    var hash = s.lastIndexOf("#");
    if (hash > 0) {
      id = parseInt(s.slice(hash + 1), 10) || 0;
      s = s.slice(0, hash);
    }
    return { body: s, id: id, eid: eid };
  }

  function parseAbiToken(t) {
    var x = stripIds(t);
    return { n: x.body, id: x.id || null, eid: x.eid || null };
  }

  function parseTalToken(t) {
    var x = stripIds(t), body = x.body, r = 1, n = body;
    var i = body.lastIndexOf(":");
    if (i > 0) {
      n = body.slice(0, i);
      r = +body.slice(i + 1) || 1;
    }
    return { n: n, r: r, id: x.id || null, eid: x.eid || null };
  }

  // Season10-Stil: entryId vor spellId vor Name — loest Vengeance & Co.
  // Live-Export-IDs koennen vom Katalog abweichen: eid/sid nur akzeptieren,
  // wenn der Name passt (exakt oder Client-Kurzform „Presence“ ⊂ „Blood Presence“).
  // Sonst wuerde z. B. eine fremde entryId still den falschen Katalogeintrag waehlen.
  function namesCompatible(exportName, catalogName) {
    var a = String(exportName || "").toLowerCase().trim();
    var b = String(catalogName || "").toLowerCase().trim();
    if (!a) return true;
    if (!b) return false;
    if (a === b) return true;
    // Wortgrenze: „Presence“ ↔ „Blood Presence“, nicht „Aura“ ↔ beliebige Aura.
    if (a.length >= 4 && (b.length > a.length ? b.slice(-(a.length + 1)) === " " + a
                                              : a.slice(-(b.length + 1)) === " " + b)) {
      return true;
    }
    return false;
  }

  function resolveTok(tok) {
    if (tok.eid && BYEID[tok.eid] !== undefined) {
      var ie = BYEID[tok.eid];
      if (namesCompatible(tok.n, CAT[ie][0])) return { i: ie, how: "eid" };
    }
    if (tok.id && BYSID[tok.id] !== undefined) {
      var isid = BYSID[tok.id];
      if (namesCompatible(tok.n, CAT[isid][0])) return { i: isid, how: "sid" };
    }
    var i = BYNAME[String(tok.n || "").toLowerCase().trim()];
    if (i !== undefined) return { i: i, how: "name" };
    return null;
  }

  // Additive Item-Link-Felder ab Index `from`: itemId[|ench|g1|g2|g3|g4]
  function parseLinkTail(parts, from) {
    var out = { itemId: +parts[from] || 0 };
    if (parts.length > from + 1) {
      out.ench = +parts[from + 1] || 0;
      out.gems = [
        +parts[from + 2] || 0, +parts[from + 3] || 0,
        +parts[from + 4] || 0, +parts[from + 5] || 0
      ];
    }
    return out;
  }

  function parseExport(text) {
    var d = { stats: {}, gear: [], weapons: [], abi: [], tal: [], resist: {} };
    var seen = false;
    String(text || "").split(/\r?\n/).forEach(function (raw) {
      var line = raw.trim();
      if (!line) return;
      var parts = line.split("|");
      var key = parts.shift().trim().toUpperCase();
      switch (key) {
        case "CHAR":
          seen = true;
          d.name = parts[0]; d.level = +parts[1] || 0;
          d.race = parts[2]; d.cls = parts[3];
          // Additive optionale Felder (Addon darf spaeter mehr anhaengen).
          if (parts[4]) d.gender = parts[4];
          if (parts[5]) d.realm = parts[5];
          break;
        case "ADDON":
          d.addon = (parts[0] || "").trim();
          break;
        case "PATH":
          seen = true;
          d.path = (parts[0] || "").trim();
          break;
        case "SPEC":
          // SPEC|id|name|CHR:n — CHR additiv ab 1.5.1
          d.spec = +parts[0] || 0;
          d.specName = (parts[1] || "").trim();
          parts.slice(2).forEach(function (p) {
            var m = String(p || "").split(":");
            var k = (m[0] || "").toUpperCase();
            if (k === "CHR") d.chrSpec = +m[1] || 0;
          });
          break;
        case "SPECS":
          // Freigeschaltete Specs (Inspect): SPECS|1;2;3
          d.specs = (parts[0] || "").split(";").map(function (x) {
            return parseInt(x, 10) || 0;
          }).filter(Boolean);
          break;
        case "MODE":
          // MODE|WILDCARD|DRAFT|… — mehrere Tags; mode bleibt erstes Tag
          d.modes = parts.map(function (p) {
            return String(p || "").trim().toUpperCase();
          }).filter(Boolean);
          d.mode = d.modes[0] || "";
          d.draft = d.modes.indexOf("DRAFT") >= 0 ||
            d.modes.indexOf("BUILDDRAFT") >= 0;
          break;
        case "LOCK":
        case "LOCKED":
          d.locked = (parts.join("|") || "").split(";").map(function (x) {
            return parseInt(x, 10) || 0;
          }).filter(Boolean);
          break;
        case "ESSENCE":
          // ESSENCE|A:rem|T:rem|AS:spent|TS:spent
          parts.forEach(function (p) {
            var m = p.split(":");
            var k = (m[0] || "").toUpperCase();
            var v = +m[1] || 0;
            if (k === "A") d.essA = v;
            else if (k === "T") d.essT = v;
            else if (k === "AS") d.essASpent = v;
            else if (k === "TS") d.essTSpent = v;
            else if (k === "AX") d.essAExpect = v;
            else if (k === "TX") d.essTExpect = v;
          });
          break;
        case "SPENT":
          parts.forEach(function (p) {
            var m = p.split(":");
            var k = (m[0] || "").toUpperCase();
            var v = +m[1] || 0;
            if (k === "A" || k === "AE" || k === "AS") d.essASpent = v;
            if (k === "T" || k === "TE" || k === "TS") d.essTSpent = v;
          });
          break;
        case "RESIST":
          parts.forEach(function (p) {
            var m = p.split(":");
            if (m.length === 2 && m[0]) d.resist[m[0].toUpperCase()] = parseFloat(m[1]);
          });
          break;
        case "STAT":
          parts.forEach(function (p) {
            var m = p.split(":");
            if (m.length === 2) d.stats[m[0].toUpperCase()] = parseFloat(m[1]);
          });
          break;
        case "WEAPON":
          // WEAPON|tag|name|ilvlN|speedN|lo-hi|dpsN|loc|sub|itemId[|ench|g1|g2|g3|g4]
          d.weapons.push(Object.assign({
            slot: parts[0], name: parts[1],
            ilvl: +(parts[2] || "").replace("ilvl", "") || 0,
            speed: parseFloat((parts[3] || "").replace("speed", "")) || 0,
            dmg: parts[4] || "",
            dps: parseFloat((parts[5] || "").replace("dps", "")) || 0,
            loc: parts[6] || "", sub: parts[7] || ""
          }, parseLinkTail(parts, 8)));
          break;
        case "ILVL":
          d.ilvl = parseFloat(parts[0]) || 0;
          break;
        case "GEAR":
          // GEAR|Slot|Name|ilvl|quality|subtype|itemId[|ench|g1|g2|g3|g4]
          d.gear.push(Object.assign({
            slot: parts[0], name: parts[1], ilvl: +parts[2] || 0,
            q: +parts[3] || 0, sub: parts[4] || ""
          }, parseLinkTail(parts, 5)));
          break;
        case "ECOST":
          // ECOST|sid:a:t;… — Essence-Kosten pro Spell, nur gemessene Werte
          d.ecost = d.ecost || {};
          (parts.join("|") || "").split(";").filter(Boolean).forEach(function (p) {
            var m = p.split(":");
            var sid = +m[0] || 0;
            if (sid) d.ecost[sid] = { a: +m[1] || 0, t: +m[2] || 0 };
          });
          break;
        case "MAST":
          d.mast = (parts.join("|") || "").split(";").map(function (x) {
            return parseInt(x, 10) || 0;
          }).filter(Boolean);
          break;
        case "INVEST":
          // INVEST|AE:n|TE:n|CP:n|TAB:class:spec:n|…  (TAB auch per ;)
          d.invest = d.invest || {};
          parts.forEach(function (p) {
            String(p || "").split(";").filter(Boolean).forEach(function (chunk) {
              var m = chunk.split(":");
              var k = (m[0] || "").toUpperCase();
              if (k === "TAB" && m.length >= 4) {
                d.investTabs = d.investTabs || [];
                d.investTabs.push({
                  cls: +m[1] || 0, spec: +m[2] || 0, n: +m[3] || 0
                });
              } else if (k) {
                d.invest[k] = +m[1] || 0;
              }
            });
          });
          break;
        case "SCARD":
          // SCARD|TAG:cardId@index;… optional :qN / :A / :sSPELLID (Deck=tag)
          d.scard = [];
          (parts.join("|") || "").split(";").filter(Boolean).forEach(function (tok) {
            var m = String(tok).match(/^([^:]+):([^@]+)@(\d+)(.*)$/);
            if (!m) return;
            var blocked = m[2] === "B";
            var rest = m[4] || "";
            var qm = rest.match(/:q(\d+)/i);
            var sm = rest.match(/:s(\d+)/i);
            var entry = {
              tag: m[1],
              cardId: blocked ? 0 : (+m[2] || 0),
              blocked: blocked,
              index: +m[3] || 0,
              active: /:A(?:$|:)/i.test(rest)
            };
            if (qm) entry.q = +qm[1] || 0;
            if (sm) entry.sid = +sm[1] || 0;
            d.scard.push(entry);
          });
          break;
        case "SCARDPEND":
          d.scardPend = +parts[0] || 0;
          break;
        case "WC":
          // WC|CanRoll:0/1|…|RRAbi:cur/req/next|RRTal:…|RepurchAbi:n|CanRepurch:0/1
          d.wc = d.wc || {};
          parts.forEach(function (p) {
            var m = String(p || "").split(":");
            var k = (m[0] || "").trim();
            if (!k) return;
            var v = m.slice(1).join(":");
            if ((k === "RRAbi" || k === "RRTal") && v.indexOf("/") >= 0) {
              var bp = v.split("/");
              d.wc[k] = {
                cur: +bp[0] || 0,
                req: +bp[1] || 0,
                next: +bp[2] || 0,
                raw: v
              };
            } else if (v === "0" || v === "1") {
              d.wc[k] = +v;
            } else if (v !== "" && !isNaN(+v)) {
              d.wc[k] = +v;
            } else if (v) {
              d.wc[k] = v;
            }
          });
          break;
        case "PATHINFO":
          // PATHINFO|spellId|icon|name
          if (parts[0]) {
            d.pathInfo = {
              spellId: +parts[0] || 0,
              icon: (parts[1] || "").trim(),
              name: (parts[2] || "").trim()
            };
          }
          break;
        case "PATHENTRY":
          // PATHENTRY|entryId — PrimaryStat CA-Internal-ID
          d.pathEntry = +parts[0] || 0;
          break;
        case "TRAIT":
          d.trait = (parts.join("|") || "").split(";").map(function (x) {
            return parseInt(x, 10) || 0;
          }).filter(Boolean);
          break;
        case "STARTCHOICE":
          d.startChoice = (parts.join("|") || "").split(";").map(function (x) {
            return parseInt(x, 10) || 0;
          }).filter(Boolean);
          break;
        case "SUGGEST":
          // SUGGEST|Path;Path — grosszuegig: ; | , und Key:Wert
          d.suggest = d.suggest || [];
          String(parts.join("|") || "").split(/[|;,]/).forEach(function (tok) {
            var p = String(tok || "").trim();
            if (!p) return;
            var labeled = p.match(/^(?:STAT|PATH|S)[:=](.+)$/i);
            if (labeled) p = labeled[1].trim();
            else if (p.indexOf(":") > 0) {
              var left = p.split(":")[0].trim();
              if (left && isNaN(+left)) p = left;
            }
            if (p && d.suggest.indexOf(p) < 0) d.suggest.push(p);
          });
          break;
        case "CARDED":
        case "CARD":
          // CARDED|sid;sid — Alias CARD|…; auch :/, als Trenner (OCR/ältere Exporte)
          d.carded = String(parts.join("|") || "")
            .split(/[|;,\s]+/)
            .map(function (x) { return parseInt(x, 10) || 0; })
            .filter(Boolean);
          break;
        case "DESIRE":
        case "DESIRED":
          // DESIRE|entryId;… — persoenliche Wishlist (IsDesiredID), NICHT D.des
          d.desire = (parts.join("|") || "").split(";").map(function (x) {
            return parseInt(x, 10) || 0;
          }).filter(Boolean);
          break;
        case "UNDESIRE":
        case "UNDESIRED":
          // UNDESIRE|entryId;… — IsUndesiredID, nicht Catalog desiredEligible
          d.undesire = (parts.join("|") || "").split(";").map(function (x) {
            return parseInt(x, 10) || 0;
          }).filter(Boolean);
          break;
        case "PATHAURA":
          // PATHAURA|spellId  (ggf. mehrere mit ;)
          d.pathAura = (parts.join("|") || "").split(";").map(function (x) {
            return parseInt(x, 10) || 0;
          }).filter(Boolean);
          break;
        case "ABI":
          seen = true;
          d.abi = (parts[0] || "").split(";").filter(Boolean).map(parseAbiToken);
          break;
        case "TAL":
          seen = true;
          d.tal = (parts[0] || "").split(";").filter(Boolean).map(parseTalToken);
          break;
        case "QUALITY":
          d.qlimit = d.qlimit || {}; d.qused = d.qused || {};
          parts.forEach(function (p) {
            var m = p.split(":");
            var q = QUAL_KEY[(m[0] || "").toLowerCase()];
            var v = String(m[1] || "").split("/");
            if (q) {
              d.qused[q] = +v[0] || 0;
              d.qlimit[q] = +v[1] || 0;
            }
          });
          break;
        case "QCOST":
          d.qcost = d.qcost || {};
          parts.forEach(function (p) {
            var m = p.split(":");
            var q = QUAL_KEY[(m[0] || "").toLowerCase()];
            // Eine Spanne wie "1-2" heisst: nicht einheitlich, also nicht
            // hochrechnen. Dann lieber gar keinen Wert setzen.
            if (q && String(m[1]).indexOf("-") < 0) d.qcost[q] = +m[1] || 0;
          });
          break;
        case "QOWN":
          d.qown = d.qown || {};
          (parts[0] || "").split(";").filter(Boolean).forEach(function (p) {
            var m = p.split(":");
            var sid = +m[0] || 0;
            if (sid) d.qown[sid] = { q: +m[1] || 0, cost: +m[2] || 0 };
          });
          break;
        case "COUNT":
          parts.forEach(function (p) {
            var m = p.split(":");
            if (m[0] === "A") d.countA = +m[1] || 0;
            if (m[0] === "T") d.countT = +m[1] || 0;
          });
          break;
        case "INSPECT":
          d.inspect = true;
          break;
        case "CODE":
          d.code = parts[0];
          break;
        default:
          break;
      }
    });
    return seen ? d : null;
  }

  function applyImport(d) {
    picked = Object.create(null);
    UNMATCHED = [];
    var hit = 0, byId = 0;
    function take(tok) {
      var r = resolveTok(tok);
      if (!r) {
        UNMATCHED.push(tok.n || "?");
        return;
      }
      picked[r.i] = true;
      hit++;
      if (r.how !== "name") byId++;
    }
    (d.abi || []).forEach(function (t) {
      take(typeof t === "string" ? parseAbiToken(t) : t);
    });
    (d.tal || []).forEach(function (t) {
      take(typeof t === "string" ? parseTalToken(t) : t);
    });
    CHAR = d;
    CHAR._idMatched = byId;
    enrichScardSids(CHAR);
    CHAR._cardedSet = Object.create(null);
    (CHAR.carded || []).forEach(function (sid) { CHAR._cardedSet[sid] = 1; });
    // SCARD :sSPELLID / zugeordnete CARDED — Slots zählen als carded
    (CHAR.scard || []).forEach(function (s) {
      if (s && s.sid) CHAR._cardedSet[s.sid] = 1;
    });
    CHAR._lockedSet = Object.create(null);
    (CHAR.locked || []).forEach(function (eid) { CHAR._lockedSet[eid] = 1; });
    CHAR._desireSet = Object.create(null);
    (CHAR.desire || []).forEach(function (eid) { CHAR._desireSet[eid] = 1; });
    CHAR._undesireSet = Object.create(null);
    (CHAR.undesire || []).forEach(function (eid) { CHAR._undesireSet[eid] = 1; });
    return hit;
  }

  function isCardedIdx(i) {
    var sid = SID[i];
    return !!(CHAR && CHAR._cardedSet && sid && CHAR._cardedSet[sid]);
  }
  function isLockedIdx(i) {
    var eid = EID[i];
    return !!(CHAR && CHAR._lockedSet && eid && CHAR._lockedSet[eid]);
  }
  function isDesiredIdx(i) {
    var eid = EID[i];
    return !!(CHAR && CHAR._desireSet && eid && CHAR._desireSet[eid]);
  }
  function isUndesiredIdx(i) {
    var eid = EID[i];
    return !!(CHAR && CHAR._undesireSet && eid && CHAR._undesireSet[eid]);
  }
  function hasMode(c, tag) {
    if (!c || !tag) return false;
    tag = String(tag).toUpperCase();
    if (c.modes && c.modes.length) return c.modes.indexOf(tag) >= 0;
    var m = String(c.mode || "").toUpperCase();
    if (!m) return false;
    if (m === tag) return true;
    return m.split("|").indexOf(tag) >= 0;
  }
  function isDraftChar(c) {
    return !!(c && (c.draft || hasMode(c, "DRAFT") || hasMode(c, "BUILDDRAFT")));
  }
  function modeLabel(c) {
    if (!c) return "";
    if (c.modes && c.modes.length) return c.modes.join(" · ");
    return c.mode || "";
  }

  function nameByEid(eid) {
    var i = BYEID[eid];
    return i !== undefined ? CAT[i][0] : ("entry " + eid);
  }
  function nameBySid(sid) {
    var i = BYSID[sid];
    return i !== undefined ? CAT[i][0] : ("spell " + sid);
  }
  // SCARD-Tag DEFAULT_NORMAL → { deck: "Standard", kind: "Normal" }
  function scardDeckParts(tag) {
    var t = String(tag || "").toUpperCase().split("_");
    var decks = {
      DEFAULT: "Standard", STARTER: "Starter",
      LUCKY: "Glück", TALENT: "Talent"
    };
    var kinds = { NORMAL: "Normal", GOLDEN: "Golden" };
    return {
      deck: decks[t[0]] || (t[0] || "Karte"),
      kind: kinds[t[1]] || (t[1] || "")
    };
  }

  // Fehlende SCARD-:sSPELLID aus CARDED füllen.
  // cardId ist keine Spell-/Entry-ID — ein Katalogtreffer wäre Zufall
  // und lässt die echten CARDED-Spells als zweite „Auf Karten“-Wand stehen.
  function enrichScardSids(c) {
    if (!c || !c.scard || !c.scard.length) return;
    var used = Object.create(null);
    function takeSid(s, sid, how) {
      sid = +sid || 0;
      if (!s || !sid || used[sid]) return false;
      s.sid = sid;
      if (how) s._sidHow = how;
      used[sid] = 1;
      return true;
    }
    c.scard.forEach(function (s) {
      if (!s || s.blocked) return;
      if (s.sid) used[s.sid] = 1;
    });
    var pool = (c.carded || []).filter(function (sid) {
      return sid && !used[sid];
    });
    pool.sort(function (a, b) {
      var an = BYSID[a] !== undefined ? 0 : 1;
      var bn = BYSID[b] !== undefined ? 0 : 1;
      return an - bn;
    });
    if (!pool.length) return;
    var pi = 0;
    c.scard.slice().sort(function (a, b) {
      return ((a && a.index) || 0) - ((b && b.index) || 0);
    }).forEach(function (s) {
      if (!s || s.blocked || s.sid || pi >= pool.length) return;
      takeSid(s, pool[pi++], "carded");
    });
  }

  function scardIco(catIdx, size) {
    size = size || 32;
    if (catIdx === undefined) {
      return '<span class="scico scico-empty" aria-hidden="true"></span>';
    }
    return '<span class="icon scico" style="width:' + size + "px;height:" +
      size + "px;flex:0 0 " + size + "px;" + iconStyle(catIdx, size) +
      '"></span>';
  }

  // Ein Raster: Slots mit Name/Icon. „Auf Karten“ nur für Reste, nicht doppelt.
  function skillCardsHtml(c) {
    if (!c) return "";
    enrichScardSids(c);
    var o = [];
    var nNamed = 0;
    if (c.scard && c.scard.length) {
      var filled = c.scard.filter(function (s) { return !s.blocked; }).length;
      var blocked = c.scard.length - filled;
      var nActive = c.scard.filter(function (s) { return s.active; }).length;
      nNamed = c.scard.filter(function (s) {
        return s.sid && BYSID[s.sid] !== undefined;
      }).length;
      o.push('<div class="wepline"><b>Skill Cards</b> ' + filled + " belegt" +
        (blocked ? ", " + blocked + " blockiert" : "") +
        (nActive ? ", " + nActive + " aktiv" : "") + "</div>");
      o.push('<div class="scardgrid" role="list">');
      c.scard.forEach(function (s) {
        var parts = scardDeckParts(s.tag);
        var tone = s.q !== undefined ? gearQTone(s.q)
          : (parts.kind === "Golden" ? 3 : null);
        var cls = "scard" + (s.blocked ? " blocked" : "") +
          (s.active ? " active" : "") +
          (tone !== null ? " q" + tone : "");
        var metaBits = [];
        if (parts.deck) metaBits.push(parts.deck);
        if (parts.kind && parts.kind !== "Normal") metaBits.push(parts.kind);
        if (s.active) metaBits.push("aktiv");
        if (s.blocked) metaBits.push("blockiert");
        var sid = s.sid || 0;
        var catIdx = sid ? BYSID[sid] : undefined;
        var title, icoHtml;
        if (s.blocked) {
          title = "Leer";
          icoHtml = scardIco();
        } else if (sid && catIdx !== undefined) {
          title = CAT[catIdx][0];
          icoHtml = scardIco(catIdx, 32);
        } else if (sid) {
          var nm = nameBySid(sid);
          title = (nm && nm.indexOf("spell ") !== 0) ? nm : ("Spell #" + sid);
          icoHtml = scardIco();
        } else {
          title = s.cardId ? ("Karte #" + s.cardId) : "Unbekannt";
          icoHtml = scardIco();
        }
        var tip = [parts.deck, parts.kind,
          s.cardId ? "card #" + s.cardId : "",
          sid ? "spell #" + sid : ""].filter(Boolean).join(" · ");
        o.push('<div class="' + cls + '" role="listitem"' +
          (tone !== null ? ' data-q="' + tone + '"' : "") +
          (tip ? ' title="' + esc(tip) + '"' : "") + ">" +
          icoHtml +
          '<div class="scbody"><span class="scname">' + esc(title) + "</span>" +
          (metaBits.length
            ? '<span class="scmeta">' + esc(metaBits.join(" · ")) + "</span>"
            : "") +
          "</div></div>");
      });
      o.push("</div>");
      var nWithSid = c.scard.filter(function (s) {
        return !s.blocked && s.sid;
      }).length;
      var nHow = c.scard.filter(function (s) { return s._sidHow; }).length;
      if (nHow) {
        o.push('<div class="wepline muted">Namen aus dem Export zugeordnet. ' +
          "Ein frischer <code>/bs</code> mit aktuellem Addon schreibt den " +
          "Spell direkt in den Slot.</div>");
      } else if (!nNamed && filled && !nWithSid) {
        o.push('<div class="wepline muted">Namen fehlen in diesem Export. ' +
          "Aktualisiere das Addon und exportiere neu mit <code>/bs</code>.</div>");
      }
    }
    if (c.carded && c.carded.length) {
      var onCard = Object.create(null);
      (c.scard || []).forEach(function (s) {
        if (s.sid) onCard[s.sid] = 1;
      });
      var extras = c.carded.filter(function (sid) { return !onCard[sid]; });
      var hasSlots = !!(c.scard && c.scard.length);
      // Keine zweite Wand: Slots ohne Namen + dieselbe Liste darunter.
      if (extras.length && !hasSlots) {
        o.push('<div class="wepline"><b>Auf Karten</b> ' + extras.length + "</div>");
        o.push('<div class="scardgrid scard-spells">');
        extras.forEach(function (sid) {
          var idx = BYSID[sid];
          var nm = idx !== undefined ? CAT[idx][0] : ("Spell #" + sid);
          o.push('<div class="scard">' + scardIco(idx, 32) +
            '<div class="scbody"><span class="scname">' + esc(nm) + "</span></div></div>");
        });
        o.push("</div>");
      } else if (extras.length && nNamed) {
        var extraBits = ['<div class="scardgrid scard-spells">'];
        extras.forEach(function (sid) {
          var idx = BYSID[sid];
          var nm = idx !== undefined ? CAT[idx][0] : ("Spell #" + sid);
          extraBits.push('<div class="scard">' + scardIco(idx, 32) +
            '<div class="scbody"><span class="scname">' + esc(nm) + "</span>" +
            '<span class="scmeta">#' + sid + "</span></div></div>");
        });
        extraBits.push("</div>");
        o.push(wrapDetails(extraBits.join(""),
          "Weitere auf Karten (" + extras.length + ")"));
      }
    }
    if (c.scardPend !== undefined && c.scardPend > 0) {
      o.push('<div class="wepline muted">' + c.scardPend +
        " Skill Card" + (c.scardPend === 1 ? "" : "s") +
        " noch einzulösen</div>");
    }
    return o.join("");
  }


  // ---------- Charakterkarte ----------
  // WoW-Paperdoll-Reihenfolge (Export-Labels aus Collect.lua).
  // GetItemInfo-Qualität (0–5+) → unsere --q0…--q4-Tokens.
  var GEAR_SLOTS_UI = [
    ["Head", "Kopf", "L"], ["Neck", "Hals", "L"], ["Shoulder", "Schulter", "L"],
    ["Back", "Rücken", "L"], ["Chest", "Brust", "L"], ["Wrist", "Handgelenke", "L"],
    ["Hands", "Hände", "R"], ["Waist", "Taille", "R"], ["Legs", "Beine", "R"],
    ["Feet", "Füße", "R"], ["Ring1", "Ring 1", "R"], ["Ring2", "Ring 2", "R"],
    ["Trinket1", "Schmuck 1", "R"], ["Trinket2", "Schmuck 2", "R"],
    ["MainHand", "Haupthand", "B"], ["OffHand", "Nebenhand", "B"],
    ["Ranged", "Distanz", "B"]
  ];
  var ALL_GEAR_SLOTS = GEAR_SLOTS_UI.map(function (x) { return x[0]; });
  var GEAR_LABEL = {};
  GEAR_SLOTS_UI.forEach(function (x) { GEAR_LABEL[x[0]] = x[1]; });

  function gearQTone(q) {
    q = +q || 0;
    if (q >= 5) return 4;
    if (q === 4) return 3;
    if (q === 3) return 2;
    if (q === 2) return 1;
    return 0;
  }

  function gearBySlot(list) {
    var m = {};
    (list || []).forEach(function (g) { if (g && g.slot) m[g.slot] = g; });
    return m;
  }

  // ITEMICONS (D.iic): flach {itemId: iconName} oder Legacy {icon,d}/byItem.
  function itemIconMeta(itemId) {
    if (!itemId || !ITEMICONS) return null;
    var key = String(itemId);
    if (ITEMICONS.byItem) {
      var raw = ITEMICONS.byItem[itemId] || ITEMICONS.byItem[key];
      if (typeof raw === "string") {
        var d1 = ITEMICONS.itemDisplay
          ? (+ITEMICONS.itemDisplay[key] || +ITEMICONS.itemDisplay[itemId] || 0)
          : 0;
        return { i: raw, d: d1 };
      }
      if (raw && typeof raw === "object") return raw;
    }
    if (ITEMICONS.itemDisplay && ITEMICONS.byDisplay) {
      var did = ITEMICONS.itemDisplay[key] || ITEMICONS.itemDisplay[itemId];
      if (did != null) {
        var ic = ITEMICONS.byDisplay[String(did)] || ITEMICONS.byDisplay[did];
        if (ic) return { i: ic, d: +did };
      }
    }
    var leg = ITEMICONS[itemId] || ITEMICONS[key];
    if (typeof leg === "string") return { i: leg, d: 0 };
    if (leg && typeof leg === "object") {
      return {
        i: leg.i || leg.icon || leg.name || "",
        d: +leg.d || +leg.display || +leg.displayInfo || 0,
        url: leg.url || leg.data || leg.src || "",
        cls: leg.cls,
        sub: leg.sub,
        inv: leg.inv
      };
    }
    return null;
  }

  function itemIconName(itemId) {
    var meta = itemIconMeta(itemId);
    if (!meta) return "";
    if (typeof meta === "string") return meta;
    return meta.i || meta.icon || meta.name || "";
  }

  function itemDisplayInfo(itemId) {
    var meta = itemIconMeta(itemId);
    if (!meta || typeof meta === "string") return 0;
    return +meta.d || +meta.display || +meta.displayInfo || 0;
  }

  // v1: URI wenn vorhanden; sonst Icon-Basename aus D.iic (kein CDN/CSP/BLP).
  function itemIconHtml(itemId, qTone) {
    var meta = itemIconMeta(itemId);
    if (!meta) return "";
    var name = itemIconName(itemId);
    var url = (typeof meta === "object")
      ? (meta.url || meta.data || meta.src || "") : "";
    if (url) {
      return '<span class="gico" style="background-image:url(' + esc(url) + ')"' +
        (name ? ' title="' + esc(name) + '" data-icon="' + esc(name) + '"' : "") +
        "></span>";
    }
    if (!name) return "";
    var short = name.replace(/^inv[_-]?/i, "").replace(/_/g, " ");
    if (short.length > 10) short = short.slice(0, 9) + "…";
    var frame = qTone !== undefined && qTone !== null
      ? "border:1px solid var(--q" + qTone + ");"
      : "";
    return '<span class="gico gico-miss" style="' + frame +
      'font-size:7px;line-height:1.1;display:inline-flex;align-items:center;' +
      'justify-content:center;text-align:center;padding:1px;overflow:hidden;' +
      'color:var(--ink-soft)" title="' + esc(name) +
      '" data-icon="' + esc(name) + '">' + esc(short) + "</span>";
  }

  function gearSlotHtml(slot, label, g) {
    if (!g) {
      return '<div class="gslot empty"><span class="gsl">' + esc(label) +
        '</span><span class="gsn">—</span></div>';
    }
    var tone = gearQTone(g.q);
    var tip = [];
    if (g.sub && g.sub !== "-") tip.push(g.sub);
    if (g.itemId) tip.push("itemId " + g.itemId);
    var iname = itemIconName(g.itemId);
    if (iname) tip.push(iname);
    if (g.ench) tip.push("ench " + g.ench);
    var ico = itemIconHtml(g.itemId, tone);
    return '<div class="gslot' + (ico ? " hasico" : "") +
      '" style="border-left-color:var(--q' + tone + ')"' +
      (tip.length ? ' title="' + esc(tip.join(" · ")) + '"' : "") + ">" +
      ico +
      '<span class="gsl">' + esc(label) + "</span>" +
      '<span class="gsn" style="color:var(--q' + tone + ')">' + esc(g.name || "?") +
      "</span>" +
      '<span class="gsi">' + (g.ilvl ? "ilvl " + g.ilvl : "") +
      (g.itemId ? '<span class="gid">#' + g.itemId + "</span>" : "") +
      "</span></div>";
  }

  function renderGearPaperdoll(gear) {
    var by = gearBySlot(gear);
    var L = [], R = [], B = [];
    GEAR_SLOTS_UI.forEach(function (def) {
      var html = gearSlotHtml(def[0], def[1], by[def[0]]);
      if (def[2] === "L") L.push(html);
      else if (def[2] === "R") R.push(html);
      else B.push(html);
    });
    return '<div class="gearpd">' +
      '<div class="gearcols"><div class="gearcol">' + L.join("") + "</div>" +
      '<div class="gearcol">' + R.join("") + "</div></div>" +
      '<div class="gearbot">' + B.join("") + "</div></div>";
  }

  // Essence: Remaining (A/T) vs Spent (AS/TS); AX = erwartet fuer Level.
  // Levelrun und L60: gleiche Anzeige — freier Rest und Soll-Stand klar getrennt.
  function renderEssenceBar(c) {
    function row(label, rem, spent, expect) {
      rem = rem === undefined ? null : +rem || 0;
      spent = spent === undefined ? null : +spent || 0;
      expect = expect === undefined ? null : +expect || 0;
      // undefined → null über den Ternary oben; 0 bleibt 0.
      if (arguments[1] === undefined) rem = null;
      if (arguments[2] === undefined) spent = null;
      if (arguments[3] === undefined) expect = null;
      if (rem === null && spent === null && expect === null) return "";
      var r = rem === null ? 0 : rem;
      var sp = spent === null ? 0 : spent;
      var total = r + sp;
      var pctSpent = total > 0 ? Math.round(100 * sp / total) : 0;
      var bits = [];
      var tip = [];
      if (spent !== null) {
        bits.push('<span class="esschip"><i>ausgegeben</i> ' + sp + "</span>");
        tip.push("ausgegeben " + sp);
      }
      if (rem !== null) {
        if (r > 0) {
          bits.push('<a class="esschip free jumplink" href="#issues-krit" ' +
            'data-jump="issues-krit" title="Zum Essence-Befund springen">' +
            "<i>frei</i> " + r + "</a>");
        } else {
          bits.push('<span class="esschip"><i>frei</i> ' + r + "</span>");
        }
        tip.push("frei " + r);
      }
      if (expect !== null) {
        var gap = expect - total;
        var exCls = "esschip";
        var exNote = "";
        if (total > 0 && gap === 0) {
          exCls += " ok";
          exNote = " · passt";
        } else if (gap > 0) {
          exCls += " soft";
          exNote = " · noch " + gap;
        } else if (gap < 0) {
          exCls += " soft";
          exNote = " · +" + (-gap);
        }
        bits.push('<span class="' + exCls + '"><i>Soll Stufe</i> ' +
          expect + esc(exNote) + "</span>");
        tip.push("Soll für Stufe " + expect +
          (gap > 0 ? " (noch " + gap + ")" :
            gap < 0 ? " (+" + (-gap) + " über Soll)" : " — passt"));
      }
      if (total > 0 && spent !== null && rem !== null) tip.push("Summe " + total);
      return '<div class="essrow"><span class="esslab">' + esc(label) +
        "</span><span class=\"essbar\" title=\"" + esc(tip.join(" · ")) +
        '"><i class="spent" style="width:' + pctSpent + '%"></i></span>' +
        '<span class="essnum">' + bits.join("") + "</span></div>";
    }
    var html = row("AE", c.essA, c.essASpent, c.essAExpect) +
      row("TE", c.essT, c.essTSpent, c.essTExpect);
    if (!html) return "";
    var lvlHint = "";
    if (c.level) {
      lvlHint = c.level >= 60
        ? '<div class="esshint">Stufe 60 — freier Rest ist Endgame-Budget, ' +
          "nicht Level-Nachzug.</div>"
        : '<div class="esshint">Stufe ' + c.level +
          " — Soll folgt dem Addon für deine aktuelle Stufe.</div>";
    }
    return '<div class="essbox" id="essbox"><div class="geartitle">Essence</div>' +
      html + lvlHint + "</div>";
  }

  // Wildcard-Status: spielerrelevante Zeilen, kein CanRoll/RPhase-Dump.
  function renderWcStatus(wc) {
    if (!wc || !Object.keys(wc).length) return "";
    var rows = [];
    function add(lab, val) {
      if (!val) return;
      rows.push('<div class="wcrow"><span class="wck">' + esc(lab) +
        '</span><span class="wcv">' + val + "</span></div>");
    }
    var status = [];
    if (wc.CanRoll !== undefined) {
      status.push(wc.CanRoll
        ? '<span class="wcchip ok">Roll möglich</span>'
        : '<span class="wcchip">kein Roll offen</span>');
    }
    if (wc.Starting) {
      status.push('<span class="wcchip soft">Startwahl offen</span>');
    }
    if (wc.WillStart) {
      status.push('<span class="wcchip soft">Start steht an</span>');
    }
    if (wc.WillFirst) {
      status.push('<span class="wcchip soft">Erster Roll steht an</span>');
    }
    if (wc.AwaitTalent) {
      status.push('<span class="wcchip soft">Talent-Upgrade ausstehend</span>');
    }
    var phase = wc.RRPhase && String(wc.RRPhase);
    if (phase && /roll/i.test(phase) && !/idle/i.test(phase)) {
      status.push('<span class="wcchip ok">Rapid Roll läuft</span>');
    }
    if (status.length) add("Status", status.join(" "));

    var rapid = [];
    if (wc.CanRapid !== undefined) {
      rapid.push(wc.CanRapid
        ? "Rapid Roll bereit"
        : "Rapid Roll nicht bereit");
    }
    if (wc.MaxRapid !== undefined && wc.MaxRapid > 0) {
      rapid.push("Max. " + wc.MaxRapid + " pro Zug");
    }
    function bpLine(label, bp) {
      if (!bp || typeof bp !== "object") return "";
      if (!(bp.cur || bp.req || bp.next)) return "";
      var t = label + " " + (bp.cur || 0) + " / " + (bp.req || 0);
      if (bp.next) t += " · nächster Bonus +" + bp.next;
      return t;
    }
    var abi = bpLine("Fähigkeiten", wc.RRAbi);
    var tal = bpLine("Talente", wc.RRTal);
    if (abi) rapid.push(abi);
    if (tal) rapid.push(tal);
    if (rapid.length) add("Rapid", esc(rapid.join(" · ")));

    var buy = [];
    if (wc.RepurchAbi !== undefined || wc.RepurchTal !== undefined) {
      if (wc.RepurchAbi !== undefined) {
        buy.push((wc.RepurchAbi || 0) + " Fähigkeiten");
      }
      if (wc.RepurchTal !== undefined) {
        buy.push((wc.RepurchTal || 0) + " Talente");
      }
      if (wc.CanRepurch !== undefined) {
        buy.push(wc.CanRepurch ? "Nachkauf möglich" : "Nachkauf gesperrt");
      }
      add("Nachkauf", esc(buy.join(" · ")));
    } else if (wc.CanRepurch !== undefined) {
      add("Nachkauf", esc(wc.CanRepurch ? "möglich" : "gesperrt"));
    }

    if (!rows.length) return "";
    return '<div class="wcstatus">' + rows.join("") + "</div>";
  }

  // ---------- Waffen-Evidence (WEAPON-Import + D.wpn aus Item-DBCs) ----------
  // Tempo/DPS kommen aus dem Addon (gemessen mit AP/SP). DBC liefert nur
  // ilvl/Basis-Schaden/Stufenbänder — kein Tempo, keine erfundenen Koeffizienten.
  function wpnLookup(itemId) {
    if (!WPN || !itemId) return null;
    return WPN[itemId] || WPN[String(itemId)] || null;
  }
  function weaponAvgDmg(w) {
    if (!w || !w.dmg) return 0;
    var m = String(w.dmg).match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
    return m ? (+m[1] + +m[2]) / 2 : 0;
  }
  function weaponExportDps(w) {
    if (!w) return 0;
    if (w.dps > 0) return w.dps;
    var avg = weaponAvgDmg(w);
    return (avg && w.speed > 0) ? avg / w.speed : 0;
  }
  function weaponBandAt(db, level) {
    if (!db || !db.b || !level) return null;
    var key = String(level);
    if (db.b[key]) return db.b[key];
    // Nächstliegendes Band 10–60, sonst fehlt
    var best = null, bestDist = 999;
    Object.keys(db.b).forEach(function (k) {
      var lv = +k, d = Math.abs(lv - level);
      if (d < bestDist) { bestDist = d; best = db.b[k]; }
    });
    return bestDist <= 2 ? best : null;
  }
  function formatDmgPair(pair) {
    if (!pair || pair.length < 2) return "";
    return pair[0] + "–" + pair[1];
  }
  function weaponEvidenceHtml(w, charLevel) {
    if (!w) return "";
    var bits = [];
    var avg = weaponAvgDmg(w);
    var dps = weaponExportDps(w);
    if (dps) {
      bits.push("Import " + dps.toFixed(1) + " DPS");
    } else {
      bits.push("Import-DPS fehlt");
    }
    if (avg && w.speed > 0) {
      var recomputed = avg / w.speed;
      if (dps && Math.abs(recomputed - dps) > 0.6) {
        bits.push("nachgerechnet " + recomputed.toFixed(1) + " DPS");
      }
    }
    if (w.ilvl) bits.push("ilvl " + w.ilvl);
    else bits.push("ilvl fehlt");

    var db = wpnLookup(w.itemId);
    if (!w.itemId) {
      bits.push("DBC fehlt (keine itemId)");
    } else if (!db) {
      bits.push("DBC fehlt");
    } else {
      if (db.ilvl != null) {
        bits.push("DBC-ilvl " + db.ilvl +
          (w.ilvl && db.ilvl !== w.ilvl ? " ≠ Import" : ""));
      } else {
        bits.push("DBC-ilvl fehlt");
      }
      var band = weaponBandAt(db, charLevel);
      if (band) {
        bits.push("Band Stufe " + (charLevel || "?") + ": " +
          formatDmgPair(band) + " (ohne AP/SP)");
      } else if (db.dmg) {
        bits.push("DBC-Basis " + formatDmgPair(db.dmg) +
          " (Band 10–60 fehlt)");
      } else {
        bits.push("DBC-Schaden fehlt");
      }
      if (db.n && w.name && db.n !== w.name) {
        bits.push("DBC-Name „" + db.n + "“");
      }
    }
    return bits.join(" · ");
  }
  function weaponBareScalingFlags(ids) {
    // Einträge mit Waffen-Tag, aber ohne gemessene Tooltip-% in D.scaling
    var bare = [], scaled = [];
    (ids || []).forEach(function (i) {
      var t = TAG[i] || 0, s = SC[i] || {};
      if (!(t & T_WEAPON) && !s.w) return;
      if (s.w) scaled.push(i);
      else if (t & T_WEAPON) bare.push(i);
    });
    return { bare: bare, scaled: scaled };
  }

  // ---------- Stufenbänder 10–60 (D.ilb aus ItemStat.dbc) ----------
  // Mid-Schaden = Import (min+max)/2 bzw. DPS×Tempo. Keine Spell-Koeffizienten.
  function ilvlBandAt(level) {
    if (!ILB || !ILB.levels || !level) return null;
    var L = Math.round(+level);
    if (L < 10) L = 10;
    if (L > 60) L = 60;
    return ILB.levels[L] || ILB.levels[String(L)] || null;
  }
  function weaponIs2H(w) {
    return !!(w && /2HWEAPON/i.test(String(w.loc || "")));
  }
  function weaponMidDamage(w) {
    if (!w) return null;
    var avg = weaponAvgDmg(w);
    if (avg > 0) return avg;
    var dps = weaponExportDps(w);
    if (dps > 0 && w.speed > 0) return dps * w.speed;
    return null;
  }
  // band: {p25,p50,p75}. Kollabierte Perzentile → ±Toleranz um p50.
  function bandVerdict(value, band, kind) {
    if (value == null || !band || band.p50 == null) return null;
    var v = +value, lo = band.p25, hi = band.p75, mid = band.p50;
    if (lo == null || hi == null || hi <= lo) {
      var pad = kind === "ilvl" ? 5 : Math.max(3, mid * 0.12);
      lo = mid - pad;
      hi = mid + pad;
    }
    if (v < lo) return "low";
    if (v > hi) return "high";
    return "ok";
  }
  function bandLabel(verdict, band, unit) {
    if (!band || band.p50 == null) {
      return '<span class="band unk" title="Kein ItemStat-Band für diese Stufe">' +
        "Band unbekannt</span>";
    }
    var tip = "ItemStat p25–p75: " + band.p25 + "–" + band.p75 +
      " · Median " + band.p50 + (unit ? " " + unit : "") +
      " · n=" + (band.n || "?");
    var text = verdict === "low" ? "unter Band"
      : verdict === "high" ? "über Band"
      : verdict === "ok" ? "im Band"
      : "Band";
    return '<span class="band ' + (verdict || "unk") + '" title="' + esc(tip) +
      '">' + text + " · Med " + band.p50 + "</span>";
  }
  function weaponBandKey(w) {
    // Distanzwaffen: kein 2H-/1H-Mid-Band (NOTES-ilvl) — ehrlich fehlt
    if (!w || w.slot === "RANGED" || /RANGED|THROWN/i.test(String(w.loc || ""))) {
      return null;
    }
    return weaponIs2H(w) ? "w2h" : "w1h";
  }
  // -1 unter Band, 0 unbekannt/ok, +1 über Band (Generator).
  function weaponGearSignal(c) {
    c = c || CHAR;
    if (!c || !c.level) return 0;
    var band = ilvlBandAt(c.level);
    if (!band) return 0;
    var mh = (c.weapons || []).filter(function (w) { return w.slot === "MH"; })[0];
    if (!mh) return 0;
    var key = weaponBandKey(mh);
    if (!key || !band[key]) return 0;
    var mid = weaponMidDamage(mh);
    var v = bandVerdict(mid, band[key], "wpn");
    if (v === "low") return -1;
    if (v === "high") return 1;
    return 0;
  }
  function ilvlBandHtml(c) {
    if (!c || !c.level || !(c.ilvl > 0)) return "";
    var band = ilvlBandAt(c.level);
    var ib = band && band.ilvl;
    var verd = bandVerdict(c.ilvl, ib, "ilvl");
    return bandLabel(verd, ib, "ilvl");
  }
  function weaponLevelBandHtml(w, level) {
    if (!w || !level) return "";
    var key = weaponBandKey(w);
    if (!key) {
      return '<span class="band unk" title="Distanzwaffen haben kein 1H/2H-Mid-Band">' +
        "Band fehlt (Distanz)</span>";
    }
    var band = ilvlBandAt(level);
    var wb = band && band[key];
    var mid = weaponMidDamage(w);
    var verd = bandVerdict(mid, wb, "wpn");
    if (mid == null) {
      return '<span class="band unk">Mid fehlt</span>' + bandLabel(null, wb, "");
    }
    return '<span class="meta">Mid ' + mid.toFixed(0) + "</span>" +
      bandLabel(verd, wb, "Mid-Schaden");
  }

  function renderChar() {
    var box = document.getElementById("charBox");
    var hd = document.getElementById("cC");
    if (!CHAR) {
      hd.textContent = "—"; hd.className = "cnt";
      hd.removeAttribute("data-krit");
      hd.removeAttribute("data-fix");
      box.innerHTML = emptyState(
        "Noch kein Charakter eingelesen.",
        '<p><a href="#t=vTools">Import unter Werkzeuge</a> — im Spiel <code>/bs</code> ' +
          "tippen, kopieren und hier einfügen.</p>");
      renderGearBox(null);
      return;
    }
    var c = CHAR, s = c.stats || {};
    hd.textContent = c.name || "importiert";
    hd.className = "cnt ok";

    var mh = (c.weapons || []).filter(function (w) { return w.slot === "MH"; })[0];
    var twoH = mh && /2HWEAPON/i.test(mh.loc);

    var o = [];
    var headBits = [
      "<b>" + esc(c.name || "?") + "</b>",
      "Stufe " + (c.level || "?"),
      esc(c.race || ""),
      esc(c.cls || "")
    ].filter(Boolean);
    if (c.path) headBits.push("Path of " + esc(c.path));
    if (c.pathInfo && c.pathInfo.name && c.pathInfo.name !== c.path) {
      headBits.push(esc(c.pathInfo.name));
    }
    if (c.spec || c.specName) {
      headBits.push("Spec " + (c.specName ? esc(c.specName) :
        "#" + c.spec) +
        (c.chrSpec ? " · CHR " + c.chrSpec : ""));
    }
    if (c.specs && c.specs.length) {
      headBits.push("Specs: " + c.specs.join(", "));
    }
    var ml = modeLabel(c);
    if (ml) headBits.push(esc(ml));
    else if (isDraftChar(c)) headBits.push("Draft");
    if (mh) headBits.push(twoH ? "Zweihand" : "Einhand");
    o.push('<div class="charhd">' + headBits.join(" · ") + "</div>");

    if (c.pathInfo && (c.pathInfo.spellId || c.pathInfo.name)) {
      var piSid = c.pathInfo.spellId || 0;
      var piIdx = piSid ? BYSID[piSid] : undefined;
      var piTip = [];
      if (piSid) piTip.push("spellId " + piSid);
      if (c.pathEntry) piTip.push("entry " + c.pathEntry);
      o.push('<div class="wepline"' +
        (piTip.length ? ' title="' + esc(piTip.join(" · ")) + '"' : "") +
        '><b>Path</b> ' +
        (piIdx !== undefined
          ? '<span class="icon" style="display:inline-block;vertical-align:-6px;width:20px;height:20px;' +
            iconStyle(piIdx, 20) + '"></span> '
          : "") +
        esc(c.pathInfo.name || nameBySid(piSid) || "?") +
        "</div>");
    } else if (c.pathEntry) {
      o.push('<div class="wepline" title="entry ' + c.pathEntry + '"><b>Path</b> ' +
        esc(nameByEid(c.pathEntry)) + "</div>");
    }
    if (c.suggest && c.suggest.length) {
      o.push('<div class="wepline"><b>Path-Vorschlag</b> ' +
        c.suggest.map(esc).join(", ") + "</div>");
    }

    var meta = [];
    if (c.addon) meta.push("Addon v" + esc(c.addon));
    if (c.essA !== undefined || c.essT !== undefined ||
        c.essASpent !== undefined || c.essTSpent !== undefined ||
        c.essAExpect !== undefined || c.essTExpect !== undefined) {
      o.push(renderEssenceBar(c));
    }
    if (c.invest) {
      var inv = [];
      if (c.invest.AE !== undefined) inv.push("AE " + c.invest.AE);
      if (c.invest.TE !== undefined) inv.push("TE " + c.invest.TE);
      if (c.invest.CP !== undefined) inv.push("CP " + c.invest.CP);
      if (inv.length) meta.push("Investition " + inv.join(" · "));
    }
    if (c.investTabs && c.investTabs.length) {
      meta.push("Talent-Tabs " + c.investTabs.slice(0, 6).map(function (t) {
        return t.cls + "/" + t.spec + ":" + t.n;
      }).join(", ") + (c.investTabs.length > 6 ? "…" : ""));
    }
    if (c.locked && c.locked.length) {
      meta.push(c.locked.length + " Sperre" +
        (c.locked.length === 1 ? "" : "n"));
    }
    if (c.mast && c.mast.length) {
      meta.push(c.mast.length + " Mastery");
    }
    if (c.scardPend !== undefined && c.scardPend > 0) {
      meta.push(c.scardPend + " Karten ausstehend");
    }
    if (meta.length) {
      o.push('<div class="wepline meta"><b>Export</b> ' +
        meta.join(" · ") + "</div>");
    }

    // Wildcard / Skill Cards / Desire — wenn MODE, SCARD oder Desire-Keys stehen
    if (hasMode(c, "WILDCARD") || isDraftChar(c) || (c.scard && c.scard.length) ||
        (c.carded && c.carded.length) ||
        (c.desire && c.desire.length) ||
        (c.undesire && c.undesire.length) ||
        (c.pathAura && c.pathAura.length) ||
        (c.trait && c.trait.length) ||
        (c.startChoice && c.startChoice.length) ||
        (c.wc && Object.keys(c.wc).length) ||
        (c.scardPend !== undefined && c.scardPend > 0)) {
      o.push('<div class="wcbox"><div class="geartitle">Wildcard</div>');
      if (ml) {
        o.push('<div class="wepline"><b>Modus</b> ' + esc(ml) +
          (isDraftChar(c) ? ' <span class="gid">Draft</span>' : "") +
          "</div>");
      }
      var wcHtml = renderWcStatus(c.wc);
      if (wcHtml) o.push(wcHtml);
      if (c.startChoice && c.startChoice.length) {
        o.push('<div class="wepline"><b>Startwahl</b> ' +
          c.startChoice.slice(0, 8).map(function (eid) {
            return esc(nameByEid(eid));
          }).join(", ") +
          (c.startChoice.length > 8 ? "…" : "") + "</div>");
      }
      if (c.trait && c.trait.length) {
        o.push('<div class="wepline"><b>Traits</b> ' +
          c.trait.slice(0, 8).map(function (eid) {
            return esc(nameByEid(eid));
          }).join(", ") +
          (c.trait.length > 8 ? "…" : "") + "</div>");
      }
      if (c.pathAura && c.pathAura.length) {
        o.push('<div class="wepline"><b>Path-Aura</b> ' +
          c.pathAura.map(function (sid) {
            return esc(nameBySid(sid)) + " <span class=\"gid\">#" + sid + "</span>";
          }).join(", ") + "</div>");
      }
      if (c.locked && c.locked.length) {
        var lockBits = c.locked.map(function (eid) {
          return esc(nameByEid(eid));
        });
        if (lockBits.length > 8) {
          o.push('<div class="wepline"><b>Sperren</b> ' + lockBits.length +
            "</div>" + wrapDetails(lockBits.join(", "),
            "Sperren (" + lockBits.length + ")"));
        } else {
          o.push('<div class="wepline"><b>Sperren</b> ' +
            lockBits.join(", ") + "</div>");
        }
      }
      if (c.desire && c.desire.length) {
        o.push('<div class="wepline"><b>Desire</b> ' +
          c.desire.slice(0, 10).map(function (eid) {
            return esc(nameByEid(eid));
          }).join(", ") +
          (c.desire.length > 10 ? "…" : "") + "</div>");
      }
      if (c.undesire && c.undesire.length) {
        o.push('<div class="wepline"><b>Undesire</b> ' +
          c.undesire.slice(0, 8).map(function (eid) {
            return esc(nameByEid(eid));
          }).join(", ") +
          (c.undesire.length > 8 ? "…" : "") + "</div>");
      }
      if (c.scardPend !== undefined && c.scardPend > 0) {
        o.push('<div class="wepline"><b>Karten</b> ' + c.scardPend +
          " Skill Card" + (c.scardPend === 1 ? "" : "s") +
          " noch einzulösen</div>");
      }
      if (c.scard && c.scard.length) {
        var nWcFill = c.scard.filter(function (s) { return !s.blocked; }).length;
        o.push('<div class="wepline"><b>Skill Cards</b> ' + nWcFill +
          " belegt</div>");
      } else if (c.carded && c.carded.length) {
        o.push('<div class="wepline"><b>Skill Cards</b> ' + c.carded.length +
          " auf Karten</div>");
      }
      o.push("</div>");
    }

    var rows = [
      ["Spell Power", s.SP], ["Attack Power", s.AP], ["Ranged AP", s.RAP],
      ["Healing", s.HEAL],
      ["Strength", s.STR], ["Agility", s.AGI], ["Intellect", s.INT],
      ["Spirit", s.SPI], ["Stamina", s.STA],
      ["Melee-Crit", s.CRIT, "%"], ["Spell-Crit", s.SCRIT, "%"],
      ["Hit Rating", s.HITRATING], ["Hit %", s.HITPCT, "%"],
      ["Spell Hit %", s.SHITPCT, "%"],
      ["Haste Rating", s.HASTERATING], ["Haste %", s.HASTE, "%"],
      ["Crit Rating", s.CRITRATING],
      ["Expertise", s.EXP], ["Expertise %", s.EXPPCT, "%"],
      ["Expertise Rating", s.EXPRATING],
      ["MP5", s.MP5], ["Spell Pen", s.SPECPEN],
      ["Armor Pen", s.ARPEN, "%"],
      ["Dodge", s.DODGE, "%"], ["Parry", s.PARRY, "%"],
      ["Armor", s.ARMOR],
      ["Holy", s.HOLY], ["Fire", s.FIRE], ["Nature", s.NATURE],
      ["Frost", s.FROST], ["Shadow", s.SHADOW], ["Arcane", s.ARCANE]
    ].filter(function (r) { return r[1] !== undefined && !isNaN(r[1]); });

    Object.keys(c.resist || {}).forEach(function (k) {
      rows.push(["Resist " + k, c.resist[k]]);
    });

    if (rows.length) {
      o.push('<div class="statgrid">');
      rows.forEach(function (r) {
        o.push("<div><span>" + esc(r[0]) + "</span><b>" +
          (r[2] ? (+r[1]).toFixed(2) : Math.round(r[1])) + (r[2] || "") +
          "</b></div>");
      });
      o.push("</div>");
    }

    if (mh) {
      o.push('<div class="wepline"><b>Waffe</b> ' +
        '<span' + (mh.itemId ? ' title="itemId ' + mh.itemId + '"' : "") + ">" +
        esc(mh.name) + "</span>" +
        (mh.dmg ? " · " + esc(mh.dmg) : "") +
        (mh.speed ? " · Tempo " + mh.speed.toFixed(2) : "") +
        (mh.sub && mh.sub !== "-" ? " · " + esc(mh.sub) : "") +
        (mh.itemId ? ' <span class="gid">#' + mh.itemId + "</span>" : "") +
        "</div>");
      o.push('<div class="wepline meta">' + esc(weaponEvidenceHtml(mh, c.level)) +
        "</div>");
      o.push('<div class="wepline"><b>Stufenband</b> ' +
        weaponLevelBandHtml(mh, c.level) + "</div>");
    }
    (c.weapons || []).filter(function (w) {
      return w.slot === "OH" || w.slot === "RANGED";
    }).forEach(function (w) {
      o.push('<div class="wepline"><b>' +
        (w.slot === "OH" ? "Nebenhand" : "Distanz") + "</b> " +
        '<span' + (w.itemId ? ' title="itemId ' + w.itemId + '"' : "") + ">" +
        esc(w.name) + "</span>" +
        (w.dmg ? " · " + esc(w.dmg) : "") +
        (w.speed ? " · Tempo " + w.speed.toFixed(2) : "") +
        (w.itemId ? ' <span class="gid">#' + w.itemId + "</span>" : "") +
        "</div>");
      o.push('<div class="wepline meta">' + esc(weaponEvidenceHtml(w, c.level)) +
        "</div>");
      if (w.slot === "OH") {
        o.push('<div class="wepline"><b>Stufenband</b> ' +
          weaponLevelBandHtml(w, c.level) + "</div>");
      }
    });
    if (c.ilvl) {
      o.push('<div class="wepline"><b>Gegenstandsstufe</b> ' + c.ilvl.toFixed(2) +
        " über " + (c.gear || []).length + " Slots" +
        (c.level ? " · Stufe " + c.level + " " + ilvlBandHtml(c) : "") +
        "</div>");
    }
    if ((c.gear || []).length) {
      o.push('<div class="gearwrap"><div class="geartitle">AUSRÜSTUNG</div>' +
        renderGearPaperdoll(c.gear) + "</div>");
    }
    box.innerHTML = o.join("");
    renderGearBox(c);
  }

  function renderGearBox(c) {
    var box = document.getElementById("gearBox");
    var hd = document.getElementById("cG");
    var titleEl = box && box.parentNode &&
      box.parentNode.querySelector(".panel-hd h2");
    var sec = document.querySelector("#vAnalyse .analyse-sec");
    if (!box) return;
    var hasGear = !!(c && (c.gear || []).length);
    var cardsHtml = c ? skillCardsHtml(c) : "";
    var hasCards = !!cardsHtml;
    if (sec) sec.classList.toggle("cols-2", !hasGear && !hasCards);
    if (titleEl) {
      titleEl.textContent = hasGear && hasCards ? "AUSRÜSTUNG & KARTEN"
        : hasCards && !hasGear ? "SKILL CARDS"
        : "AUSRÜSTUNG";
    }
    if (!c || (!hasGear && !hasCards)) {
      if (hd) { hd.textContent = "—"; hd.className = "cnt"; }
      box.innerHTML = emptyState(
        "Keine Ausrüstung und keine Skill Cards im Export.",
        "<p>Gear im Addon mit <code>/bs gear</code> einschalten und neu kopieren. " +
          "Karten kommen mit Wildcard-Export (Addon 1.5+).</p>");
      return;
    }
    var bits = [];
    if (hasGear) {
      if (c.ilvl) bits.push(c.ilvl.toFixed(1) + " ilvl");
      bits.push(c.gear.length + " Slots");
    }
    if (hasCards && c.scard) {
      var nFill = c.scard.filter(function (s) { return !s.blocked; }).length;
      bits.push(nFill + " Karten");
    }
    if (hd) {
      hd.textContent = bits.join(" · ") || "—";
      hd.className = "cnt ok";
    }
    var note = "";
    if (!hasGear) {
      note = '<div class="ilvlnote muted"><b>Ausrüstung aus</b> — im Addon ' +
        "<code>/bs gear</code> und neu exportieren, wenn du Paperdoll und " +
        "ilvl hier sehen willst. Skill Cards unten trotzdem aus dem Export.</div>";
    } else if (c.ilvl && c.level && ILB) {
      var ib = ilvlBandAt(c.level);
      var verd = bandVerdict(c.ilvl, ib && ib.ilvl, "ilvl");
      if (typeof isEndgameLevel === "function" && isEndgameLevel(c.level)) {
        note = '<div class="ilvlnote"><b>Gegenstandsstufe</b> Import ' +
          c.ilvl.toFixed(1) + " bei Stufe " + c.level + " " +
          bandLabel(verd, ib && ib.ilvl, "ilvl") +
          ". ItemStat-Bänder enden bei 59 — Vergleich nur Anhalt, kein Raid-BiS.</div>";
      } else {
        note = '<div class="ilvlnote"><b>Levelrun-ilvl</b> Import ' +
          c.ilvl.toFixed(1) + " bei Stufe " + c.level + " " +
          bandLabel(verd, ib && ib.ilvl, "ilvl") +
          ". Band aus ItemStat (Skalierungsitems) — Anhalt, kein Raid-Ziel.</div>";
      }
    } else if (c.ilvl && !ILB) {
      note = '<div class="ilvlnote"><b>Gegenstandsstufe</b> ' +
        c.ilvl.toFixed(1) +
        " — Stufenband nicht eingebettet (<code>ilvlbands.json</code>).</div>";
    }
    box.innerHTML = note +
      (hasGear ? renderGearPaperdoll(c.gear) : "") +
      (hasCards ? '<div class="gearwrap scard-panel" id="scardJump">' + cardsHtml + "</div>" : "");
  }


  // Stufe ≥ 60 = Endgame-Auto. Rahmen-Toggle kann Levelrun/Endgame erzwingen.
  function isEndgameLevel(level) {
    return level != null && +level >= 60;
  }
  var FRAME_PREF = "auto"; // auto | levelrun | endgame
  function isEndgameFrame() {
    if (FRAME_PREF === "endgame") return true;
    if (FRAME_PREF === "levelrun") return false;
    return isEndgameLevel(CHAR && CHAR.level);
  }
  function frameLabel() {
    return isEndgameFrame() ? "Endgame" : "Levelrun";
  }
  function fmtStatPct(n) {
    return String(Number(n).toFixed(2)).replace(".", ",");
  }
  // Melee-Hit-Caps aus dem Charakterfenster (kein erfundener Wert).
  var HIT_CAP_BOSS = 8;
  var HIT_CAP_PVP = 5;

  function charIssues(ids) {
    if (!CHAR) return [];
    var c = CHAR, s = c.stats, out = [];
    var endgame = isEndgameFrame();
    var p = profile(ids);
    var best = scorePaths(p)[0];
    var have = PATHBY[normPath(c.path)];

    function push(sev, title, body) {
      out.push('<div class="issue ' + sev + '"><b>' + esc(title) + "</b>" + body + "</div>");
    }

    // 1. Ungenutzte Essence - das ist reiner, sofort abrufbarer Schaden.
    if (c.essA > 0 || c.essT > 0) {
      var bits = [];
      if (c.essA > 0) bits.push(c.essA + " Ability Essence");
      if (c.essT > 0) bits.push(c.essT + " Talent Essence");
      push("krit", "Du hast noch " + bits.join(" und ") + " übrig",
        " Das ist Schaden, den du geschenkt bekommst, sobald du sie ausgibst. " +
        (endgame
          ? "Auch auf Stufe 60: freie Essence vor Feinschliff am Gear."
          : "Nichts an deinem Build ist wichtiger als das."));
    }
    if (c.essASpent !== undefined || c.essTSpent !== undefined) {
      push("ok", "Essence ausgegeben: AE " + (c.essASpent || 0) +
        " · TE " + (c.essTSpent || 0),
        " Gemessen aus dem Addon (AS/TS). Freie Essence steht darüber.");
    }
    if (c.essAExpect !== undefined) {
      var gotA = (c.essASpent || 0) + (c.essA || 0);
      if (gotA < c.essAExpect) {
        push("info", "AE unter Level-Soll",
          " Erwartet " + c.essAExpect + " für Stufe " + (c.level || "?") +
          ", gemessen " + gotA + " (ausgegeben + frei).");
      } else {
        push("ok", "AE-Soll für Stufe " + (c.level || "?") + ": " + c.essAExpect,
          " Gemessen " + gotA + " (ausgegeben + frei).");
      }
    }
    if (c.locked && c.locked.length) {
      push("ok", c.locked.length + " gesperrte Einträge",
        " Die bleiben beim Umskillen liegen — der Generator fasst sie nicht an.");
    }
    if (c.desire && c.desire.length) {
      push("ok", c.desire.length + " Desire-Einträge",
        " Der Generator nimmt sie bevorzugt.");
    }
    if (c.undesire && c.undesire.length) {
      push("info", c.undesire.length + " Undesire-Einträge",
        " Der Generator lässt sie aus.");
    }
    if (c.suggest && c.suggest.length) {
      var sug = c.suggest.join(", ");
      var mineP = normPath(c.path);
      var sugHit = c.suggest.some(function (x) {
        return normPath(x) === mineP;
      });
      push(sugHit ? "ok" : "info", "Path-Vorschlag: " + esc(sug),
        sugHit
          ? " Dein Path steht in der Addon-Empfehlung."
          : " Das Addon empfiehlt andere Paths als den aktuellen.");
    }
    if (isDraftChar(c)) {
      push("info", "Draft-Modus aktiv",
        " Build ist Draft — die Auswahl kann noch begrenzt sein.");
    }
    if (c.scardPend !== undefined && c.scardPend > 0) {
      push("info", c.scardPend + " Skill Cards ausstehend",
        " Im Spiel noch nicht eingelöst.");
    }
    if (hasMode(c, "WILDCARD") || (c.scard && c.scard.length) ||
        (c.desire && c.desire.length) || (c.wc && Object.keys(c.wc).length)) {
      var nCard = (c.carded || []).length;
      var nSlot = (c.scard || []).filter(function (s) { return !s.blocked; }).length;
      var wcNote = "";
      if (c.wc) {
        if (c.wc.CanRoll === 1) wcNote += " Kann rollen.";
        if (c.wc.AwaitTalent === 1) wcNote += " Talent-Upgrade-Roll steht aus.";
      }
      push("ok", "Wildcard" + (modeLabel(c) ? " (" + esc(modeLabel(c)) + ")" : ""),
        (nSlot ? " " + nSlot + " Skill-Card-Slots belegt." : "") +
        (nCard ? " " + nCard + " Zauber auf Karten — Vorschläge bevorzugen diese." : "") +
        (nSlot || nCard
          ? " Die Karten siehst du rechts unter Ausrüstung / Skill Cards."
          : "") +
        wcNote);
    }

    // 1b. Ueber dem Seltenheits-Budget: so ist der Build im Spiel nicht baubar.
    var over = [];
    for (var q = 4; q >= 1; q--) {
      var lim = qualityLimit(q);
      if (lim && USE[q] > lim) {
        over.push(QN[q] + " " + USE[q] + " / " + lim);
      }
    }
    if (over.length) {
      push("krit", "Über dem Seltenheits-Budget",
        " " + over.join(", ") + ". Ascension begrenzt nicht nur die Plätze, " +
        "sondern auch, wie viel Seltenheit ein Build tragen darf — im Spiel " +
        "ließe sich das so nicht lernen. Tausche die überzähligen gegen " +
        "niedrigere Qualitäten.");
    }

    // 2. Path gegen Build.
    //    Schweregrad nach Punkteabstand: liegt der aktuelle Path dicht dran,
    //    ist das eine Feinjustierung und kein Alarm.
    if (have && best && have.k !== best.k) {
      var want = PATHBY[best.k];
      var all = scorePaths(p);
      var mine = 0;
      all.forEach(function (x) { if (x.k === have.k) mine = x.v; });
      var duaCore = have.k === "dua" && p.wm >= 2;
      var close = best.v > 0 && mine >= best.v * (duaCore ? 0.7 : 0.75);

      if (duaCore) {
        push("fix",
          close
            ? "Ein anderer Path liegt knapp vorn — Duality bleibt passend"
            : "Duality bleibt der Hybridkern, ein anderer Path hat mehr Punkte",
          " Du spielst <b>" + esc(have.n) + "</b> (Spell Power ×" +
          String(have.sp).replace(".", ",") + "). Dein Build hat " + p.wm +
          "× Waffenschaden als Element — das ist genau Duality, nicht unpassend. " +
          "Die Punktzahl spricht für <b>" + esc(want.n) + "</b> (×" +
          String(want.sp).replace(".", ",") + "): " + esc(best.why) + ". " +
          pathGain(want, have, p) +
          " Abstand " + mine + " gegen " + best.v + " Punkte.");
      } else {
        push(close ? "fix" : "krit",
          close ? "Ein anderer Path würde besser passen"
                : "Dein Path passt nicht zu deinem Build",
          " Du spielst <b>" + esc(have.n) + "</b> (Spell Power ×" +
          String(have.sp).replace(".", ",") + "), dein Build spricht für <b>" +
          esc(want.n) + "</b> (×" + String(want.sp).replace(".", ",") + "): " +
          esc(best.why) + ". " + pathGain(want, have, p) +
          (close ? " Der Abstand ist klein (" + mine + " gegen " + best.v +
                   " Punkte) — das ist Feinschliff, kein Notfall."
                 : ""));
      }
    } else if (have) {
      push("ok", "Path passt",
        " <b>" + esc(have.n) + "</b> ist auch das, was dein Build verlangt: " +
        esc(best ? best.why : "") + ".");
    } else if (c.path) {
      push("fix", "Path nicht erkannt",
        " Das Addon meldet „" + esc(c.path) + "“. Das lässt sich keinem der fünf Paths " +
        "zuordnen — die Empfehlung oben ignoriert deinen aktuellen Path deshalb.");
    }

    // 3. Heilbuild ohne Heilpath und umgekehrt
    if (have && have.k === "heal" && p.hPrimary === 0) {
      push("krit", "Path of Healing ohne einen klaren Heilzauber",
        " Der Path rechnet deine Spell Power in Healing Power um. Wenn nichts " +
        "wirklich heilt, verschenkst du den kompletten Path-Bonus.");
    }
    if (have && have.k !== "heal" && p.hPrimary >= 5) {
      push("fix", p.hPrimary + " klare Heilzauber, aber nicht auf Path of Healing",
        " Ohne diesen Path wird deine Spell Power nie in Healing Power umgerechnet. " +
        "Deine Heilung skaliert dadurch deutlich schlechter als dein Schaden.");
    }

    // 4. Attributverteilung gegen den Path
    if (have && s) {
      var str = s.STR || 0, agi = s.AGI || 0, int = s.INT || 0;
      if (have.k === "int" && (str > int || agi > int)) {
        push("fix", "Dein höchstes Attribut passt nicht zum Path",
          " Path of Intelligence lebt von Intellect (" + Math.round(int) +
          "), dein Gear gibt dir aber mehr Strength (" + Math.round(str) +
          ") beziehungsweise Agility (" + Math.round(agi) + ").");
      }
      if (have.k === "str" && agi > str) {
        push("fix", "Mehr Agility als Strength auf Path of Strength",
          " Der Path skaliert über Strength. Mit " + Math.round(agi) +
          " Agility gegen " + Math.round(str) + " Strength wäre Path of Agility " +
          "im Moment der bessere Griff.");
      }
      if (have.k === "agi" && str > agi) {
        push("fix", "Mehr Strength als Agility auf Path of Agility",
          " Umgekehrt derselbe Fall: " + Math.round(str) + " gegen " +
          Math.round(agi) + ".");
      }
      if ((have.k === "int" || have.k === "dua") && (s.SP || 0) === 0) {
        push("krit", "Kein Spell Power auf einem Path, der ihn verdoppelt",
          " " + esc(have.n) + " multipliziert Spell Power aus Items mit " +
          String(have.sp).replace(".", ",") + ". Bei 0 bleibt das wirkungslos.");
      }
    }

    // 5. Welchen der beiden Path-Boni bekommst du gerade?
    var mh = c.weapons.filter(function (w) { return w.slot === "MH"; })[0];
    if (have && mh) {
      var twoH = /2HWEAPON/i.test(mh.loc);
      push("ok", twoH ? "Du trägst Zweihand" : "Du trägst Einhand",
        " Aktiv ist damit: " + (twoH ? have.twoH : have.oneH) +
        " Der andere Bonus wäre: " + (twoH ? have.oneH : have.twoH));
    }
    if (!mh || mh.name === "-") {
      push("krit", "Keine Waffe in der Haupthand",
        " Ohne Waffe skaliert kein einziger deiner Waffenangriffe. Auch die " +
        "Path-Boni greifen erst mit einer Waffe.");
    }

    // 5b. Ressourcen. Auf Ascension existieren alle Pools gleichzeitig -
    //     wer von Retail kommt, erwartet das nicht.
    //     Kosten kennt die Client-DBC, was etwas EINBRINGT steht nur im
    //     Beschreibungstext - beide Quellen laufen hier zusammen.
    var pools = {}, gens = {};
    ids.forEach(function (i) {
      var m = MC[i];
      if (m && m.cost && m.res) pools[m.res] = (pools[m.res] || 0) + 1;
      ((SC[i] || {}).gen || []).forEach(function (g) {
        gens[g[1]] = (gens[g[1]] || 0) + 1;
      });
    });
    var pn = Object.keys(pools);

    // Mana und Energie fuellen sich von allein wieder auf, Wut und
    // Runenmacht nicht. Nur dort ist ein fehlender Generator ein Problem.
    var SELF_REFILL = { Mana: 1, Energie: 1, Fokus: 1 };
    var dry = pn.filter(function (r) { return !SELF_REFILL[r] && !gens[r]; });
    if (dry.length) {
      push("krit", dry.join(" und ") + " ohne Generator",
        " Dein Build gibt " + dry.map(function (r) {
          return pools[r] + "× " + r;
        }).join(" und ") + " aus, hat aber nichts, das sie auffüllt. " +
        dry.join(" und ") +
        (dry.length === 1 ? " regeneriert" : " regenerieren") +
        " nicht von selbst — ohne Generator stehst du nach den ersten Sekunden " +
        "mit leerer Leiste da.");
    }

    if (pn.length > 1) {
      push("ok", "Dein Build zieht aus " + pn.length + " Ressourcen",
        " " + pn.map(function (r) {
          return pools[r] + "× " + r + (gens[r] ? " (" + gens[r] + " Generator" +
            (gens[r] > 1 ? "en" : "") + ")" : "");
        }).join(", ") +
        ". Das ist auf Ascension kein Fehler: alle Pools existieren " +
        "gleichzeitig nebeneinander.");
    }

    // 6. Hit - direkt aus dem Client-Tooltip (kein erfundener Spell-Hit-Cap)
    if (s && (p.w + p.phys) > 0) {
      if (s.HITPCT !== undefined) {
        var hitPct = +s.HITPCT;
        var hitGap = HIT_CAP_BOSS - hitPct;
        var capNote = " Charakterfenster: " + HIT_CAP_BOSS +
          " % gegen Raidboss, " + HIT_CAP_PVP + " % PVP.";
        if (hitPct < HIT_CAP_BOSS) {
          var hitBody = " Import " + fmtStatPct(hitPct) + " %";
          if (s.HITRATING !== undefined) {
            hitBody += " (Rating " + Math.round(s.HITRATING) + ")";
          }
          hitBody += ", fehlen " + fmtStatPct(hitGap) + " % zum Raidboss-Cap." + capNote;
          push(endgame ? "krit" : "fix", "Melee-Hit unter Raidboss-Cap", hitBody);
        } else {
          push("ok", "Melee-Hit am Raidboss-Cap",
            " Import " + fmtStatPct(hitPct) + " %" +
            (s.HITRATING !== undefined
              ? " (Rating " + Math.round(s.HITRATING) + ")."
              : ".") + capNote);
        }
      } else if (s.HITRATING !== undefined && s.HITRATING === 0) {
        push(endgame ? "krit" : "fix", "0 Hit Rating",
          " Dein Charakterfenster sagt: " + HIT_CAP_BOSS +
          " % Trefferchance brauchst du, um gegen einen Raidboss nie zu verfehlen, " +
          HIT_CAP_PVP + " % gegen Spieler. Bei 0 Rating verpufft ein Teil deiner " +
          "Angriffe komplett.");
      }
    }
    if (s && p.m > 0 && s.SHITPCT !== undefined) {
      push("info", "Spell Hit gemessen",
        " Import " + fmtStatPct(+s.SHITPCT) +
        " % — kein Spell-Hit-Cap in den Daten; nur der gemessene Wert aus dem " +
        "Charakterfenster.");
    }

    // 7. Leere Slots
    if (c.gear.length) {
      var filled = {};
      c.gear.forEach(function (g) { filled[g.slot] = true; });
      var missing = ALL_GEAR_SLOTS.filter(function (k) { return !filled[k]; });
      if (missing.length) {
        push("fix", missing.length +
          (missing.length === 1 ? " leerer Ausrüstungsplatz"
                                : " leere Ausrüstungsplätze"),
          " " + missing.map(function (k) {
            return GEAR_LABEL[k] || k;
          }).join(", ") + ". Jeder davon ist Spell Power oder ein " +
          "Attribut, das du nicht bekommst.");
      }
    }

    // 8. Plaetze nicht ausgereizt — nur wenn noch Essence da ist, mit der
    //    man sie fuellen koennte. 22/30 bei AE 0 ist Levelrun-Normal, kein
    //    „Build leer“-Befund. Ohne ESSENCE-Zeile: nur bei wirklich leerer Liste.
    var cnt = counts();
    var free = [];
    var freeA = MAX_A - cnt.a;
    var freeT = MAX_T - cnt.t;
    var canFillA = freeA > 0 && (c.essA !== undefined ? c.essA > 0 : cnt.a === 0);
    var canFillT = freeT > 0 && (c.essT !== undefined ? c.essT > 0 : cnt.t === 0);
    if (canFillA) free.push(freeA + " Ability-Plätze");
    if (canFillT) free.push(freeT + " Talent-Plätze");
    if (free.length) {
      push("fix", free.join(" und ") + " frei",
        " Du hast noch Essence dafür. Ein leerer Platz gibt dir nichts — " +
        "selbst ein mittelmäßiger Eintrag schlägt ihn.");
    }

    // 9. Katalogluecken ehrlich benennen
    if (UNMATCHED.length) {
      push("fix", UNMATCHED.length +
        (UNMATCHED.length === 1 ? " Eintrag nicht im Katalog gefunden"
                               : " Einträge nicht im Katalog gefunden"),
        " " + UNMATCHED.slice(0, 8).map(esc).join(", ") +
        (UNMATCHED.length > 8 ? " …" : "") +
        (UNMATCHED.length === 1
          ? ". Der fehlt in der Analyse — der Katalog stammt aus dem " +
            "Season-10-Export und kennt ihn nicht."
          : ". Die fehlen in der Analyse — der Katalog stammt aus dem " +
            "Season-10-Export und kennt sie nicht."));
    }

    // 10. Waffen-% aus Tooltips vs. nur Waffen-Tag (kein erfundener Coeff)
    var wf = weaponBareScalingFlags(ids);
    if (wf.scaled.length) {
      push("ok", wf.scaled.length + " mit gemessenem Waffen-%",
        " Tooltip nennt eine Prozentzahl in scaling.json — die Skalierung " +
        "unter Auswertung nutzt deinen Import-Waffenschaden.");
    }
    if (wf.bare.length) {
      push("info", wf.bare.length +
        (wf.bare.length === 1
          ? " Waffen-Eintrag ohne Tooltip-%"
          : " Waffen-Einträge ohne Tooltip-%"),
        " Tag sagt Waffenbezug, aber in scaling.json fehlt w — " +
        "Prozent fehlt, kein Koeffizient erfunden. " +
        wf.bare.slice(0, 6).map(function (i) { return CAT[i][0]; }).map(esc)
          .join(", ") +
        (wf.bare.length > 6 ? " …" : "") + ".");
    }
    if (c.weapons && c.weapons.length) {
      var missDbc = c.weapons.filter(function (w) {
        return w.itemId && !wpnLookup(w.itemId);
      });
      if (missDbc.length && WPN) {
        push("info", "Waffen-DBC unvollständig",
          " Für " + missDbc.map(function (w) { return w.name; }).map(esc)
            .join(", ") +
          " fehlt der Eintrag in weapons.json (Seed/Export) — " +
          "Import-DPS und ilvl bleiben die Quelle.");
      } else if (!WPN) {
        push("info", "Waffen-DBC fehlt",
          " data/weapons.json ist nicht eingebettet — nur der WEAPON-Import " +
          "zählt. pipeline/weapons.py gegen die Item-DBCs laufen lassen.");
      }
    }

    // 11. ilvl / Waffen-Mid gegen ItemStat-Stufenband (D.ilb, 10–60)
    if (c.level && ILB) {
      var Lband = ilvlBandAt(c.level);
      if (c.ilvl > 0 && Lband && Lband.ilvl) {
        var iv = bandVerdict(c.ilvl, Lband.ilvl, "ilvl");
        if (iv === "low") {
          push("warn", "Gegenstandsstufe unter dem Stufenband",
            " Import " + c.ilvl.toFixed(1) + " bei Stufe " + c.level +
            " (Median " + Lband.ilvl.p50 + "). " +
            (endgame
              ? "Fürs Endgame lohnt sich stärkeres Gear — Band ist Anhalt, kein BiS."
              : "Für den Levelrun lohnt sich frisches Gear aus Quests/Dungeons."));
        } else if (iv === "ok" || iv === "high") {
          push("ok", "Gegenstandsstufe passt zur Stufe",
            " " + c.ilvl.toFixed(1) + " ilvl · ItemStat-Median " +
            Lband.ilvl.p50 + " für Stufe " + c.level +
            (endgame ? " (Endgame-Anhalt)." : "."));
        }
      }
      var mhIss = (c.weapons || []).filter(function (w) {
        return w.slot === "MH";
      })[0];
      if (mhIss) {
        var midIss = weaponMidDamage(mhIss);
        var keyIss = weaponBandKey(mhIss);
        var wbIss = keyIss && Lband && Lband[keyIss];
        var wv = bandVerdict(midIss, wbIss, "wpn");
        if (!keyIss) {
          /* Distanz als MH untypisch — still */
        } else if (wv === "low") {
          push("warn", "Hauptwaffe unter dem Mid-Schaden-Band",
            " Mid " + (midIss != null ? midIss.toFixed(0) : "?") +
            " gegen Median " + (wbIss ? wbIss.p50 : "?") +
            " (ItemStat " + keyIss +
            "). Bei Waffen-%-Builds zuerst die Waffe tauschen.");
        } else if (wv === "ok" || wv === "high") {
          push("ok", "Hauptwaffe im Stufenband",
            " Mid " + midIss.toFixed(0) + " · Median " + wbIss.p50 +
            " für Stufe " + c.level + ".");
        } else if (!wbIss) {
          push("info", "Kein Waffen-Stufenband",
            " Für Stufe " + c.level + " fehlt das ItemStat-" +
            keyIss + "-Band — Import-DPS bleibt die Quelle.");
        }
      }
    } else if (c.ilvl > 0 && !ILB) {
      push("info", "ilvl-Band nicht eingebettet",
        " Gegenstandsstufe " + c.ilvl.toFixed(1) +
        " ohne Vergleich — pipeline/ilvlbands.py + assemble.");
    }

    // 12. SP/AP aus Tooltips vs. Flat ohne Koeffizient (kein erfundener Coeff)
    var spHit = [], apHit = [], flatNo = [];
    ids.forEach(function (i) {
      var sc = SC[i];
      if (!sc) return;
      if (sc.sp || sc.spb) spHit.push(i);
      if (sc.ap || sc.apb) apHit.push(i);
      if (sc.flat && !sc.w && !(sc.sp || sc.spb || sc.ap || sc.apb)) {
        flatNo.push(i);
      }
    });
    if (spHit.length) {
      push("ok", spHit.length +
        (spHit.length === 1 ? " mit gemessenem Spell-Power-Anteil"
                            : " mit gemessenem Spell-Power-Anteil"),
        " Tooltip nennt SP (Prozent oder „Anteil fehlt“). " +
        spHit.slice(0, 5).map(function (i) { return CAT[i][0]; }).map(esc)
          .join(", ") +
        (spHit.length > 5 ? " …" : "") + ".");
    }
    if (apHit.length) {
      push("ok", apHit.length +
        (apHit.length === 1 ? " mit gemessenem Attack-Power-Anteil"
                            : " mit gemessenem Attack-Power-Anteil"),
        " Tooltip nennt AP. " +
        apHit.slice(0, 5).map(function (i) { return CAT[i][0]; }).map(esc)
          .join(", ") +
        (apHit.length > 5 ? " …" : "") + ".");
    }
    if (flatNo.length) {
      push("info", flatNo.length +
        (flatNo.length === 1
          ? " Flat-Eintrag ohne SP-/AP-Anteil"
          : " Flat-Einträge ohne SP-/AP-Anteil"),
        " Grundschaden steht im Tooltip, der Koeffizient fehlt — " +
        "kein Prozent erfunden. " +
        flatNo.slice(0, 6).map(function (i) { return CAT[i][0]; }).map(esc)
          .join(", ") +
        (flatNo.length > 6 ? " …" : "") + ".");
    }
    // SpellStatSuggestions: Intelligence-Codes bei Magie → Path-Hinweis, kein Coeff
    if (SSUG && SSUG.path) {
      var intSug = ids.filter(function (i) {
        return ssugPathLabel(i) === "Intelligence";
      });
      var magNoSp = ids.filter(function (i) {
        var f = pathFlags(i), sc = SC[i] || {};
        return f.m && !f.w && !(sc.sp || sc.spb);
      });
      if (intSug.length && magNoSp.length) {
        push("info", intSug.length +
          "× SpellStatSuggestions „Intelligence“",
        " DBC-Path-Code für Magie/Schulen — kein SP-Koeffizient. " +
          "Path of Intelligence multipliziert Item-SP ×2; " +
          magNoSp.length +
          " Magie-Einträge ohne Tooltip-SP-% bleiben ehrlich ohne Zahl.");
      }
    }

    return out;
  }


  // Was der empfohlene Path konkret besser macht als der aktuelle.
  // Bewusst je Ziel-Path formuliert - ein Satz ueber "Multiplikatoren"
  // hilft niemandem beim Umskillen.
  function pathGain(want, have, p) {
    if (want.sp > have.sp) {
      return "Der Wechsel hebt deine Spell Power um Faktor " +
        (want.sp / have.sp).toFixed(2).replace(".", ",") +
        " — und weil 14 Spell Power = 1 Waffen-DPS sind, wächst damit auch " +
        "dein Waffenschaden.";
    }
    if (want.k === "dua") {
      return "Du verlierst zwar Spell-Power-Multiplikator, bekommst dafür drei " +
        "Dinge, die genau deinem Build fehlen: Attack Power in Höhe deines " +
        "besseren Attributs, Intellect zählt auf Melee-Crit (und Agility auf " +
        "Spell-Crit), und Zaubern setzt deinen Autoangriff nicht mehr zurück. " +
        "Bei " + p.wm + " Angriffen, die Waffenschaden als Element austeilen, " +
        "trifft dich jeder dieser drei Punkte.";
    }
    if (want.k === "heal") {
      return "Nur dieser Path rechnet deine Spell Power überhaupt in Healing " +
        "Power um. Ohne ihn heilst du mit dem Rohwert.";
    }
    if (want.k === "str") {
      return "Strength gibt dir hier Attack Power und Parry obendrauf — das ist " +
        "der Motor, aus dem rein physische Angriffe ihren Schaden ziehen.";
    }
    if (want.k === "agi") {
      return "Agility ist das einzige Attribut, das Crit-Chance und Crit-Schaden " +
        "gleichzeitig hebt. Für einen Build, der auf Crits baut, zählt das mehr " +
        "als jeder Spell-Power-Multiplikator.";
    }
    return "";
  }

  function normPath(name) {
    var n = String(name || "").toLowerCase();
    if (n.indexOf("dual") >= 0) return "dua";
    if (n.indexOf("intel") >= 0) return "int";
    if (n.indexOf("heal") >= 0 || n.indexOf("spirit") >= 0) return "heal";
    if (n.indexOf("agi") >= 0) return "agi";
    if (n.indexOf("str") >= 0) return "str";
    return "";
  }

  function renderIssues(ids) {
    var box = document.getElementById("issues");
    var hd = document.getElementById("cI");
    var list = charIssues(ids);
    if (!CHAR) {
      hd.textContent = "—"; hd.className = "cnt";
      hd.removeAttribute("data-krit");
      hd.removeAttribute("data-fix");
      box.innerHTML = emptyState(
        "Importiere deinen Charakter mit <code>/bs</code>.",
        "<p>Dann steht hier, was kritisch ist und was du verbessern kannst — " +
          "Path, Essence, Budget, Skill Cards und Hit für <b>Levelrun</b> " +
          "und <b>Endgame</b>.</p>");
      return;
    }
    function issueKind(html) {
      var m = String(html || "").match(/class="issue\s+([a-z]+)"/);
      return m ? m[1] : "";
    }
    var krit = list.filter(function (h) { return issueKind(h) === "krit"; }).length;
    // verbesserbar = info/fix/warn — nicht nur fix, nie ok
    var fix = list.filter(function (h) {
      var k = issueKind(h);
      return k === "info" || k === "fix" || k === "warn";
    }).length;
    hd.innerHTML =
      '<a class="jumplink" href="#issues-krit" data-jump="issues-krit" ' +
      'title="Zu kritischen Befunden springen">' + krit + " kritisch</a>" +
      '<span class="jumpsep"> · </span>' +
      '<a class="jumplink" href="#issues-fix" data-jump="issues-fix" ' +
      'title="Zu verbesserbaren Befunden springen">' + fix + " verbesserbar</a>";
    // info/fix/warn = verbesserbar (amber), nicht ok/grün
    hd.className = "cnt " + (krit ? "over" : fix ? "warn" : "ok");
    hd.setAttribute("data-krit", String(krit));
    hd.setAttribute("data-fix", String(fix));
    var lead = '<div class="qhint">' +
      (isEndgameFrame()
        ? "Befund für <b>Endgame</b>: Path, Essence, Budget und Hit wiegen " +
          "schwer — ItemStat-Band Stufe 60 ist Anhalt, kein Raid-BiS."
        : "Befund für den <b>Levelrun</b>: Path, Essence, Budget und Skill " +
          "Cards aus deinem Import.") +
      "</div>";
    var kritH = [], fixH = [], restH = [];
    list.forEach(function (h) {
      var kind = issueKind(h);
      if (kind === "krit") kritH.push(h);
      else if (kind === "info" || kind === "fix" || kind === "warn") fixH.push(h);
      else restH.push(h);
    });
    var buried = fixH.slice(3).concat(restH);
    box.innerHTML = lead +
      '<div id="issues-krit" class="issue-block" tabindex="-1">' +
        kritH.join("") + "</div>" +
      '<div id="issues-fix" class="issue-block" tabindex="-1">' +
        fixH.slice(0, 3).join("") +
        (buried.length
          ? wrapDetails(buried.join(""), "Weitere Hinweise (" + buried.length + ")")
          : "") +
      "</div>";
    box.setAttribute("data-jump-ready", "1");
  }

  // ---------- Bedienung ----------
  document.getElementById("bPaste").addEventListener("click", function () {
    var ta = document.getElementById("pasteBox");
    var d = parseExport(ta.value);
    if (!d) {
      toast("Das sieht nicht nach einem Export aus");
      return;
    }
    var hit = applyImport(d);
    refresh();
    toast(hit + " Einträge übernommen" +
      (d._idMatched ? " (" + d._idMatched + " per ID)" : "") +
      (UNMATCHED.length ? ", " + UNMATCHED.length + " unbekannt" : ""));
    document.getElementById("charBox").scrollIntoView({ behavior: "smooth",
      block: "start" });
  });

  document.getElementById("bPasteClear").addEventListener("click", function () {
    document.getElementById("pasteBox").value = "";
    CHAR = null; UNMATCHED = [];
    refresh();
  });

  // ---------- Reiter ----------
  function activateTab(b) {
    var bar = b.parentNode;
    [].forEach.call(bar.children, function (x) {
      x.classList.remove("on");
      x.setAttribute("aria-selected", "false");
      x.tabIndex = -1;
    });
    b.classList.add("on");
    b.setAttribute("aria-selected", "true");
    b.tabIndex = 0;
    var host = bar.parentNode;
    [].forEach.call(host.querySelectorAll(":scope > .tabp"), function (p) {
      p.classList.toggle("on", p.id === b.dataset.tab);
    });
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest(".tab");
    if (b) activateTab(b);
  });
  // Pfeiltasten innerhalb einer Reiterleiste, wie es sich gehoert.
  document.addEventListener("keydown", function (e) {
    var b = e.target.closest && e.target.closest(".tab");
    if (!b) return;
    var sibs = [].filter.call(b.parentNode.children, function (x) {
      return x.classList && x.classList.contains("tab") && !x.hidden;
    });
    var i = sibs.indexOf(b);
    var next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = sibs[(i + 1) % sibs.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = sibs[(i - 1 + sibs.length) % sibs.length];
    else if (e.key === "Home") next = sibs[0];
    else if (e.key === "End") next = sibs[sibs.length - 1];
    if (!next) return;
    e.preventDefault();
    activateTab(next);
    next.focus();
  });
  [].forEach.call(document.querySelectorAll(".tabp"), function (p) {
    p.setAttribute("role", "tabpanel");
  });
  [].forEach.call(document.querySelectorAll(".tab"), function (t) {
    t.setAttribute("aria-selected", t.classList.contains("on") ? "true" : "false");
    t.tabIndex = t.classList.contains("on") ? 0 : -1;
  });

  // ---------- Skalierung ----------
  // SC[i] kommt aus den Tooltip-Texten. Was dort nicht steht, steht auch
  // hier nicht - geraten wird nichts.

  var HAND = { mh: "Haupthand", oh: "Nebenhand", ranged: "Distanz", any: "Waffe" };

  function badges(i) {
    var o = SC[i] || {};
    var show = [];
    var more = [];
    var a = archOf[i];
    if (a) show.push('<span class="bdg" title="Archetyp">' + esc(a) + "</span>");
    var sug = ssugPathLabel(i);
    if (sug) {
      show.push('<span class="bdg s" title="Path-Hinweis aus SpellStatSuggestions — nicht die PrimaryStat-ID">' +
        esc(sug) + "</span>");
    }
    if (DES && !isDesireEligIdx(i)) {
      show.push('<span class="bdg r" title="Nicht auf dem Wildcard-Desire-Board / Rapid Roll">kein Desire</span>');
    }
    if (o.w) {
      show.push('<span class="bdg w">' + fmt(o.w) + " % " +
        (o.wh === "any" ? "Waffe" : HAND[o.wh]) + "</span>");
    }
    if (o.sch) show.push('<span class="bdg s">' + esc(schoolDe(o.sch)) + "</span>");
    else if (o.fsch) show.push('<span class="bdg s">' + esc(schoolDe(o.fsch)) + "</span>");
    if (o.ap) {
      show.push('<span class="bdg w" title="Attack-Power-Anteil aus dem Tooltip">' +
        fmt(o.ap) + " % AP</span>");
    } else if (o.apb) {
      show.push('<span class="bdg w" title="Tooltip nennt Attack Power, Prozent fehlt">' +
        "AP · Anteil fehlt</span>");
    }
    if (o.sp) {
      show.push('<span class="bdg w" title="Spell-Power-Anteil aus dem Tooltip">' +
        fmt(o.sp) + " % SP</span>");
    } else if (o.spb) {
      show.push('<span class="bdg w" title="Tooltip nennt Spell Power, Prozent fehlt">' +
        "SP · Anteil fehlt</span>");
    }
    if (o.flat && !(o.tick && o.tick === o.flat[0] && o.flat[0] === o.flat[1])) {
      more.push('<span class="bdg f">' + fmt(o.flat[0]) +
        (o.flat[1] !== o.flat[0] ? "–" + fmt(o.flat[1]) : "") + "</span>");
    }
    if (o.heal) {
      more.push('<span class="bdg f">Heil ' + fmt(o.heal[0]) +
        (o.heal[1] !== o.heal[0] ? "–" + fmt(o.heal[1]) : "") + "</span>");
    }
    if (o.healpct) {
      more.push('<span class="bdg f">Heil ' + fmt(o.healpct) + " % Max</span>");
    }
    if (o.absorb) {
      more.push('<span class="bdg f">Absorb ' + fmt(o.absorb[0]) +
        (o.absorb[1] !== o.absorb[0] ? "–" + fmt(o.absorb[1]) : "") +
        (o.asch ? " " + esc(schoolDe(o.asch)) : "") + "</span>");
    }
    if (o.dot) more.push('<span class="bdg d">' + o.dot + " s</span>");
    if (o.tick) more.push('<span class="bdg d">' + fmt(o.tick) + "/s</span>");
    (o.inc || []).forEach(function (x) {
      more.push('<span class="bdg m">+' + fmt(x[0]) + " % " + esc(short(x[1])) + "</span>");
    });
    (o.red || []).forEach(function (x) {
      more.push('<span class="bdg f">−' + fmt(x[0]) + " % " + esc(short(x[1])) + "</span>");
    });
    (o.gen || []).forEach(function (g) {
      more.push('<span class="bdg g">+' +
        (g[0] < 0 ? -g[0] + " % " : g[0] + " ") + esc(g[1]) + "</span>");
    });
    if (o.echo) {
      more.push('<span class="bdg p" title="Anteil vom verursachten Schaden (Tooltip)">' +
        fmt(o.echo[0]) + " % Echo" +
        (o.echo[1] ? " " + esc(o.echo[1]) : "") + "</span>");
    }
    if (o.relpct) {
      more.push('<span class="bdg p" title="Anteil einer anderen Fähigkeit (Tooltip)">' +
        fmt(o.relpct) + " %" +
        (o.relsrc ? " von " + esc(short(o.relsrc)) : "") + "</span>");
    }
    if (o.stk) more.push('<span class="bdg p">' + o.stk + " Stapel</span>");
    if (o.proc) {
      more.push('<span class="bdg p">' + fmt(o.proc) + " % Proc</span>");
    } else if (METH_GAP[i] && METH_GAP[i].why === "proc_ohne_schaden") {
      more.push('<span class="bdg p" title="Methoden: Proc ohne Schadenszahl">' +
        "Proc · Zahl fehlt</span>");
    } else if (MC[i] && MC[i].proc) {
      more.push('<span class="bdg p" title="Proc-Chance aus Spell.dbc (Tooltip schweigt)">' +
        fmt(MC[i].proc) + " % Proc</span>");
    }
    var rel = relBadgeItems(i);
    var mech = mechBadgeItems(i);
    var chips = verwandteHtml(i, 4, true);
    // Ein .bdgs — CSS clampt auf eine Zeile, Hover/Auswahl klappt auf.
    var all = rel.show.concat(mech.show, show, more, mech.more, rel.more);
    if (chips) all.push(chips);
    return all.length ? '<span class="bdgs">' + all.join("") + "</span>" : "";
  }

  // Vererbung, Voraussetzung, gemeinsamer GCD/CD — nur wenn die Daten sie setzen.
  function relBadgeItems(i) {
    var show = [], more = [];
    var base = inheritBase(i);
    if (base !== null && base !== undefined && CAT[base]) {
      more.push('<span class="bdg m" title="Schulvariante erbt die Talente von ' +
        esc(CAT[base][0]) + ' — die Basis muss nicht in deinem Build stehen.">' +
        "erbt Talente von " + esc(short(CAT[base][0])) + "</span>");
    }
    var need = REL[i] && REL[i][1];
    if (need !== null && need !== undefined && CAT[need]) {
      show.push('<span class="bdg r" title="Ohne diese Fähigkeit bleibt der Effekt inaktiv.">' +
        "braucht " + esc(short(CAT[need][0])) + "</span>");
    }
    if (REL[i] && REL[i][3] >= 0) {
      show.push('<span class="bdg c" title="Schulvarianten derselben Fähigkeit teilen sich einen GCD — nicht parallel stapelbar.">gleicher GCD</span>');
    }
    if (REL[i] && REL[i][5] >= 0) {
      more.push('<span class="bdg c" title="' +
        esc(CDG[REL[i][5]] || "gemeinsamer Cooldown") + '">geteilter CD</span>');
    }
    var refs = (REL[i] && REL[i][2]) || [];
    if (CAT[i][1] === 1 && refs.length) {
      more.push('<span class="bdg m" title="Dein Tooltip nennt ' + refs.length +
        " Fähigkeit" + (refs.length === 1 ? "" : "en") + '.">wirkt auf ' +
        refs.length + "</span>");
    }
    return { show: show, more: more };
  }

  function fmt(n) {
    return String(Math.round(n * 10) / 10).replace(".", ",");
  }
  function short(s) {
    s = String(s);
    return s.length > 26 ? s.slice(0, 25) + "…" : s;
  }

  // Passt ein Eintrag zum Skalierungsfilter?
  function scaleMatch(i, mode) {
    var o = SC[i];
    if (!mode) return true;
    if (mode === "cd" || mode === "nocd" || mode === "free") {
      return mechMatch(i, mode);
    }
    if (!o) return false;
    if (mode === "w") return !!o.w;
    if (mode === "s") return !!(o.sch || o.fsch);
    if (mode === "m") return !!(o.inc && o.inc.length);
    if (mode === "h") return !!o.heal;
    if (mode === "d") return !!(o.dot || o.tick);
    if (mode === "g") return !!(o.gen && o.gen.length);
    if (mode === "sp") return !!(o.sp || o.spb);
    if (mode === "ap") return !!(o.ap || o.apb);
    if (mode === "cd" || mode === "nocd" || mode === "free") {
      return mechMatch(i, mode);
    }
    return true;
  }

  // ---------- Mechanik aus der Client-DBC ----------
  // MC[i] kommt aus Spell.dbc, ueber die echte Spell-ID zugeordnet.
  // Diese Werte stehen in keinem Tooltip: die Textauswertung fand 12
  // Cooldowns, die DBC kennt 797.

  function mechBadgeItems(i) {
    var m = MC[i];
    var show = [], more = [];
    if (!m) return { show: show, more: more };
    if (m.cd) show.push('<span class="bdg c">CD ' + secs(m.cd) + "</span>");
    if (m.cast) more.push('<span class="bdg c">' + fmt(m.cast) + " s Cast</span>");
    else if (m.cd || m.cost || m.range) more.push('<span class="bdg c">sofort</span>');
    if (m.ch) {
      more.push('<span class="bdg c">' + m.ch + " Ladung" +
        (m.ch === 1 ? "" : "en") + "</span>");
    }
    if (m.chr) {
      more.push('<span class="bdg c">Aufladung ' + secs(m.chr) + "</span>");
    }
    if (m.cost) show.push('<span class="bdg r">' + fmt(m.cost) + " " + esc(m.res) + "</span>");
    if (m.range) more.push('<span class="bdg f">' + m.range + " m</span>");
    // DBC-Wirkdauer — getrennt vom Tooltip-DoT (o.dot), kein doppeltes Abzeichen
    // wenn beide dieselbe Sekundenzahl nennen.
    if (m.dur) {
      var tipDot = SC[i] && SC[i].dot;
      if (!tipDot || tipDot !== m.dur) {
        more.push('<span class="bdg d" title="Wirkdauer aus Spell.dbc">Wirkdauer ' +
          secs(m.dur) + "</span>");
      }
    }
    return { show: show, more: more };
  }
  function secs(v) {
    if (v >= 60) {
      var mn = v / 60;
      return (mn === Math.round(mn) ? mn : fmt(mn)) + " min";
    }
    return fmt(v) + " s";
  }

  // Schaden pro Cooldown-Zyklus. Erst mit echten Cooldowns ueberhaupt
  // rechenbar - und ehrlich genug, weil beide Zahlen gemessen sind:
  // der Waffenschaden aus deinem Charakterfenster, der Cooldown aus der DBC.
  function perCycle(i) {
    var m = MC[i], s = SC[i];
    if (!m || !m.cd || !s || !s.w) return 0;
    var e = estHit(i);
    return e ? e / m.cd : 0;
  }

  function mechMatch(i, mode) {
    var m = MC[i] || {};
    if (mode === "cd") return !!m.cd;
    if (mode === "nocd") return !m.cd;
    if (mode === "free") return !m.cost;
    return true;
  }

  // ---------- Reiter "Skalierung" ----------
  function renderScale(ids) {
    var box = document.getElementById("scalebox");
    var hd = document.getElementById("cS");
    if (!ids.length) {
      hd.textContent = "—"; hd.className = "cnt";
      box.innerHTML = emptyState(
        "Wähle etwas aus.",
        "<p>Dann steht hier, woraus dein Schaden kommt.</p>");
      return;
    }

    var o = [];
    // Pro Hand den eigenen Durchschnitt. Was nicht importiert wurde,
    // wird auch nicht geschaetzt.
    function wepOf(tag) {
      return CHAR && CHAR.weapons.filter(function (w) { return w.slot === tag; })[0];
    }
    function avgOf(w) {
      if (!w || !w.dmg) return 0;
      var m = String(w.dmg).match(/(\d+)\s*-\s*(\d+)/);
      return m ? (+m[1] + +m[2]) / 2 : 0;
    }
    var wep = wepOf("MH"), wepOH = wepOf("OH"), wepR = wepOf("RANGED");
    var avg = avgOf(wep), avgOH = avgOf(wepOH), avgR = avgOf(wepR);
    function baseFor(hand) {
      if (hand === "oh") return avgOH;
      if (hand === "ranged") return avgR;
      return avg;
    }

    // 0. Import-Waffe vs. Item-DBC (wpn) + Stufenband (ilb)
    if (wep || wepOH || wepR) {
      o.push('<div class="schd">Waffe (Import + DBC)</div>');
      if (CHAR && CHAR.level && ILB) {
        o.push('<div class="scsum"><b>Stufenband ' + CHAR.level + "</b>" +
          "Mid = Import-Schaden (min+max)/2 bzw. DPS×Tempo. " +
          "Vergleich gegen ItemStat-Perzentile — ohne AP/SP-Koeffizienten.</div>");
      } else if (!ILB) {
        o.push('<div class="scsum"><b>Stufenband fehlt</b>' +
          "ilvlbands.json nicht eingebettet — nur Import und Item-DBC.</div>");
      }
      [wep, wepOH, wepR].forEach(function (w) {
        if (!w) return;
        o.push('<div class="scrow"><span class="nm">' + esc(w.name) +
          '</span><span class="val">' +
          (weaponExportDps(w) ? weaponExportDps(w).toFixed(1) + " DPS"
                              : "DPS fehlt") +
          '</span><span class="sub">' +
          esc(weaponEvidenceHtml(w, CHAR && CHAR.level)) +
          (CHAR && CHAR.level
            ? "<br>" + weaponLevelBandHtml(w, CHAR.level)
            : "") +
          "</span></div>");
      });
      if (CHAR && CHAR.ilvl) {
        o.push('<div class="scrow"><span class="nm">Gegenstandsstufe</span>' +
          '<span class="val">' + CHAR.ilvl.toFixed(1) + "</span>" +
          '<span class="sub">' + ilvlBandHtml(CHAR) + "</span></div>");
      }
    }

    // 1. Waffenangriffe, nach geschaetztem Treffer sortiert
    var hits = ids.filter(function (i) { return SC[i] && SC[i].w; })
      .map(function (i) {
        var base = baseFor(SC[i].wh);
        return { i: i, pct: SC[i].w, hand: SC[i].wh,
                 est: base ? base * SC[i].w / 100 : 0 };
      })
      .sort(function (a, b) { return (b.est - a.est) || (b.pct - a.pct); });

    var bareW = ids.filter(function (i) {
      return (TAG[i] || 0) & T_WEAPON && !(SC[i] && SC[i].w);
    });
    if (bareW.length) {
      o.push('<div class="scsum"><b>' + bareW.length +
        " ohne Waffen-% im Tooltip</b>" +
        "Tag „Waffe“, aber scaling.json hat kein `w` — Prozent fehlt, " +
        "kein Koeffizient erfunden: " +
        bareW.slice(0, 8).map(function (i) { return CAT[i][0]; }).map(esc)
          .join(", ") +
        (bareW.length > 8 ? " …" : "") + ".</div>");
    }

    if (hits.length) {
      if (avg) {
        o.push('<div class="scsum"><b>Grundlage</b>' +
          esc(wep.name) + " macht " + esc(wep.dmg) + " Schaden pro Treffer " +
          "(Durchschnitt " + Math.round(avg) + ")" +
          (avgOH ? ", Nebenhand " + Math.round(avgOH) : "") +
          (avgR ? ", Distanz " + Math.round(avgR) : "") +
          ". Darin stecken deine Attack Power und deine Spell Power bereits " +
          "drin — der Client rechnet beide im Verhältnis 14 : 1 in den " +
          "Waffenschaden ein. Crit, Haste und die Rüstung des Ziels sind " +
          "<em>nicht</em> eingerechnet.</div>");
      } else {
        o.push('<div class="scsum"><b>Ohne Import nur Prozente</b>' +
          "Importiere deinen Charakter, dann werden aus den Prozenten echte " +
          "Zahlen — mit deinem Waffenschaden gerechnet.</div>");
      }
      o.push('<div class="schd">Waffenangriffe</div>');
      hits.forEach(function (h) {
        var s = SC[h.i];
        var cyc = perCycle(h.i);
        var missing = !h.est && avg &&
          (h.hand === "oh" || h.hand === "ranged");
        o.push('<div class="scrow"><span class="nm">' + esc(CAT[h.i][0]) + "</span>" +
          '<span class="val">' + (h.est ? Math.round(h.est) + " Schaden"
                                        : fmt(h.pct) + " %") + "</span>" +
          '<span class="sub">' + fmt(s.w) + " % " +
          (s.wh === "any" ? "Waffenschaden" : HAND[s.wh] + "-Schaden") +
          (s.sch ? " als " + esc(s.sch) + " — ignoriert Armor"
                 : " — physisch, wird von Armor reduziert") +
          (missing ? ". Keine " + (h.hand === "oh" ? "Nebenhandwaffe" : "Distanzwaffe") +
                     " im Import — deshalb hier nur der Prozentsatz."
                   : "") +
          (cyc ? ". Alle " + secs(MC[h.i].cd) + " verfügbar — das sind " +
                 Math.round(cyc) + " Schaden pro Sekunde, wenn du ihn auf " +
                 "Cooldown hältst."
               : "") + "</span></div>");
      });
    }

    // 2. Multiplikatoren aus den gewaehlten Talenten
    var mult = [];
    ids.forEach(function (i) {
      (SC[i] && SC[i].inc || []).forEach(function (x) {
        if (x[2] === "dmg" || x[2] === "heal") mult.push({ i: i, p: x[0], w: x[1], k: x[2] });
      });
    });
    mult.sort(function (a, b) { return b.p - a.p; });
    if (mult.length) {
      var sum = mult.reduce(function (t, x) { return t + x.p; }, 0);
      o.push('<div class="schd">Multiplikatoren in deinem Build</div>');
      o.push('<div class="scsum"><b>Zusammen +' + fmt(sum) + " %</b>" +
        "Achtung: das ist die reine Summe. Ob Ascension diese Boni addiert oder " +
        "multipliziert, steht in keinem Tooltip — bei Multiplikation fällt das " +
        "Ergebnis höher aus, bei Überschneidungen niedriger.</div>");
      mult.slice(0, 12).forEach(function (x) {
        o.push('<div class="scrow"><span class="nm">' + esc(CAT[x.i][0]) + "</span>" +
          '<span class="val">+' + fmt(x.p) + " %</span>" +
          '<span class="sub">auf ' + esc(x.w) + "</span></div>");
      });
    }

    // 2b. Spell Power / Attack Power — nur gemessene Tooltip-Anteile
    var spRows = [], apRows = [];
    ids.forEach(function (i) {
      var s = SC[i];
      if (!s) return;
      if (s.sp || s.spb) spRows.push(i);
      if (s.ap || s.apb) apRows.push(i);
    });
    if (spRows.length || apRows.length) {
      o.push('<div class="schd">Spell Power / Attack Power (Tooltip)</div>');
      o.push('<div class="scsum"><b>Nur was im Text steht</b>' +
        "Prozent kommt wörtlich aus dem Tooltip. „Anteil fehlt“ heißt: der " +
        "Text nennt SP/AP, aber keine Prozentzahl — dann wird nichts erfunden.</div>");
      spRows.forEach(function (i) {
        var s = SC[i];
        o.push('<div class="scrow"><span class="nm">' + esc(CAT[i][0]) + "</span>" +
          '<span class="val">' +
          (s.sp ? fmt(s.sp) + " % SP"
                : "SP · Anteil fehlt") +
          '</span><span class="sub">aus dem Tooltip' +
          (s.sp && s.ap && s.sp === s.ap
            ? " — höherer Wert aus AP oder SP (max)"
            : "") +
          "</span></div>");
      });
      apRows.forEach(function (i) {
        var s = SC[i];
        // Doppelzeile vermeiden, wenn schon unter SP mit gleichem %-Wert
        if (s.sp && s.ap && s.sp === s.ap && spRows.indexOf(i) >= 0) return;
        o.push('<div class="scrow"><span class="nm">' + esc(CAT[i][0]) + "</span>" +
          '<span class="val">' +
          (s.ap ? fmt(s.ap) + " % AP"
                : "AP · Anteil fehlt") +
          '</span><span class="sub">aus dem Tooltip</span></div>');
      });
    }

    // 3. Flat-Damage ehrlich als Luecke ausweisen
    var flat = ids.filter(function (i) {
      return SC[i] && SC[i].flat && !SC[i].w;
    });
    var flatGap = flat.filter(function (i) {
      var s = SC[i];
      return !(s.sp || s.spb || s.ap || s.apb);
    });
    if (flat.length) {
      o.push('<div class="schd">Fester Grundschaden</div>');
      o.push('<div class="scsum"><b>' + flat.length + " Einträge mit fester Zahl</b>" +
        (flatGap.length
          ? " Bei " + flatGap.length + " davon fehlt der SP-/AP-Anteil im Tooltip — " +
            "die Zahlen unten sind der <em>Grundwert ohne dein Gear</em>."
          : " Was Spell Power hier draufrechnet, steht in keinem dieser Tooltips. " +
            "Die Zahlen unten sind der <em>Grundwert ohne dein Gear</em> — dein " +
            "tatsächlicher Schaden liegt darüber.") +
        "</div>");
      flat.slice(0, 10).forEach(function (i) {
        var s = SC[i];
        var gap = !(s.sp || s.spb || s.ap || s.apb);
        o.push('<div class="scrow"><span class="nm">' + esc(CAT[i][0]) + "</span>" +
          '<span class="val">' + s.flat[0] +
          (s.flat[1] !== s.flat[0] ? "–" + s.flat[1] : "") + "</span>" +
          '<span class="sub">' + (s.fsch ? esc(s.fsch) : "physisch") +
          (s.dot ? ", über " + s.dot + " s" : "") +
          (gap ? " · SP/AP-Anteil fehlt" : "") +
          "</span></div>");
      });
    }

    var n = hits.length + mult.length + spRows.length + apRows.length;
    hd.textContent = n ? String(n) : "—";
    hd.className = "cnt " + (n ? "ok" : "");
    if (!o.length) {
      box.innerHTML = emptyState(
        "Keine Zahl in den Tooltips deiner Auswahl.",
        "<p>Das heißt nicht, dass sie nicht skalieren — es steht nur nicht im Text.</p>");
      return;
    }
    var preview = [], rest = [], rowsSeen = 0;
    o.forEach(function (html) {
      var isRow = html.indexOf('class="scrow"') >= 0;
      if (isRow) rowsSeen++;
      if (rest.length || (isRow && rowsSeen > 5)) rest.push(html);
      else preview.push(html);
    });
    box.innerHTML = preview.join("") +
      (rest.length
        ? wrapDetails(rest.join(""), "Weitere Skalierung (" + rest.length + ")")
        : "");
  }

  // ---------- Seltenheits-Budget ----------
  // Ascension begrenzt nicht nur Plaetze, sondern auch Seltenheit. Ohne die
  // Zahlen aus dem Spiel kennen wir nur die Verteilung, nicht die Grenze -
  // dann wird angezeigt statt blockiert.

  var QUAL_KEY = { uncommon: 1, rare: 2, epic: 3, legendary: 4 };

  // QOWN: echte Kosten/Qualität pro spellId; sonst Katalog + Einheits-qcost.
  function entryQual(i) {
    var sid = SID[i];
    var o = CHAR && CHAR.qown && sid && CHAR.qown[sid];
    if (o && o.q >= 1 && o.q <= 4) return o.q;
    return CAT[i][3];
  }
  function entryCost(i) {
    var sid = SID[i];
    var o = CHAR && CHAR.qown && sid && CHAR.qown[sid];
    if (o && o.cost > 0) return o.cost;
    return qualityCost(entryQual(i));
  }
  function qualityUse(ids) {
    var u = [0, 0, 0, 0, 0];
    ids.forEach(function (i) { u[entryQual(i)] += entryCost(i); });
    return u;
  }
  // Kosten je Stufe: nur wenn das Addon einen einheitlichen Wert gemessen hat.
  function qualityCost(q) {
    var c = CHAR && CHAR.qcost && CHAR.qcost[q];
    return (typeof c === "number" && c > 0) ? c : 1;
  }
  function qualityLimit(q) {
    return CHAR && CHAR.qlimit && CHAR.qlimit[q];
  }
  // Der Verbrauch aendert sich nur, wenn sich die Auswahl aendert.
  // Einmal pro refresh() ausrechnen statt einmal pro geprueftem Eintrag.
  var USE = [0, 0, 0, 0, 0];
  function recountBudget() {
    USE = qualityUse(Object.keys(picked).map(Number));
  }
  function overBudget(i) {
    var q = entryQual(i);
    var lim = qualityLimit(q);
    if (!lim) return false;
    return USE[q] + entryCost(i) > lim;
  }

  function renderBudget() {
    var box = document.getElementById("budget");
    if (!box) return;
    recountBudget();
    var use = USE;
    var any = false;
    var o = [];
    for (var q = 4; q >= 1; q--) {
      var lim = qualityLimit(q);
      if (!lim) continue;
      any = true;
      var over = use[q] > lim;
      var pct = Math.min(100, use[q] / lim * 100);
      var hint = over ? "über dem Budget" : "im Budget";
      o.push('<div class="qrow ' + (over ? "danger" : "good") +
        '" title="' + QN[q] + " " + use[q] + " / " + lim + " — " + hint +
        '"><span class="qn" style="color:var(--q' + q + ')">' +
        QN[q] + '</span><span class="qbar"><i style="width:' + pct +
        '%"></i></span><span class="qv">' + use[q] + " / " + lim + "</span></div>");
    }
    if (!any) {
      box.innerHTML = emptyHint(
        "Seltenheits-Budget unbekannt.",
        '<p><a href="#t=vTools">Charakter importieren</a> (<code>/bs</code>), ' +
          "dann wird hier mitgezählt. Im Spiel darfst du nicht beliebig viele " +
          "Epics und Legendaries tragen.</p>");
      return;
    }
    box.innerHTML = o.join("");
  }

  // ---------- Levelsperre ----------
  function tooHigh(i) {
    return CHAR && CHAR.level ? (CAT[i][4] || 0) > CHAR.level : false;
  }

  // ---------- Vorschlaege: was fehlt dem Build noch? ----------
  // Umkehrindex zu BM: welches Talent verbessert welche Basis?
  var MODOF = {};
  Object.keys(BM).forEach(function (base) {
    BM[base].forEach(function (t) {
      (MODOF[t] = MODOF[t] || []).push(+base);
    });
  });

  function suggest(ids) {
    if (!ids.length) return [];
    var have = {}; ids.forEach(function (i) { have[i] = 1; });

    // Welche Basen deckt der Build ab - eigene Faehigkeiten und die Basen
    // ihrer Varianten.
    var bases = {};
    ids.forEach(function (i) {
      bases[i] = 1;
      var b = inheritBase(i);
      if (b !== null && b !== undefined) bases[b] = 1;
    });

    // Was nennen meine Talente, das ich nicht habe?
    var wanted = {};
    ids.forEach(function (i) {
      (REL[i][2] || []).forEach(function (j) { if (!have[j]) wanted[j] = (wanted[j] || 0) + 1; });
    });

    // SpellSpellSuggestions: stärkste Verwandten-Kante Build → Kandidat (Gewicht aus DBC).
    var fromRel = {};
    ids.forEach(function (src) {
      ssugspPairs(src).forEach(function (p) {
        if (have[p.j]) return;
        var cur = fromRel[p.j];
        if (!cur || p.w > cur.w) fromRel[p.j] = { src: src, w: p.w };
      });
    });

    // Welcher Archetyp dominiert?
    var acount = {};
    ids.forEach(function (i) {
      var a = archOf[i];
      if (a) acount[a] = (acount[a] || 0) + 1;
    });
    var topArch = Object.keys(acount).sort(function (a, b) {
      return acount[b] - acount[a];
    })[0];

    var mine = CHAR ? normPath(CHAR.path) : "";
    var dupHave = {};
    ids.forEach(function (i) { if (REL[i][3] >= 0) dupHave[REL[i][3]] = 1; });

    var cnt = counts();
    var out = [];

    for (var i = 0; i < CAT.length; i++) {
      if (have[i]) continue;
      var isTal = CAT[i][1] === 1;
      if (isTal && cnt.t >= MAX_T) continue;
      if (!isTal && cnt.a >= MAX_A) continue;

      var score = 0, why = null;

      // a) Talent, das eine meiner Basen verbessert - der staerkste Grund
      var mods = MODOF[i] || [];
      var hitBase = mods.filter(function (b) { return bases[b]; });
      if (hitBase.length) {
        score += 6;
        why = "verbessert <b>" + esc(CAT[hitBase[0]][0]) + "</b>, das dein Build nutzt";
      }

      // b) eines meiner Talente nennt es, ich habe es aber nicht
      if (wanted[i]) {
        score += 5 + Math.min(wanted[i], 3);
        why = why || (wanted[i] === 1
          ? "eines deiner Talente verbessert es — es fehlt dir aber"
          : wanted[i] + " deiner Talente verbessern es — es fehlt dir aber");
      }

      // c) es nennt etwas, das ich habe
      var refs = (REL[i][2] || []).filter(function (j) { return have[j]; });
      if (refs.length) {
        score += 3;
        why = why || ("nennt <b>" + esc(CAT[refs[0]][0]) + "</b> aus deinem Build");
      }

      // d) Verwandt laut SpellSpellSuggestions (D.ssugsp) — Gewicht nicht neu rechnen
      if (fromRel[i]) {
        score += 4 + Math.min(Math.floor(fromRel[i].w / 50), 3);
        why = why || ("verwandt mit <b>" + esc(CAT[fromRel[i].src][0]) + "</b>");
      }

      if (!score) continue;

      // Abwertungen: was im Spiel gar nicht ginge
      if (REL[i][3] >= 0 && dupHave[REL[i][3]]) continue;      // Dublette
      if (tooHigh(i)) continue;                                 // Level zu hoch
      if (overBudget(i)) continue;                              // Budget voll
      var gate = REL[i][4];
      if (gate && gate[0] === "Path" && mine &&
          normPath(gate[1]) && normPath(gate[1]) !== mine) continue;

      if (topArch && archOf[i] === topArch) score += 1;
      if (CAT[i][3] >= 3) score += 1;                           // Epic+ etwas hoeher
      if (isCardedIdx(i)) score += 3;                           // Skill-Card bevorzugen
      if (isDesiredIdx(i)) score += 4;                          // Desire bevorzugen
      if (isUndesiredIdx(i)) continue;                          // Undesire auslassen
      if (isLockedIdx(i) && !have[i]) score += 5;               // gelockt und fehlt → rein
      // Desire-Board-fähig (Katalog / rollgate): Rapid-Roll-Kandidaten leicht bevorzugen
      if (isDesireEligIdx(i)) score += 1;
      else score -= 2; // kein Desire / rollgate.blocked — nicht vorschlagen priorisieren

      out.push({ i: i, s: score, why: why, gate: gate });
    }

    out.sort(function (a, b) { return b.s - a.s || CAT[b.i][3] - CAT[a.i][3]; });
    return out.slice(0, 10);
  }

  function renderSuggest(ids) {
    var box = document.getElementById("sugbox");
    var hd = document.getElementById("cV");
    if (!box) return;
    var list = suggest(ids);
    hd.textContent = list.length ? String(list.length) : "—";
    hd.className = "cnt " + (list.length ? "ok" : "");

    if (!ids.length) {
      box.innerHTML = emptyState(
        "Wähle etwas.",
        "<p>Dann schlägt die Seite vor, was dazu passt.</p>");
      return;
    }
    if (!list.length) {
      box.innerHTML = emptyState(
        "Kein Vorschlag.",
        "<p>Entweder passt schon alles zusammen, oder deine Plätze sind voll.</p>");
      return;
    }
    function sugRow(x) {
      return '<div class="sug" data-add="' + x.i + '" role="button" tabindex="0">' +
        '<span class="icon" style="width:26px;height:26px;flex:0 0 26px;' +
        iconStyle(x.i, 26) + '"></span>' +
        '<span class="sugb"><span class="nm q' + CAT[x.i][3] +
        '">' + esc(CAT[x.i][0]) + "</span>" +
        '<span class="sugwhy">' + x.why + "</span></span>" +
        '<span class="sugadd">+</span></div>';
    }
    var shown = list.slice(0, 3).map(sugRow).join("");
    var more = list.slice(3).map(sugRow).join("");
    box.innerHTML = shown +
      (more
        ? wrapDetails(more, "Weitere Vorschläge (" + (list.length - 3) + ")")
        : "") +
      wrapDetails(
        '<div class="qhint">Aus Tooltip-Verweisen' +
        (SSUGSP ? " und SpellSpellSuggestions (Verwandte)" : "") +
        " deiner Auswahl abgeleitet. Dubletten, zu hohe Stufen, gesperrte Paths " +
        "und volles Seltenheits-Budget sind schon aussortiert.</div>",
        "Wie die Vorschläge entstehen");
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-add]");
    if (b) toggle(+b.dataset.add);
  });

  // Vorschlags- und Vergleichszeilen sind keine <button>, tragen aber
  // role="button" und tabindex. Ohne diesen Handler waeren sie mit der
  // Tastatur erreichbar, aber nicht bedienbar - schlimmer als gar nicht
  // fokussierbar, weil der Screenreader sie als Schaltflaeche ansagt.
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (!e.target.closest) return;
    var b = e.target.closest('[data-add][role="button"]');
    if (!b) return;
    e.preventDefault();
    toggle(+b.dataset.add);
  });

  // ---------- Build-Generator ----------
  // Baut aus dem gesamten Katalog einen vollstaendigen Build zu einer
  // Ausrichtung. Kein Zufall und kein Sprachmodell: jeder Eintrag wird
  // gegen die vorhandenen Daten bewertet, und jede Aufnahme laesst sich
  // begruenden. Was im Spiel nicht ginge, kommt gar nicht erst in Frage.
  //
  // Form-Familien: D.frm (formtags.py) zuerst, sonst Name+Beschreibung.
  // Kein Coeff-Raten, keine DBC-Shapeshift-IDs. Eine Kampf-Form, eine
  // Presence, eine Kriegerhaltung — nicht drei. Shared GCD und
  // Talentvererbung bleiben eigene Regeln, nicht Form-Identität.

  var FORM_DE = {
    bear: "Bärenform", cat: "Katzenform", moonkin: "Moonkin-Form",
    tree: "Baumform", worgen: "Worgen-Form", travel: "Reiseform",
    serpent: "Schlangenform", humanoid: "ohne Form",
    presence_blood: "Blood Presence", presence_frost: "Frost Presence",
    presence_unholy: "Unholy Presence", warrior_stance: "Kriegerhaltung",
    shadowform: "Shadowform", meta: "Metamorphosis", ghostwolf: "Ghost Wolf",
    ushift: "in jeder Form"
  };
  // Katze, Bär und Worgen sind eigene Kampf-Familien — die Form selbst
  // nicht mischen. Worgen erlaubt Cat-Fähigkeiten, nicht die Katzenform.
  var FORM_EXCL = { cat: 1, bear: 1, worgen: 1 };
  var FORM_COMBAT = {
    bear: 1, cat: 1, moonkin: 1, tree: 1, worgen: 1, serpent: 1, meta: 1
  };
  var FORM_STANCE_GROUP = {
    presence_blood: "presence", presence_frost: "presence",
    presence_unholy: "presence", warrior_stance: "warrior_stance",
    shadowform: "shadowform", meta: "meta", ghostwolf: "ghostwolf"
  };
  var FORM_GRANT_RX = /^(dire )?bear form$|^cat form$|^moonkin form$|^tree of (life|wrath)$|^worgen form$|^travel form$|^aquatic form$|^flight form$|^serpent form$|^shadowform$|^metamorphosis$|^ghost wolf$|^(blood|frost|unholy) presence$|^(battle|defensive|berserker) stance$/i;
  var FORM_SHAPE_OK_RX = /usable while shapeshifted|can be used while shapeshifted/i;
  var FORM_PATS = [
    { rx: /dire bear form|bear form/i, f: "bear" },
    { rx: /cat form/i, f: "cat" },
    { rx: /moonkin form|\bmoonkin\b/i, f: "moonkin" },
    { rx: /tree of life|tree of wrath|tree form/i, f: "tree" },
    { rx: /worgen form|\bworgen\b/i, f: "worgen" },
    { rx: /travel form|aquatic form|flight form/i, f: "travel" },
    { rx: /serpent form/i, f: "serpent" },
    { rx: /shadowform/i, f: "shadowform" },
    { rx: /\bmetamorphosis\b/i, f: "meta" },
    { rx: /ghost wolf/i, f: "ghostwolf" },
    { rx: /blood presence/i, f: "presence_blood" },
    { rx: /frost presence/i, f: "presence_frost" },
    { rx: /unholy presence/i, f: "presence_unholy" },
    { rx: /battle stance/i, f: "warrior_battle" },
    { rx: /defensive stance/i, f: "warrior_def" },
    { rx: /berserker stance/i, f: "warrior_berserker" }
  ];
  // Katalognamen klassischer Form-Fähigkeiten — Tooltip nennt die Form oft nicht.
  var FORM_STEMS = [
    { rx: /\b(rake|rip|shred|ferocious bite|prowl|pounce|ravage|cower|tiger'?s fury)\b/i, f: ["cat"] },
    { rx: /\b(maul|lacerate|frenzied regeneration|challenging roar|demoralizing roar|pulverize)\b/i, f: ["bear"] },
    { rx: /\b(mangle|berserk)\b/i, f: ["cat", "bear"] }
  ];
  var FORM_CACHE = [];
  var FORM_BUSY = [];

  function formDe(f) {
    return FORM_DE[f] || f || "ohne Form";
  }
  function formNormTag(f) {
    if (f === "stance_battle") return "warrior_battle";
    if (f === "stance_defensive") return "warrior_def";
    if (f === "stance_berserker") return "warrior_berserker";
    return f;
  }
  function formNormWarrior(f) {
    f = formNormTag(f);
    if (f === "warrior_battle" || f === "warrior_def" || f === "warrior_berserker") {
      return "warrior_stance";
    }
    return f;
  }
  function formWarriorVariant(f) {
    f = formNormTag(f);
    if (f === "warrior_battle") return "battle";
    if (f === "warrior_def") return "def";
    if (f === "warrior_berserker") return "berserker";
    return "";
  }
  function formIsCombat(f) {
    return !!(f && FORM_COMBAT[f]);
  }
  function formIsUtility(f) {
    return f === "travel";
  }
  function formCompat(primary, other) {
    if (!primary || !other || primary === other) return true;
    // Worgen Form: Cat-Fähigkeiten ja — Katze/Bär/Worgen-Form selbst exclusiv.
    if (primary === "worgen" && other === "cat") return true;
    return false;
  }
  function formGrantClash(primary, family) {
    if (!primary || !family || primary === family) return false;
    if (FORM_EXCL[primary] && FORM_EXCL[family]) return true;
    return formIsCombat(primary) && formIsCombat(family);
  }
  function formPresenceKey(have) {
    if (/blood/.test(have)) return "presence_blood";
    if (/frost/.test(have)) return "presence_frost";
    if (/unholy/.test(have)) return "presence_unholy";
    return have;
  }
  function formMatchesHave(info, have) {
    if (!have) return true;
    if (info.variant && info.variant === have) return true;
    if (info.family === have) return true;
    var ai;
    for (ai = 0; ai < info.allow.length; ai++) {
      if (info.allow[ai] === have || formCompat(have, info.allow[ai])) return true;
    }
    return false;
  }
  function formPushAllow(allow, f) {
    f = formNormWarrior(f);
    if (!f || f === "humanoid") return;
    if (allow.indexOf(f) < 0) allow.push(f);
  }
  function emptyFormInfo() {
    return {
      family: "humanoid",
      allow: [],
      require: false,
      strong: false,
      grants: false,
      shapeshiftOk: false,
      humanoidOnly: false,
      stanceGroup: null,
      variant: "",
      utility: false
    };
  }

  // Eine Familie aus D.frm (formtags.py), sonst Name+Beschreibung.
  // Mehrfach erlaubt (Mangle = Katze+Bär) landet in allow[]; family ist
  // der stabile Vertreter. ushift = nutzbar in der gewählten Kampf-Form.
  function formInfo(i) {
    if (FORM_CACHE[i]) return FORM_CACHE[i];
    if (FORM_BUSY[i]) return emptyFormInfo();
    FORM_BUSY[i] = 1;
    var info = emptyFormInfo();
    var rec = CAT[i];
    if (!rec) {
      FORM_CACHE[i] = info;
      FORM_BUSY[i] = 0;
      return info;
    }
    var name = String(rec[0] || "");
    var desc = String(rec[5] || "");
    var blob = name + "\n" + desc;
    var req = [];
    var mention = [];
    var rawAllow = [];
    var grantFamily = "";

    info.shapeshiftOk = FORM_SHAPE_OK_RX.test(blob);

    function pushReq(f) {
      formPushAllow(req, f);
      info.require = true;
      info.strong = true;
    }
    function pushMention(f) {
      formPushAllow(mention, f);
      info.strong = true;
    }

    // D.frm ist die primäre Familienquelle (formtags.py). Leer = Fallback.
    var tagStr = (i < FRM.length && FRM[i]) ? String(FRM[i]) : "";
    var tagged = tagStr.length > 0;
    var tagFams = [];
    var tagRaw = [];
    if (tagged) {
      var parts = tagStr.split("+");
      var tp, tcode, tmapped;
      for (tp = 0; tp < parts.length; tp++) {
        tcode = parts[tp];
        if (!tcode) continue;
        if (tcode === "ushift") {
          info.shapeshiftOk = true;
          continue;
        }
        if (tcode === "humanoid") {
          info.humanoidOnly = true;
          continue;
        }
        tmapped = formNormTag(tcode);
        if (!tmapped || tmapped === "ushift" || tmapped === "humanoid") continue;
        tagRaw.push(tmapped);
        formPushAllow(tagFams, tmapped);
      }
      if (tagFams.length) info.humanoidOnly = false;
    }

    var paren = /\((cat|bear|feral)(?:\s+form)?\)/i.exec(name);
    if (paren) {
      var pk = paren[1].toLowerCase();
      if (pk === "feral") {
        pushReq("cat");
        pushReq("bear");
      } else {
        pushReq(pk);
      }
    }

    if (FORM_GRANT_RX.test(name.replace(/\s+/g, " ").trim())) {
      var gi, gf;
      for (gi = 0; gi < FORM_PATS.length; gi++) {
        if (FORM_PATS[gi].rx.test(name)) {
          gf = formNormWarrior(FORM_PATS[gi].f);
          pushReq(gf);
          rawAllow.push(FORM_PATS[gi].f);
          grantFamily = gf;
          info.grants = rec[1] === 0;
          break;
        }
      }
    } else {
      var nj, nf;
      for (nj = 0; nj < FORM_PATS.length; nj++) {
        if (FORM_PATS[nj].rx.test(name)) {
          nf = formNormWarrior(FORM_PATS[nj].f);
          pushReq(nf);
          rawAllow.push(FORM_PATS[nj].f);
        }
      }
    }

    // Pflicht nur bei „only usable“ oder „can be used in A or B“ (Mangle).
    // „Usable in Bear Form“ (Conduit) ist ein Bonus, kein Zwang.
    var only = /only usable while in ([^.]+)/i.exec(desc);
    var canUseOr = /can be used in ([^.]+)/i.exec(desc);
    var usableIn = /usable in ([^.]+)/i.exec(desc);
    var whileIn = /usable while in ([^.]+)/i.exec(desc);
    function absorbPhrase(phrase, asRequire) {
      if (!phrase) return;
      var pi;
      for (pi = 0; pi < FORM_PATS.length; pi++) {
        if (FORM_PATS[pi].rx.test(phrase)) {
          if (asRequire) pushReq(FORM_PATS[pi].f);
          else pushMention(FORM_PATS[pi].f);
        }
      }
    }
    absorbPhrase(only && only[1], true);
    absorbPhrase(canUseOr && canUseOr[1], true);
    absorbPhrase(usableIn && usableIn[1], false);
    absorbPhrase(whileIn && whileIn[1], false);
    var bi;
    for (bi = 0; bi < FORM_PATS.length; bi++) {
      if (FORM_PATS[bi].rx.test(blob)) pushMention(FORM_PATS[bi].f);
    }

    // Stems nur wenn D.frm keine konkrete Familie nennt (Rake/Rip/…).
    if (!tagFams.length && !req.length) {
      var si, sj, stemHits;
      for (si = 0; si < FORM_STEMS.length; si++) {
        if (FORM_STEMS[si].rx.test(name)) {
          stemHits = FORM_STEMS[si].f;
          for (sj = 0; sj < stemHits.length; sj++) pushReq(stemHits[sj]);
        }
      }
    }

    // Form-Identität ≠ Talentvererbung: inheritBase nur ohne D.frm-Tag.
    if (!tagged && !req.length && !mention.length) {
      var base = inheritBase(i);
      if (base !== null && base !== undefined && base !== i) {
        var parent = formInfo(base);
        if (parent.allow && parent.allow.length) {
          var pa;
          for (pa = 0; pa < parent.allow.length; pa++) {
            if (parent.require) pushReq(parent.allow[pa]);
            else pushMention(parent.allow[pa]);
          }
          if (parent.shapeshiftOk) info.shapeshiftOk = true;
          if (parent.humanoidOnly && !tagFams.length) info.humanoidOnly = true;
        }
      }
    }

    var allow = tagFams.length
      ? tagFams.slice()
      : (req.length ? req.slice() : mention.slice());
    info.allow = allow;
    if (grantFamily) info.family = grantFamily;
    else if (allow.length === 1) info.family = allow[0];
    else if (allow.length > 1) {
      var pref = ["bear", "cat", "moonkin", "tree", "worgen", "serpent", "meta",
        "shadowform", "presence_blood", "presence_frost", "presence_unholy",
        "warrior_stance", "ghostwolf", "travel"];
      var pr;
      info.family = allow[0];
      for (pr = 0; pr < pref.length; pr++) {
        if (allow.indexOf(pref[pr]) >= 0) { info.family = pref[pr]; break; }
      }
    }
    info.utility = formIsUtility(info.family);
    info.stanceGroup = FORM_STANCE_GROUP[info.family] || null;
    if (tagRaw.length) {
      var tr, tv;
      for (tr = 0; tr < tagRaw.length; tr++) {
        tv = formWarriorVariant(tagRaw[tr]);
        if (tv) { info.variant = tv; break; }
      }
    }
    if (!info.variant && rawAllow.length) {
      info.variant = formWarriorVariant(rawAllow[0]);
    } else if (!info.variant && info.family === "warrior_stance") {
      var wv;
      for (wv = 0; wv < FORM_PATS.length; wv++) {
        if (/warrior_/.test(FORM_PATS[wv].f) && FORM_PATS[wv].rx.test(blob)) {
          info.variant = formWarriorVariant(FORM_PATS[wv].f);
          break;
        }
      }
    }

    FORM_CACHE[i] = info;
    FORM_BUSY[i] = 0;
    return info;
  }

  function formFamily(i) {
    return formInfo(i).family;
  }

  var THEMES = [
    {
      k: "ele", n: "Elementarer Waffenkämpfer",
      d: "Waffenangriffe, die als Feuer, Frost oder Natur zählen. Ignorieren " +
         "Armor und ziehen trotzdem vollen Nutzen aus Spell Power.",
      score: function (i) {
        var f = pathFlags(i), s = SC[i] || {};
        var v = 0;
        if (f.wm) v += 10;
        else if (f.w) v += 3;
        if (s.w) v += s.w / 40;
        return v;
      }
    },
    {
      k: "phys", n: "Reiner Waffenkämpfer",
      d: "Physischer Waffenschaden. Geradlinig mit Waffe und Attack Power — " +
         "eine Kampf-Form reicht.",
      score: function (i) {
        var f = pathFlags(i), s = SC[i] || {};
        var v = 0;
        if (f.w && !f.m) v += 9;
        if (f.phys) v += 3;
        if (s.w) v += s.w / 35;
        if (s.ap) v += 3;
        return v;
      }
    },
    {
      k: "feral", n: "Wildform",
      d: "Eine Kampf-Form, nicht drei. Katze oder Bär — Worgen bleibt eine " +
         "eigene Familie.",
      formHint: ["cat", "bear"],
      score: function (i) {
        var info = formInfo(i);
        var f = pathFlags(i), s = SC[i] || {};
        var v = 0;
        var feral = info.allow.indexOf("cat") >= 0 || info.allow.indexOf("bear") >= 0;
        if (info.grants && feral) v += 12;
        else if (info.require && feral) v += 10;
        else if (feral) v += 6;
        if (info.shapeshiftOk) v += 2;
        if (f.w && !f.m) v += 3;
        if (f.wm) v += 4;
        if (s.w) v += s.w / 40;
        return v;
      }
    },
    {
      k: "cast", n: "Zauberwirker",
      d: "Reine Sprüche ohne Waffenanteil. Der Path mit dem stärksten " +
         "Spell-Power-Multiplikator.",
      score: function (i) {
        var f = pathFlags(i), s = SC[i] || {};
        var v = 0;
        if (f.m && !f.w) v += 9;
        if (s.flat) v += 3;
        if (s.sp) v += 3;
        return v;
      }
    },
    {
      k: "dot", n: "Schaden über Zeit",
      d: "Wirkt auf mehrere Ziele gleichzeitig und läuft weiter, während " +
         "du das nächste anfängst. Stark beim Leveln.",
      score: function (i) {
        var s = SC[i] || {};
        var v = 0;
        if (s.dot) v += 8;
        if (s.tick) v += 6;
        if (pathFlags(i).m) v += 2;
        return v;
      }
    },
    {
      k: "heal", n: "Heiler",
      d: "Heilung als Hauptaufgabe. Braucht zwingend Path of Healing, sonst " +
         "wird deine Spell Power nie in Healing Power umgerechnet.",
      score: function (i) {
        var f = pathFlags(i), s = SC[i] || {};
        var v = 0;
        if (f.hPrimary) v += 9;
        else if (f.h) v += 3;
        if (s.heal) v += 4;
        return v;
      }
    },
    {
      k: "burst", n: "Cooldown-Burst",
      d: "Wenige, harte Treffer auf Cooldown statt Dauerfeuer. Gut gegen " +
         "einzelne dicke Ziele.",
      score: function (i) {
        var s = SC[i] || {}, m = MC[i] || {};
        var v = 0;
        if (s.w && s.w >= 150) v += 8;
        if (m.cd && m.cd >= 8 && m.cd <= 120) v += 5;
        if (s.w) v += s.w / 50;
        return v;
      }
    }
  ];
  var THEMEBY = {};
  THEMES.forEach(function (t) { THEMEBY[t.k] = t; });

  var lastGen = null;

  // Darf dieser Eintrag ueberhaupt in den Build? Budget wird lokal
  // mitgefuehrt, damit der Generator nicht gegen den globalen Zustand
  // rechnet, den er gerade erst aufbaut.
  function genLegal(i, sel, use, cnt) {
    if (sel[i]) return false;
    var isTal = CAT[i][1] === 1;
    if (isTal && cnt.t >= MAX_T) return false;
    if (!isTal && cnt.a >= MAX_A) return false;
    if (tooHigh(i)) return false;
    var q = entryQual(i), lim = qualityLimit(q);
    if (lim && use[q] + entryCost(i) > lim) return false;
    var g = REL[i][3];
    if (g >= 0) {
      for (var k in sel) { if (REL[k][3] === g) return false; }
    }
    var cg = REL[i][5];
    if (cg >= 0) {
      for (var k2 in sel) { if (REL[k2][5] === cg) return false; }
    }
    var gate = REL[i][4];
    var mine = CHAR ? normPath(CHAR.path) : "";
    if (gate && gate[0] === "Path" && mine && normPath(gate[1]) &&
        normPath(gate[1]) !== mine) return false;
    return true;
  }

  function generateBuild(themeKey) {
    var th = THEMEBY[themeKey];
    if (!th) return null;

    var sel = Object.create(null);
    var use = [0, 0, 0, 0, 0];
    var cnt = { a: 0, t: 0 };
    var why = {};
    var skipped = [];
    var primary = null;
    var stanceHave = {};

    function noteSkip(i, reason) {
      if (skipped.length >= 16) return;
      var n;
      for (n = 0; n < skipped.length; n++) {
        if (skipped[n].i === i) return;
      }
      skipped.push({ i: i, why: reason });
    }

    function rememberStance(info) {
      if (!info.stanceGroup) return;
      if (stanceHave[info.stanceGroup]) return;
      var key = info.variant;
      if (!key && info.allow.length === 1) key = info.allow[0];
      if (!key && info.grants) key = info.family;
      if (key) stanceHave[info.stanceGroup] = key;
    }

    function adoptForm(i, forced) {
      var info = formInfo(i);
      rememberStance(info);
      if (info.utility || !info.grants) {
        if (!primary && info.require && info.allow.length === 1 &&
            (formIsCombat(info.allow[0]) || info.stanceGroup)) {
          primary = info.allow[0];
        }
        return;
      }
      if (formIsUtility(info.family)) return;
      if (!primary) primary = info.family;
      else if (forced && formIsCombat(info.family) && !formIsCombat(primary)) {
        primary = info.family;
      }
    }

    function formConflict(i) {
      var info = formInfo(i);
      if (info.humanoidOnly && primary && formIsCombat(primary) && !info.shapeshiftOk) {
        return "geht nur ohne Form — dein Build bleibt bei " + formDe(primary);
      }
      if (info.stanceGroup && stanceHave[info.stanceGroup]) {
        var have = stanceHave[info.stanceGroup];
        if (!formMatchesHave(info, have)) {
          return "andere Haltung — du hast schon " + formDe(
            info.stanceGroup === "warrior_stance" ? "warrior_stance" :
            info.stanceGroup === "presence" ? formPresenceKey(have) : have
          );
        }
      }
      // Katze / Bär / Worgen (und andere Kampf-Formen) nicht als zweite Form.
      if (info.grants && !info.utility && primary &&
          formGrantClash(primary, info.family)) {
        return "andere Kampf-Form — dein Build bleibt bei " + formDe(primary);
      }
      if (primary && info.require && info.allow.length) {
        var ok = false;
        var ai;
        for (ai = 0; ai < info.allow.length; ai++) {
          if (info.allow[ai] === primary || formCompat(primary, info.allow[ai])) {
            ok = true;
            break;
          }
        }
        if (!ok && !(info.shapeshiftOk && !info.require)) {
          var need = info.allow.map(formDe).join(" / ");
          return "braucht " + need + ", passt nicht zu " + formDe(primary);
        }
      }
      return null;
    }

    function formScoreAdj(i, v) {
      var info = formInfo(i);
      if (formConflict(i)) return -1000;
      if (info.shapeshiftOk && primary && formIsCombat(primary)) v += 1.8;
      if (primary && info.allow.indexOf(primary) >= 0) {
        v += info.require ? 3 : (info.strong ? 1.5 : 0.4);
      }
      if (primary && info.strong && info.allow.length &&
          info.allow.indexOf(primary) < 0 &&
          info.allow.some(function (f) { return formIsCombat(f) || FORM_STANCE_GROUP[f]; })) {
        v -= 25;
      }
      return v;
    }

    function take(i, reason) {
      sel[i] = true;
      why[i] = reason;
      use[entryQual(i)] += entryCost(i);
      if (CAT[i][1] === 1) cnt.t++; else cnt.a++;
      adoptForm(i, false);
    }

    function takeForced(i, reason) {
      sel[i] = true;
      why[i] = reason;
      use[entryQual(i)] += entryCost(i);
      if (CAT[i][1] === 1) cnt.t++; else cnt.a++;
      adoptForm(i, true);
    }

    function votePrimary(pool) {
      var sc = {};
      var hints = th.formHint || [];
      var h;
      for (h = 0; h < hints.length; h++) sc[hints[h]] = (sc[hints[h]] || 0) + 8;
      var lim = Math.min(pool.length, 80);
      var p, i, info, v, a, f, w;
      for (p = 0; p < lim; p++) {
        v = pool[p][0];
        i = pool[p][1];
        info = formInfo(i);
        if (info.grants && !info.utility && (formIsCombat(info.family) || info.stanceGroup)) {
          sc[info.family] = (sc[info.family] || 0) + v + 12;
        } else if (info.require && info.allow.length) {
          w = v / info.allow.length;
          for (a = 0; a < info.allow.length; a++) {
            f = info.allow[a];
            if (formIsCombat(f) || FORM_STANCE_GROUP[f]) {
              sc[f] = (sc[f] || 0) + w;
            }
          }
        } else if (info.strong && info.allow.length) {
          w = v * 0.35 / info.allow.length;
          for (a = 0; a < info.allow.length; a++) {
            f = info.allow[a];
            if (formIsCombat(f) || FORM_STANCE_GROUP[f]) {
              sc[f] = (sc[f] || 0) + w;
            }
          }
        }
      }
      var best = null, bestV = 0;
      Object.keys(sc).forEach(function (fam) {
        if (sc[fam] > bestV) { best = fam; bestV = sc[fam]; }
      });
      return best;
    }

    // Gelockte Eintraege zuerst behalten — Wildcard-Locks nicht ueberschreiben.
    if (CHAR && CHAR.locked && CHAR.locked.length) {
      CHAR.locked.forEach(function (eid) {
        var li = BYEID[eid];
        if (li !== undefined && genLegal(li, sel, use, cnt)) {
          takeForced(li, "gesperrt");
        }
      });
    }

    // Desire (Addon 1.5+): Wunschliste vor dem Themen-Pool aufnehmen.
    if (CHAR && CHAR.desire && CHAR.desire.length) {
      CHAR.desire.forEach(function (eid) {
        var di = BYEID[eid];
        if (di !== undefined && !isUndesiredIdx(di) &&
            genLegal(di, sel, use, cnt)) {
          takeForced(di, "Desire");
        }
      });
    }

    // Runde 1: Faehigkeiten nach Themenpassung.
    var pool = [];
    var gearSig = weaponGearSignal(CHAR);
    for (var i = 0; i < CAT.length; i++) {
      if (CAT[i][1] !== 0) continue;
      if (isUndesiredIdx(i)) continue;
      var v = th.score(i);
      if (isCardedIdx(i)) v += 4; // Skill-Card-Spells bevorzugen
      if (isDesiredIdx(i)) v += 3;
      if (isDesireEligIdx(i)) v += 1.5; // Rapid-Roll-fähig
      // Mild: nur wenn ItemStat-Band zur Import-Waffe vorliegt (kein Coeff-Raten).
      if (gearSig !== 0) {
        var fGear = pathFlags(i);
        var isWpn = fGear.w;
        var isMag = fGear.m && !fGear.w;
        if (gearSig > 0 && isWpn) v += 1.5;
        if (gearSig < 0 && isWpn) v -= 0.5;
        if (gearSig < 0 && isMag) v += 1;
      }
      if (v > 0) pool.push([v + entryQual(i) * 0.4, i]);
    }
    pool.sort(function (a, b) { return b[0] - a[0]; });

    if (!primary) primary = votePrimary(pool);

    var rawPool = pool.slice();
    var rp;
    for (rp = 0; rp < pool.length; rp++) {
      pool[rp] = [formScoreAdj(pool[rp][1], pool[rp][0]), pool[rp][1]];
    }
    for (rp = 0; rp < rawPool.length && skipped.length < 16; rp++) {
      var skipWhy = formConflict(rawPool[rp][1]);
      if (skipWhy && rawPool[rp][0] > 0) noteSkip(rawPool[rp][1], skipWhy);
    }
    pool = pool.filter(function (row) { return row[0] > 0; });
    pool.sort(function (a, b) { return b[0] - a[0]; });

    if (primary) {
      var gi;
      for (gi = 0; gi < CAT.length && cnt.a < MAX_A; gi++) {
        var ginfo = formInfo(gi);
        if (!ginfo.grants || formFamily(gi) !== primary || CAT[gi][1] !== 0) continue;
        if (isUndesiredIdx(gi)) continue;
        if (genLegal(gi, sel, use, cnt) && !formConflict(gi)) {
          take(gi, formIsCombat(primary) ? "deine Kampf-Form" :
            (FORM_STANCE_GROUP[primary] === "presence" ? "deine Presence" :
              "deine Haltung"));
        }
      }
    }

    for (var p = 0; p < pool.length && cnt.a < MAX_A; p++) {
      var idx = pool[p][1];
      if (!genLegal(idx, sel, use, cnt)) continue;
      var fc = formConflict(idx);
      if (fc) { noteSkip(idx, fc); continue; }
      take(idx, "passt zur Ausrichtung");
    }

    // Runde 2: Talente, die genau diese Faehigkeiten verbessern.
    // Vererbung: Schulvariante zaehlt die Talente der Basis — Basis muss
    // nicht selbst im Build stehen.
    var bases = {};
    Object.keys(sel).map(Number).forEach(function (i) {
      bases[i] = 1;
      var b = inheritBase(i);
      if (b !== null && b !== undefined) bases[b] = 1;
    });
    var tpool = [];
    for (var j = 0; j < CAT.length; j++) {
      if (CAT[j][1] !== 1) continue;
      if (isUndesiredIdx(j)) continue;
      var hits = (MODOF[j] || []).filter(function (b) { return bases[b]; });
      var refs = (REL[j][2] || []).filter(function (r) { return sel[r]; });
      var sc = hits.length * 6 + refs.length * 4;
      if (isCardedIdx(j)) sc += 3;
      if (isDesiredIdx(j)) sc += 2;
      if (isDesireEligIdx(j)) sc += 1;
      // Reine Schadensmultiplikatoren zaehlen auch ohne Namensbezug.
      ((SC[j] || {}).inc || []).forEach(function (x) {
        if (x[2] === "dmg" && themeKey !== "heal") sc += 1.5;
        if (x[2] === "heal" && themeKey === "heal") sc += 2.5;
      });
      if (primary) {
        var tinfo = formInfo(j);
        if (tinfo.allow.indexOf(primary) >= 0) sc += 2;
        sc = formScoreAdj(j, sc);
      }
      if (sc > 0) tpool.push([sc + CAT[j][3] * 0.3, j, hits, refs]);
    }
    tpool.sort(function (a, b) { return b[0] - a[0]; });
    for (var q2 = 0; q2 < tpool.length && cnt.t < MAX_T; q2++) {
      var t2 = tpool[q2];
      if (!genLegal(t2[1], sel, use, cnt)) continue;
      var tfc = formConflict(t2[1]);
      if (tfc) { noteSkip(t2[1], tfc); continue; }
      take(t2[1], t2[2].length
        ? "verbessert " + CAT[t2[2][0]][0]
        : (t2[3].length ? "wirkt auf " + CAT[t2[3][0]][0] : "hebt deinen Schaden"));
    }

    return {
      theme: th,
      ids: Object.keys(sel).map(Number),
      why: why,
      use: use,
      form: primary || "humanoid",
      skipped: skipped
    };
  }

  // ---------- Stat-Priorität aus dem fertigen Build ----------
  // Jede Gewichtung zaehlt eine Eigenschaft, die im Build tatsaechlich
  // vorkommt - keine Faustregeln.
  function statPriority(ids) {
    var w = { SP: 0, AP: 0, Crit: 0, Haste: 0, Int: 0, Agi: 0, Str: 0,
              Heal: 0, Hit: 0, Sta: 0 };
    var n = { weapon: 0, weaponTal: 0, spell: 0, heal: 0, cast: 0,
              instant: 0, crit: 0, spTip: 0, apTip: 0, ssugInt: 0 };

    ids.forEach(function (i) {
      var f = pathFlags(i), s = SC[i] || {}, m = MC[i] || {};
      if (f.w) {
        if (CAT[i][1] === 0) n.weapon++; else n.weaponTal++;
        w.SP += 3; w.AP += 2; w.Hit += 1;
      }
      if (f.m && !f.w) { n.spell++; w.SP += 3; }
      if (s.flat) w.SP += 1;
      // Gemessene Tooltip-Anteile zählen stärker als nur der Magie-Tag
      if (s.sp) { n.spTip++; w.SP += 4; }
      else if (s.spb) { n.spTip++; w.SP += 2; }
      if (s.ap) { n.apTip++; w.AP += 4; }
      else if (s.apb) { n.apTip++; w.AP += 2; }
      if (ssugPathLabel(i) === "Intelligence") {
        n.ssugInt++;
        w.SP += 0.8; w.Int += 0.5;
      }
      if (f.hPrimary) { n.heal++; w.Heal += 3; w.SP += 1; }
      else if (f.h) { n.heal++; w.Heal += 1; }
      if (m.cast) { n.cast++; w.Haste += 2.5; }
      else if (m.cd) { n.instant++; w.Haste += 0.3; }
      if (f.crit) { n.crit++; w.Crit += 2; }
      if (f.w || f.m || f.h) w.Crit += 0.6;
      w.Sta += 0.15;
    });

    // Der Path multipliziert Spell Power - das verschiebt die Rangfolge
    // staerker als jede einzelne Faehigkeit.
    var pk = CHAR ? normPath(CHAR.path) : "";
    if (!pk) {
      var best = scorePaths(profile(ids))[0];
      pk = best ? best.k : "";
    }
    var P = PATHBY[pk];
    if (P) {
      w.SP *= P.sp;
      // Crit ist getrennt - ausser auf Duality, wo beide Attribute beides geben.
      if (pk === "dua") { w.Int += w.Crit * 0.4; w.Agi += w.Crit * 0.4; }
      else if (n.weapon > n.spell) w.Agi += w.Crit * 0.5;
      else w.Int += w.Crit * 0.5;
      if (pk === "int" || pk === "heal") w.Int += n.spell * 0.8 + n.heal * 0.8;
      if (pk === "str") w.Str += n.weapon * 1.2;
      if (pk === "agi") w.Agi += n.weapon * 1.2;
    }

    var rows = Object.keys(w).map(function (k) { return { k: k, v: w[k] }; })
      .filter(function (r) { return r.v > 0.5; })
      .sort(function (a, b) { return b.v - a.v; });
    var top = rows.length ? rows[0].v : 1;
    rows.forEach(function (r) { r.pct = Math.round(r.v / top * 100); });
    return { rows: rows, n: n, path: P };
  }

  var STAT_LABEL = {
    SP: "Spell Power", AP: "Attack Power", Crit: "Crit Rating",
    Haste: "Haste Rating", Int: "Intellect", Agi: "Agility",
    Str: "Strength", Heal: "Healing Power", Hit: "Hit Rating",
    Sta: "Stamina"
  };

  function statReason(k, n, P) {
    switch (k) {
      case "SP": return "zählt doppelt: 14 Spell Power = 1 Waffen-DPS, " +
        "und voll auf jeden Spruch" + (P && P.sp > 1
          ? " — auf " + P.n + " zusätzlich ×" + String(P.sp).replace(".", ",")
          : "") +
        (n.spTip ? "; " + n.spTip + " mit Tooltip-SP" : "") +
        (n.ssugInt ? "; " + n.ssugInt + "× SpellStatSuggestions Intelligence" : "");
      case "AP": return (n.weapon + n.weaponTal) +
        " Einträge mit Waffenbezug, gleiche 14:1-Regel" +
        (n.apTip ? "; " + n.apTip + " mit Tooltip-AP" : "");
      case "Crit": return "der einzige Stat, der Melee- und Spell-Crit " +
        "gleichzeitig hebt";
      case "Haste": return n.cast
        ? n.cast + " Einträge mit Castzeit"
        : "fast alles ist instant — Haste bringt hier wenig";
      case "Int": return "Spell-Crit und Mana" +
        (P && P.k === "dua" ? "; auf Duality zusätzlich Melee-Crit" : "");
      case "Agi": return "Melee-Crit, Armor, Dodge" +
        (P && P.k === "dua" ? "; auf Duality zusätzlich Spell-Crit" : "");
      case "Str": return "Attack Power und Parry";
      case "Heal": return n.heal + " heilende Einträge";
      case "Hit": {
        var hitWhy = "Waffenangriffe können verfehlen";
        if (CHAR && CHAR.stats && CHAR.stats.HITPCT !== undefined) {
          var hp = +CHAR.stats.HITPCT;
          if (hp < HIT_CAP_BOSS) {
            hitWhy += " — Import " + fmtStatPct(hp) + " %, Raidboss-Cap " +
              HIT_CAP_BOSS + " % (Charakterfenster)";
          } else {
            hitWhy += " — Import " + fmtStatPct(hp) + " % am Raidboss-Cap";
          }
        } else {
          hitWhy += " — " + HIT_CAP_BOSS + " % gegen Bosse (Charakterfenster)";
        }
        if (n.spell && CHAR && CHAR.stats && CHAR.stats.SHITPCT !== undefined) {
          hitWhy += "; Spell Hit " + fmtStatPct(+CHAR.stats.SHITPCT) +
            " % gemessen (kein Cap in den Daten)";
        }
        return hitWhy;
      }
      case "Sta": return "Überleben, kein Schaden";
      default: return "";
    }
  }

  function renderGenerator() {
    var box = document.getElementById("genbox");
    if (!box) return;
    var o = [];

    o.push(emptyHint(
      "Wähle eine Ausrichtung — der Generator füllt Fähigkeiten und Talente.",
      "<p>" + (isEndgameFrame() ? "Modus Endgame (bis 60)." : "Modus Levelrun (10–60).") +
        (CHAR ? "" : " Ohne Import: Stufe und Budget unbekannt.") + "</p>"));
    o.push(wrapDetails(
      "<p>Er geht den Katalog durch: erst Fähigkeiten der Ausrichtung, " +
      "dann Talente dazu. Dubletten, zu hohe Stufen, gesperrte Paths und dein " +
      "Seltenheits-Budget zählen mit. Eine Kampf-Form plus Haltung — Katze " +
      "und Bär werden nicht gemischt.</p>",
      "So arbeitet der Generator"));

    o.push('<div class="genlist">' + THEMES.map(function (t) {
      return '<button type="button" class="genb" data-gen="' + t.k + '"><b>' +
        esc(t.n) + '</b><span class="genblurb">' + esc(t.d) +
        "</span></button>";
    }).join("") + "</div>");

    if (lastGen) {
      var g = lastGen;
      var abi = g.ids.filter(function (i) { return CAT[i][1] === 0; });
      var tal = g.ids.filter(function (i) { return CAT[i][1] === 1; });
      var pathSc = scorePaths(profile(g.ids));
      var bestP = pathSc[0];
      var pathN = bestP && PATHBY[bestP.k]
        ? PATHBY[bestP.k].n.replace("Path of ", "") : "";

      o.push('<div class="gensum"><b>' + esc(g.theme.n) +
        (pathN ? " · " + esc(pathN) : "") +
        (g.form && g.form !== "humanoid" ? " · " + esc(formDe(g.form)) : "") +
        "</b> " +
        abi.length + " Fähigkeiten, " + tal.length + " Talente. " +
        "Übernehmen ersetzt deine Auswahl.</div>");
      o.push('<div class="pastewrap pastebtns">' +
        '<button type="button" class="primary" id="bGenApply">Build übernehmen</button>' +
        '<button type="button" id="bGenDrop">Verwerfen</button></div>');

      var peek = [];
      g.ids.slice().sort(function (a, b) {
        return CAT[a][1] - CAT[b][1] || CAT[b][3] - CAT[a][3];
      }).slice(0, 6).forEach(function (i) {
        peek.push('<div class="cmprow"><span class="icon" style="width:20px;' +
          'height:20px;flex:0 0 20px;' + iconStyle(i, 20) + '"></span>' +
          '<span class="nm q' + CAT[i][3] + '">' +
          esc(CAT[i][0]) + "</span></div>");
      });
      if (g.ids.length > 6) {
        peek.push("<p>… und " + (g.ids.length - 6) + " weitere nach Übernehmen.</p>");
      }

      var groups = {};
      var order = [];
      g.ids.forEach(function (i) {
        var reason = g.why[i] || "";
        if (!groups[reason]) {
          groups[reason] = [];
          order.push(reason);
        }
        groups[reason].push(i);
      });
      peek.push(order.map(function (reason) {
        return '<div class="wepline"><b>' + esc(reason || "gewählt") +
          "</b> " + groups[reason].map(function (i) {
            return esc(CAT[i][0]);
          }).join(" · ") + "</div>";
      }).join(""));
      o.push(wrapDetails(peek.join(""), "Auswahl (" + g.ids.length + ")"));

      if (g.skipped && g.skipped.length) {
        o.push(wrapDetails(
          g.skipped.map(function (s) {
            var nm = CAT[s.i] ? CAT[s.i][0] : "?";
            return '<div class="wepline"><b>' + esc(nm) + "</b> " +
              esc(s.why) + "</div>";
          }).join(""),
          "Form-Hinweise (" + g.skipped.length + ")"));
      }

      if (pathSc && pathSc.length) {
        o.push(wrapDetails(
          pathSc.map(function (x) {
            var q = PATHBY[x.k];
            return '<div class="wepline"><b>' +
              esc(q.n.replace("Path of ", "")) + " · " + x.v + " Pkt</b> " +
              esc(x.why) + "</div>";
          }).join(""),
          "Path-Wertung"));
      }
    }
    box.innerHTML = o.join("");
  }

  function renderStats(ids) {
    var box = document.getElementById("statbox");
    var hd = document.getElementById("cB");
    if (!box) return;
    if (!ids.length) {
      hd.textContent = "—"; hd.className = "cnt";
      box.innerHTML = emptyState(
        "Wähle oder generiere einen Build.",
        "<p>Dann steht hier, worauf du beim Gear achten musst.</p>");
      return;
    }
    var r = statPriority(ids);
    hd.textContent = r.rows.length ? STAT_LABEL[r.rows[0].k] : "—";
    hd.className = "cnt ok";

    function statRow(x, n) {
      return '<div class="statrow"><span class="rk">' + (n + 1) + "</span>" +
        '<span class="sn">' + esc(STAT_LABEL[x.k]) + "</span>" +
        '<span class="sbar"><i style="width:' + x.pct + '%"></i></span>' +
        '<span class="sp">' + x.pct + "</span>" +
        '<span class="swhy">' + esc(statReason(x.k, r.n, r.path)) + "</span></div>";
    }
    var o = ['<div class="qhint">' + r.n.weapon + " Waffen · " +
      r.n.spell + " Sprüche" +
      (r.n.heal ? " · " + r.n.heal + " Heilung" : "") +
      (r.path ? " · " + esc(r.path.n.replace("Path of ", "")) : "") +
      ".</div>"];
    r.rows.slice(0, 3).forEach(function (x, n) { o.push(statRow(x, n)); });
    var statFooter = "Die Prozentzahl ist relativ zum wichtigsten Stat, keine " +
      "Schadenszunahme. Sie sagt dir, was du bei gleichem Itemplatz " +
      "bevorzugen solltest.";
    if (CHAR && CHAR.stats && CHAR.stats.HITPCT !== undefined) {
      statFooter += " Melee-Hit-Cap " + HIT_CAP_BOSS +
        " % Raidboss stammt aus dem Charakterfenster" +
        (isEndgameFrame() ? " — im Endgame besonders relevant" : "") + ".";
    }
    var moreStats = r.rows.slice(3).map(function (x, n) {
      return statRow(x, n + 3);
    }).join("");
    var foot = '<div class="qhint">' + statFooter + "</div>";
    if (moreStats) {
      o.push(wrapDetails(moreStats + foot,
        "Weitere Stats (" + (r.rows.length - 3) + ")"));
    } else {
      o.push(wrapDetails(foot, "Hinweis zur Prozentzahl"));
    }
    box.innerHTML = o.join("");
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-gen]");
    if (b) {
      lastGen = generateBuild(b.dataset.gen);
      renderGenerator();
      if (lastGen) toast(lastGen.ids.length + " Einträge zusammengestellt");
      return;
    }
    if (e.target.id === "bGenApply" && lastGen) {
      picked = Object.create(null);
      lastGen.ids.forEach(function (i) { picked[i] = true; });
      lastGen = null;
      refresh();
      toast("Build übernommen");
      return;
    }
    if (e.target.id === "bGenDrop") {
      lastGen = null;
      renderGenerator();
    }
  });

  // ---------- Übergabe an ein Sprachmodell ----------
  // Die Seite ruft bewusst kein Modell selbst auf: dafuer muesste ein
  // API-Schluessel in einer oeffentlichen Datei stehen, und der waere fuer
  // jeden lesbar. Stattdessen wird hier ein vollstaendiger Prompt gebaut,
  // den man in Claude, ChatGPT oder sonst was einfuegt - mitsamt allem,
  // was das Modell ueber Ascension wissen muss, um nicht zu raten.
  function buildPrompt() {
    var ids = Object.keys(picked).map(Number);
    var L = [];

    L.push("Du berätst mich zu einem Charakter in Project Ascension, " +
      "Season 10 Wildcard (WoW 3.3.5a, klassenlos). Antworte auf Deutsch.");
    L.push("");
    L.push("## Regeln dieses Servers (gemessen, nicht geraten)");
    L.push("- 30 Ability-Plätze, 25 Talent-Plätze.");
    L.push("- Zusätzlich ein Seltenheits-Budget: man kann nicht beliebig " +
      "viele Epics und Legendaries tragen.");
    L.push("- Waffenschaden skaliert aus Attack Power UND Spell Power, " +
      "im selben Verhältnis: 14 Punkte = 1 Waffen-DPS. Spell Power ist " +
      "deshalb auch für reine Waffenbuilds stark.");
    L.push("- Crit ist getrennt: Agility gibt nur Melee-Crit, Intellect nur " +
      "Spell-Crit. Nur Crit Rating hebt beides. Der Path of Duality hebt " +
      "diese Trennung auf.");
    L.push("- Es gibt fünf Paths: Strength, Agility, Duality, Intelligence, " +
      "Healing. Sie multiplizieren Spell Power aus Items: Intelligence ×2, " +
      "Duality ×1,75, die anderen ×1.");
    L.push("- Alle Ressourcenpools existieren gleichzeitig. Wut und " +
      "Runenmacht regenerieren nicht von selbst und brauchen Generatoren.");
    L.push("- Elementare Sprüche ignorieren Armor, haben dafür etwas " +
      "niedrigere Grund-DPS.");
    L.push("");

    if (CHAR) {
      var s = CHAR.stats || {};
      L.push("## Mein Charakter");
      L.push("- " + (CHAR.name || "?") + ", Stufe " + (CHAR.level || "?") +
        ", Path of " + (CHAR.path || "?"));
      var st = [];
      ["STR", "AGI", "INT", "SPI", "STA", "SP", "AP", "CRIT", "SCRIT",
       "HITRATING", "HASTERATING", "ARMOR"].forEach(function (k) {
        if (s[k] !== undefined) st.push(k + " " + s[k]);
      });
      if (st.length) L.push("- Werte: " + st.join(", "));
      var mh = CHAR.weapons.filter(function (w) { return w.slot === "MH"; })[0];
      if (mh) {
        L.push("- Waffe: " + mh.name + ", " + mh.dmg + " Schaden, Tempo " +
          mh.speed + (/2HWEAPON/i.test(mh.loc) ? " (Zweihand)" : " (Einhand)"));
      }
      if (CHAR.ilvl) L.push("- Gegenstandsstufe " + CHAR.ilvl);
      if (CHAR.qlimit) {
        var q = [];
        for (var qq = 4; qq >= 1; qq--) {
          if (CHAR.qlimit[qq]) q.push(QN[qq] + " max " + CHAR.qlimit[qq]);
        }
        if (q.length) L.push("- Seltenheits-Budget: " + q.join(", "));
      }
      L.push("");
    }

    function line(i) {
      var s = SC[i] || {}, m = MC[i] || {}, bits = [];
      if (s.w) bits.push(s.w + " % Waffenschaden" + (s.sch ? " als " + s.sch : ""));
      if (s.flat) bits.push(s.flat[0] + "-" + s.flat[1] +
        (s.fsch ? " " + s.fsch : "") + " Schaden");
      if (s.heal) bits.push("Heilung " + s.heal[0] + "-" + s.heal[1]);
      if (s.dot) bits.push("über " + s.dot + " s");
      (s.inc || []).forEach(function (x) { bits.push("+" + x[0] + " % " + x[1]); });
      (s.gen || []).forEach(function (x) {
        bits.push("gibt " + (x[0] < 0 ? -x[0] + " % " : x[0] + " ") + x[1]);
      });
      if (m.cd) bits.push("CD " + m.cd + " s");
      if (m.cast) bits.push(m.cast + " s Cast");
      if (m.cost) bits.push("kostet " + m.cost + " " + m.res);
      return "- " + CAT[i][0] + " [" + QN[CAT[i][3]] + ", Stufe " + CAT[i][4] +
        "]" + (bits.length ? ": " + bits.join("; ") : "");
    }

    var abi = ids.filter(function (i) { return CAT[i][1] === 0; });
    var tal = ids.filter(function (i) { return CAT[i][1] === 1; });
    L.push("## Mein Build (" + abi.length + "/30 Abilities, " +
      tal.length + "/25 Talente)");
    L.push("");
    L.push("### Abilities");
    abi.forEach(function (i) { L.push(line(i)); });
    L.push("");
    L.push("### Talente");
    tal.forEach(function (i) { L.push(line(i)); });
    L.push("");

    var pr = statPriority(ids);
    if (pr.rows.length) {
      L.push("## Stat-Priorität, die mein Werkzeug aus dem Build ableitet");
      L.push(pr.rows.map(function (r) {
        return STAT_LABEL[r.k] + " (" + r.pct + ")";
      }).join(" > "));
      L.push("");
    }

    L.push("## Meine Fragen");
    L.push("1. Welche zwei oder drei Einträge in diesem Build sind am " +
      "schwächsten und wodurch würdest du sie ersetzen?");
    L.push("2. Passt der Path zu dem, was der Build tut?");
    L.push(isEndgameFrame()
      ? "3. Auf welche Item-Stats soll ich im Endgame (Stufe 60) " +
        "achten, und in welcher Reihenfolge?"
      : "3. Auf welche Item-Stats soll ich beim Leveln von 10 auf 59 " +
        "achten, und in welcher Reihenfolge?");
    L.push("4. Fehlt dem Build etwas Grundsätzliches — Ressourcen, " +
      "Überleben, Flächenschaden?");
    L.push("");
    L.push("Nenne Fähigkeiten beim Namen und begründe kurz. Wenn dir Daten " +
      "fehlen, sag das, statt zu raten.");

    return L.join("\n");
  }

  // ---------- KI-Anbindung ----------
  // Der Schluessel liegt im localStorage des jeweiligen Browsers und wird
  // ausschliesslich an den gewaehlten Anbieter geschickt. Er steht NICHT
  // in dieser Datei - die liegt oeffentlich auf GitHub Pages, ein Schluessel
  // darin waere binnen Stunden abgegrast und liefe auf fremde Rechnung.
  // Jeder traegt seinen eigenen ein, einmal.

  var AISTORE = "aldi-buildschmiede-ai";

  var PROVIDERS = {
    anthropic: {
      n: "Anthropic (Claude)",
      url: "https://api.anthropic.com/v1/messages",
      model: "claude-sonnet-4-5",
      keyHint: "sk-ant-…",
      keyUrl: "https://console.anthropic.com/settings/keys",
      headers: function (key) {
        return {
          "content-type": "application/json",
          "x-api-key": key,
          "anthropic-version": "2023-06-01",
          // Ohne diesen Header lehnt die API Aufrufe aus dem Browser ab.
          "anthropic-dangerous-direct-browser-access": "true"
        };
      },
      body: function (model, sys, user) {
        return JSON.stringify({
          model: model, max_tokens: 2000,
          system: sys,
          messages: [{ role: "user", content: user }]
        });
      },
      read: function (j) {
        return (j.content || []).map(function (c) { return c.text || ""; }).join("");
      }
    },
    openai: {
      n: "OpenAI (GPT)",
      url: "https://api.openai.com/v1/chat/completions",
      model: "gpt-4o-mini",
      keyHint: "sk-…",
      keyUrl: "https://platform.openai.com/api-keys",
      headers: function (key) {
        return { "content-type": "application/json", "authorization": "Bearer " + key };
      },
      body: function (model, sys, user) {
        return JSON.stringify({
          model: model, max_tokens: 2000,
          messages: [{ role: "system", content: sys },
                     { role: "user", content: user }]
        });
      },
      read: function (j) {
        return ((j.choices || [])[0] || {}).message
          ? j.choices[0].message.content : "";
      }
    }
  };

  function aiCfg() {
    try {
      var raw = localStorage.getItem(AISTORE);
      var d = raw ? JSON.parse(raw) : {};
      if (!PROVIDERS[d.provider]) d.provider = "anthropic";
      if (!d.model) d.model = PROVIDERS[d.provider].model;
      return d;
    } catch (e) { return { provider: "anthropic", model: PROVIDERS.anthropic.model }; }
  }
  function aiSave(d) {
    try { localStorage.setItem(AISTORE, JSON.stringify(d)); } catch (e) { /* egal */ }
  }

  var SYSTEM = "Du bist ein erfahrener Spieler von Project Ascension, " +
    "Season 10 Wildcard (WoW 3.3.5a, klassenlos). Du bekommst echte, " +
    "gemessene Daten aus dem Spielclient. Halte dich strikt daran und " +
    "erfinde keine Fähigkeiten, Zahlen oder Mechaniken. Wenn dir eine " +
    "Information fehlt, sag das. Antworte auf Deutsch, knapp und konkret, " +
    "in Markdown. Nenne Fähigkeiten immer beim exakten Namen.";

  function aiOut(html) {
    document.getElementById("aiout").innerHTML = html;
  }
  // Minimales Markdown - genug fuer Ueberschriften, Listen und Fettdruck.
  function mdLite(s) {
    var out = esc(s)
      .replace(/^### (.*)$/gm, "<h4>$1</h4>")
      .replace(/^## (.*)$/gm, "<h4>$1</h4>")
      .replace(/^# (.*)$/gm, "<h4>$1</h4>")
      .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/^\s*[-*] (.*)$/gm, "<li>$1</li>")
      .replace(/^\s*(\d+)\. (.*)$/gm, "<li>$2</li>");
    out = out.replace(/(<li>[\s\S]*?<\/li>)(?!\s*<li>)/g, "<ul>$1</ul>");
    return out.replace(/\n{2,}/g, "</p><p>").replace(/\n/g, "<br>");
  }

  var aiBusy = false;
  function aiAsk(userText, label) {
    if (aiBusy) return;
    var cfg = aiCfg();
    if (!cfg.key) {
      aiOut('<div class="aiwarn">Kein Schlüssel hinterlegt. Trage oben einen ' +
        "ein — er bleibt in deinem Browser.</div>");
      return;
    }
    var P = PROVIDERS[cfg.provider];
    aiBusy = true;
    aiOut('<div class="aiwait">' + esc(label) + " läuft …</div>");

    fetch(P.url, {
      method: "POST",
      headers: P.headers(cfg.key),
      body: P.body(cfg.model || P.model, SYSTEM, userText)
    }).then(function (r) {
      return r.json().then(function (j) { return { ok: r.ok, s: r.status, j: j }; });
    }).then(function (res) {
      aiBusy = false;
      if (!res.ok) {
        var msg = (res.j && res.j.error && (res.j.error.message || res.j.error.type))
          || ("HTTP " + res.s);
        aiOut('<div class="aiwarn"><b>Der Anbieter hat abgelehnt</b>: ' +
          esc(msg) + (res.s === 401 ? " — der Schlüssel stimmt nicht." :
            res.s === 429 ? " — zu viele Anfragen oder kein Guthaben." : "") +
          "</div>");
        return;
      }
      var txt = P.read(res.j) || "(leere Antwort)";
      aiOut('<div class="aitext"><p>' + mdLite(txt) + "</p></div>" +
        '<div class="qhint">Antwort eines Sprachmodells. Es sieht nur, was ' +
        "im Prompt steht — prüfe die Vorschläge gegen den Katalog, bevor du " +
        "Essence ausgibst.</div>");
    }).catch(function (e) {
      aiBusy = false;
      aiOut('<div class="aiwarn"><b>Kein Zugriff auf den Anbieter</b>: ' +
        esc(e.message || String(e)) +
        ". Wenn du die Seite gerade als Claude-Artifact ansiehst: dort sind " +
        "externe Aufrufe gesperrt. Nimm " +
        '<a href="https://lzra2000.github.io/aldi-buildschmiede/" ' +
        'target="_blank" rel="noopener">die Fassung auf GitHub Pages</a>.' +
        "</div>");
    });
  }

  // Für Vorschläge kann das Modell nicht 3.071 Einträge lesen. Also macht
  // der Code die Vorauswahl - dieselbe Bewertung wie im Generator, nur ohne
  // Greedy-Zugriff - und das Modell entscheidet daraus.
  function aiShortlist(themeKey, n) {
    var th = THEMEBY[themeKey];
    if (!th) return [];
    var pool = [];
    for (var i = 0; i < CAT.length; i++) {
      if (tooHigh(i)) continue;
      if (isUndesiredIdx(i)) continue;
      var v = CAT[i][1] === 0 ? th.score(i) : 0;
      if (CAT[i][1] === 1) {
        ((SC[i] || {}).inc || []).forEach(function (x) {
          if (x[2] === "dmg" && themeKey !== "heal") v += 2;
          if (x[2] === "heal" && themeKey === "heal") v += 3;
        });
        if ((MODOF[i] || []).length) v += 1;
      }
      if (v > 0) pool.push([v + CAT[i][3] * 0.4, i]);
    }
    pool.sort(function (a, b) { return b[0] - a[0]; });
    var vote = {};
    var hints = th.formHint || [];
    hints.forEach(function (f) { vote[f] = (vote[f] || 0) + 8; });
    pool.slice(0, 80).forEach(function (row) {
      var info = formInfo(row[1]);
      if (info.grants && formIsCombat(info.family)) {
        vote[info.family] = (vote[info.family] || 0) + row[0];
      } else if (info.require) {
        info.allow.forEach(function (f) {
          if (formIsCombat(f)) vote[f] = (vote[f] || 0) + row[0] / info.allow.length;
        });
      }
    });
    var primary = null, bestV = 0;
    Object.keys(vote).forEach(function (f) {
      if (vote[f] > bestV) { primary = f; bestV = vote[f]; }
    });
    if (primary) {
      pool.forEach(function (row) {
        var info = formInfo(row[1]);
        if (info.grants && !info.utility && info.family !== primary &&
            !formCompat(primary, info.family)) {
          row[0] -= 80;
        } else if (info.require && info.allow.length) {
          var ok = info.allow.some(function (f) {
            return f === primary || formCompat(primary, f);
          });
          if (!ok) row[0] -= 80;
        } else if (info.shapeshiftOk && formIsCombat(primary)) {
          row[0] += 1.5;
        }
      });
      pool.sort(function (a, b) { return b[0] - a[0]; });
    }
    return pool.slice(0, n).map(function (p) { return p[1]; });
  }

  function aiSuggestPrompt(themeKey) {
    var th = THEMEBY[themeKey];
    var list = aiShortlist(themeKey, 120);
    var L = [];
    L.push("Stell mir einen Build für Project Ascension Season 10 Wildcard " +
      "zusammen. Ausrichtung: **" + th.n + "** — " + th.d);
    L.push("");
    L.push("## Regeln");
    L.push("- Genau 30 Abilities und 25 Talente, nicht mehr.");
    L.push("- Wähle ausschließlich aus der Liste unten. Erfinde nichts dazu.");
    L.push("- Waffenschaden skaliert aus Attack Power UND Spell Power im " +
      "Verhältnis 14 Punkte = 1 Waffen-DPS.");
    L.push("- Elementare Sprüche ignorieren Armor.");
    L.push("- Talente wirken nur, wenn die Fähigkeit, die sie verbessern, " +
      "auch im Build steht — oder eine Schulvariante davon.");
    if (CHAR) {
      L.push("- Mein Charakter: Stufe " + CHAR.level + ", Path of " +
        CHAR.path + ", Spell Power " + (CHAR.stats.SP || "?") + ".");
      if (CHAR.qlimit) {
        var q = [];
        for (var i = 4; i >= 1; i--) {
          if (CHAR.qlimit[i]) q.push("höchstens " + CHAR.qlimit[i] + " " + QN[i]);
        }
        if (q.length) L.push("- Seltenheits-Budget: " + q.join(", ") + ".");
      }
    }
    L.push("");
    L.push("## Auswahl (" + list.length + " Kandidaten, bereits vorgefiltert)");
    list.forEach(function (i) {
      var s = SC[i] || {}, m = MC[i] || {}, b = [];
      if (s.w) b.push(s.w + " % Waffe" + (s.sch ? " als " + s.sch : ""));
      if (s.flat) b.push(s.flat[0] + "-" + s.flat[1] + " Schaden");
      if (s.heal) b.push("Heilung " + s.heal[0] + "-" + s.heal[1]);
      if (s.dot) b.push(s.dot + " s");
      (s.inc || []).slice(0, 2).forEach(function (x) {
        b.push("+" + x[0] + " % " + x[1]);
      });
      if (m.cd) b.push("CD " + m.cd + " s");
      if (m.cost) b.push(m.cost + " " + m.res);
      L.push("- [" + (CAT[i][1] ? "T" : "A") + "] " + CAT[i][0] + " (" +
        QN[CAT[i][3]] + ", Stufe " + CAT[i][4] + ")" +
        (b.length ? ": " + b.join("; ") : ""));
    });
    L.push("");
    L.push("## Ausgabe");
    L.push("1. Die 30 Abilities als Liste, jede mit einem halben Satz warum.");
    L.push("2. Die 25 Talente, jedes mit der Fähigkeit, die es verbessert.");
    L.push("3. Die Stat-Priorität für diesen Build in einer Zeile, " +
      "zum Beispiel „Spell Power > Crit Rating > Intellect“, mit Begründung.");
    L.push("4. Zwei Sätze, wie sich der Build spielt.");
    return L.join("\n");
  }

  function renderAI() {
    var box = document.getElementById("aibox");
    if (!box) return;
    var cfg = aiCfg();
    var P = PROVIDERS[cfg.provider];
    var o = [];

    o.push('<div class="qhint">Der Schlüssel bleibt in <em>deinem</em> Browser ' +
      "und geht nur an den Anbieter, den du wählst. Er steht nicht in dieser " +
      "Datei — die liegt öffentlich. Jeder hinterlegt seinen eigenen. " +
      "Anfragen kosten dich je nach Modell ein paar Cent.</div>");

    o.push('<div class="aicfg">' +
      '<label>Anbieter<select id="aiProv">' +
      Object.keys(PROVIDERS).map(function (k) {
        return '<option value="' + k + '"' +
          (k === cfg.provider ? " selected" : "") + ">" +
          esc(PROVIDERS[k].n) + "</option>";
      }).join("") + "</select></label>" +
      '<label>Modell<input type="text" id="aiModel" value="' +
      esc(cfg.model || P.model) + '"></label>' +
      '<label>Schlüssel<input type="password" id="aiKey" placeholder="' +
      esc(P.keyHint) + '" value="' + (cfg.key ? "" : "") + '"' +
      (cfg.key ? ' data-set="1"' : "") + "></label>" +
      '<div class="aicfgrow"><button id="aiSave">Speichern</button>' +
      '<button id="aiForget">Schlüssel löschen</button>' +
      '<span class="aistate">' + (cfg.key
        ? "Schlüssel hinterlegt" : '<a href="' + esc(P.keyUrl) +
          '" target="_blank" rel="noopener">Schlüssel besorgen</a>') +
      "</span></div></div>");

    o.push('<div class="schd">Was soll die KI tun?</div>');
    o.push('<div class="genlist">' +
      '<button class="genb" id="aiReview"><b>Meinen Build bewerten</b>' +
      "<span>Schickt deinen aktuellen Build mit allen Zahlen hin und fragt " +
      "nach Schwachstellen, Path und Stat-Priorität.</span></button>" +
      THEMES.map(function (t) {
        return '<button class="genb" data-aigen="' + t.k + '">' +
          "<b>Build vorschlagen: " + esc(t.n) + "</b><span>" +
          "120 vorgefilterte Kandidaten, das Modell wählt 30 + 25 daraus " +
          "und begründet.</span></button>";
      }).join("") + "</div>");

    o.push('<div id="aiout"></div>');
    box.innerHTML = o.join("");
  }

  document.addEventListener("click", function (e) {
    var t = e.target;
    if (t.id === "aiSave") {
      var cfg = aiCfg();
      cfg.provider = document.getElementById("aiProv").value;
      cfg.model = document.getElementById("aiModel").value.trim() ||
        PROVIDERS[cfg.provider].model;
      var k = document.getElementById("aiKey").value.trim();
      if (k) cfg.key = k;
      aiSave(cfg);
      renderAI();
      toast("Gespeichert — nur in diesem Browser");
      return;
    }
    if (t.id === "aiForget") {
      try { localStorage.removeItem(AISTORE); } catch (err) { /* egal */ }
      renderAI();
      toast("Schlüssel gelöscht");
      return;
    }
    if (t.id === "aiReview" || (t.closest && t.closest("#aiReview"))) {
      if (!Object.keys(picked).length) { toast("Erst einen Build wählen"); return; }
      aiAsk(buildPrompt(), "Bewertung");
      return;
    }
    var g = t.closest && t.closest("[data-aigen]");
    if (g) aiAsk(aiSuggestPrompt(g.dataset.aigen), "Vorschlag");
  });

  document.addEventListener("change", function (e) {
    if (e.target.id === "aiProv") {
      var cfg = aiCfg();
      cfg.provider = e.target.value;
      cfg.model = PROVIDERS[cfg.provider].model;
      aiSave(cfg);
      renderAI();
    }
  });

  // ---------- Ansichten ----------
  function showView(id) {
    [].forEach.call(document.querySelectorAll(".view"), function (v) {
      var on = v.id === id;
      v.classList.toggle("on", on);
      v.setAttribute("aria-hidden", on ? "false" : "true");
    });
    [].forEach.call(document.querySelectorAll(".vtab"), function (t) {
      var on = t.dataset.view === id;
      t.classList.toggle("on", on);
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
    });
  }

  // Zusammenfassungskacheln → echte IDs in builder-body.html
  // (kein #build / #chains — Listen sind #slotsA/#slotsT, Ketten #chainbox).
  var JUMP = {
    issues: { view: "vAnalyse", sel: "#issues", openTab: null },
    "issues-krit": { view: "vAnalyse", sel: "#issues-krit", openTab: null },
    "issues-fix": { view: "vAnalyse", sel: "#issues-fix", openTab: null },
    paths: { view: "vAnalyse", sel: "#paths", openTab: null },
    stats: { view: "vAnalyse", sel: "#statbox", openTab: null },
    gear: { view: "vAnalyse", sel: "#gearBox", openTab: null },
    scards: { view: "vAnalyse", sel: "#scardJump", openTab: null },
    scard: { view: "vAnalyse", sel: "#scardJump", openTab: null },
    scale: { view: "vAnalyse", sel: "#scalebox", openTab: "aScale" },
    struct: { view: "vAnalyse", sel: "#flags", openTab: "aStruct" },
    chain: { view: "vChain", sel: "#chainbox", openTab: null },
    chains: { view: "vChain", sel: "#chainbox", openTab: null },
    import: { view: "vTools", sel: "#pasteBox", openTab: null },
    char: { view: "vTools", sel: "#charBox", openTab: null },
    gen: { view: "vTools", sel: "#genbox", openTab: "tGen" },
    cmp: { view: "vTools", sel: "#cmpbox", openTab: "tCmp" },
    addon: { view: "vWissen", sel: "#rAddon", openTab: "rAddon" },
    frame: { view: "vAnalyse", sel: "#frameHint", openTab: null },
    build: { view: "vBuild", sel: "#slotsA", openTab: null },
    slotsA: { view: "vBuild", sel: "#slotsA", openTab: null },
    talents: { view: "vBuild", sel: "#slotsT", openTab: null },
    slotsT: { view: "vBuild", sel: "#slotsT", openTab: null },
    essence: { view: "vAnalyse", sel: "#issues-krit", openTab: null },
    essbox: { view: "vTools", sel: "#essbox", openTab: null },
    sug: { view: "vBuild", sel: "#sugbox", openTab: null },
    meth: { view: "vAnalyse", sel: "#methbox", openTab: "aMeth" }
  };

  function resolveJump(key) {
    if (key && key.nodeType) {
      var host = key.closest && key.closest(".view");
      return { view: host ? host.id : null, sel: null, el: key, openTab: null };
    }
    if (JUMP[key]) {
      var src = JUMP[key];
      return { view: src.view, sel: src.sel, openTab: src.openTab || null };
    }
    if (typeof key !== "string" || !key) return null;
    return { view: null, sel: key.charAt(0) === "#" ? key : "#" + key, openTab: null };
  }

  function jumpTo(key, filterOrOpts) {
    if (key === "synergien") {
      window.location.href = "synergien.html";
      return;
    }
    var filter = "";
    if (typeof filterOrOpts === "string") filter = filterOrOpts;
    else if (filterOrOpts && typeof filterOrOpts === "object") {
      filter = filterOrOpts.filter || "";
    }
    var j = resolveJump(key);
    if (!j) return;
    if (filter && typeof filter === "object") filter = filter.filter || "";
    var keyStr = typeof key === "string" ? key : "";
    if (!filter && /issues-krit$/.test(keyStr)) filter = "krit";
    if (!filter && /issues-(fix|info)$/.test(keyStr)) filter = "info";
    var el = j.el || (j.sel && document.querySelector(j.sel));
    if (!el && keyStr.indexOf("issues") === 0) {
      j = resolveJump("issues");
      el = j && document.querySelector(j.sel);
    }
    if (!el) return;
    if (!j.view) {
      var host = el.closest(".view");
      if (host) j.view = host.id;
    }
    if (j.view) showView(j.view);
    if (j.openTab) {
      var tab = document.querySelector('.tab[data-tab="' + j.openTab + '"]');
      if (tab) tab.click();
    }
    var box = document.getElementById("issues") || el;
    var focus = el;
    if (filter === "krit") {
      focus = document.getElementById("issues-krit") ||
        box.querySelector(".issue.krit") || el;
    } else if (filter === "info" || filter === "fix") {
      focus = document.getElementById("issues-fix") ||
        box.querySelector(".issue.info, .issue.fix, .issue.warn") || el;
    }
    var node = focus;
    while (node && node !== document.body) {
      if (node.tagName === "DETAILS" && !node.open) node.open = true;
      node = node.parentElement;
    }
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        var reduce = false;
        try {
          reduce = !!(window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches);
        } catch (err) { /* */ }
        if (!focus.hasAttribute("tabindex") &&
            !/^(A|BUTTON|INPUT|SELECT|TEXTAREA|SUMMARY)$/i.test(focus.tagName)) {
          focus.setAttribute("tabindex", "-1");
        }
        focus.scrollIntoView({
          behavior: reduce ? "auto" : "smooth",
          block: "start"
        });
        focus.classList.remove("jumpflash");
        void focus.offsetWidth;
        focus.classList.add("jumpflash");
        window.setTimeout(function () {
          focus.classList.remove("jumpflash");
        }, 1400);
        if (focus.focus) {
          try { focus.focus({ preventScroll: true }); } catch (e) { /* */ }
        }
      });
    });
  }

  document.addEventListener("click", function (e) {
    var j = e.target.closest("[data-jump]");
    if (!j) return;
    e.preventDefault();
    jumpTo(j.getAttribute("data-jump"), {
      filter: j.getAttribute("data-jump-filter") || ""
    });
  });
  document.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
    var t = e.target;
    if (!t || !t.closest) return;
    if (t.closest("input, select, textarea")) return;
    var tag = (t.tagName || "").toLowerCase();
    if (tag === "button" || tag === "summary") return;
    if (tag === "a" && e.key === "Enter") return;
    var j = t.closest("[data-jump]");
    if (!j) return;
    e.preventDefault();
    jumpTo(j.getAttribute("data-jump"), j.getAttribute("data-jump-filter") || "");
  });

  // ---------- Tutorial (Erste Schritte) ----------
  var TUTSTORE = "aldi-buildschmiede-tutorial";
  var TUTORIAL = [
    {
      title: "Willkommen",
      body: "Die Buildschmiede gilt für den <b>Levelrun (10–59)</b> und das " +
        "<b>Endgame (Stufe 60, Wildcard inklusive)</b>. Zwei gleichrangige " +
        "Seiten: dieser Builder und das Synergie-Nachschlagewerk.",
      cta: [
        { jump: "build", label: "Zum Katalog" },
        { href: "synergien.html", label: "Synergien öffnen" }
      ]
    },
    {
      title: "Addon",
      body: "Lade das Zip, entpacke nach <code>Interface\\AddOns\\</code> — " +
        "der Ordner <code>AscBuildschmiede</code> muss die <code>.toc</code> " +
        "enthalten. Spiel neu starten oder <code>/reload</code>. Im Spiel " +
        "<code>/bs</code>: der Text ist markiert, du kopierst ihn selbst. " +
        "Das Addon schickt nichts ins Netz.",
      cta: [{ jump: "addon", label: "Zur Addon-Anleitung" }]
    },
    {
      title: "Import",
      body: "Unter <b>Werkzeuge</b> den Export einfügen. Optional vorher " +
        "<code>/bs gear</code> und <code>/bs stats</code>, wenn du Ausrüstung " +
        "und Charakterwerte im Befund sehen willst.",
      cta: [{ jump: "import", label: "Zum Import" }]
    },
    {
      title: "Befund &amp; Path",
      body: "Die Chips oben (Befund, Path) sind klickbar. Duality mischt " +
        "Waffen und Magie; Intelligence verdoppelt Spell Power. Zahlen ohne " +
        "Beleg bleiben leer — keine erfundenen Koeffizienten.",
      cta: [
        { jump: "issues", label: "Zum Befund" },
        { jump: "paths", label: "Zum Path" }
      ]
    },
    {
      title: "Skill Cards",
      body: "Kartennamen braucht der Export mit Spell-ID " +
        "(<code>SCARD</code> … <code>:sSPELLID</code>). <code>CARDED</code> " +
        "listet die belegten Zauber. Ohne Spell-ID siehst du Slots, aber " +
        "keine Namen aus der Karten-ID.",
      cta: [{ jump: "scards", label: "Zu Ausrüstung &amp; Karten" }]
    },
    {
      title: "Build &amp; Vorschläge",
      body: "Links der Katalog, rechts dein Build und passende Vorschläge. " +
        "Mehrere Einträge derselben Fähigkeit teilen sich einen GCD — sie " +
        "laufen nicht parallel.",
      cta: [
        { jump: "build", label: "Zum Build" },
        { jump: "sug", label: "Zu den Vorschlägen" }
      ]
    },
    {
      title: "Generator",
      body: "Der Generator füllt eine Ausrichtung. Bleib in einer " +
        "Form-Familie: Katze, Bär und Worgen nicht mischen. Nimm Fähigkeiten, " +
        "die du in der Gestalt noch drücken kannst.",
      cta: [{ jump: "gen", label: "Zum Generator" }]
    },
    {
      title: "Ketten &amp; Synergien",
      body: "Wirkungsketten zeigen, was auf was einzahlt. Das " +
        "Synergiekompendium erklärt Vererbung, gleichen GCD und Modifier — " +
        "nur wo die Daten sie belegen.",
      cta: [
        { jump: "chain", label: "Zu den Ketten" },
        { href: "synergien.html", label: "Synergien öffnen" }
      ]
    },
    {
      title: "Levelrun oder Endgame",
      body: "Unter Auswertung stellst du den Rahmen: Auto (ab Stufe 60 " +
        "Endgame) oder fest Levelrun / Endgame. Der Befund ändert die " +
        "Gewichtung, erfindet aber keine Zahlen.",
      cta: [{ jump: "frame", label: "Zum Rahmen" }]
    }
  ];
  var tutState = { done: false, step: 0 };

  function tutLoad() {
    try {
      var raw = localStorage.getItem(TUTSTORE);
      if (!raw) return { done: false, step: 0 };
      var d = JSON.parse(raw);
      if (!d || typeof d !== "object") return { done: false, step: 0 };
      var n = +d.step || 0;
      if (n < 0) n = 0;
      if (n > TUTORIAL.length - 1) n = TUTORIAL.length - 1;
      return { done: !!d.done, step: n };
    } catch (e) {
      return { done: false, step: 0 };
    }
  }
  function tutSave() {
    try {
      localStorage.setItem(TUTSTORE, JSON.stringify({
        done: !!tutState.done,
        step: tutState.step | 0
      }));
    } catch (e) { /* Privatmodus */ }
  }
  function tutWantHash() {
    return /(?:^|[?#&])tut=1(?:&|$)/.test(location.hash) ||
      /(?:^|[?&])tut=1(?:&|$)/.test(location.search);
  }
  function tutShow(open) {
    var panel = document.getElementById("tutPanel");
    var bar = document.getElementById("tutDismissed");
    if (panel) panel.hidden = !open;
    if (bar) bar.hidden = !!open;
  }
  function tutCtaHtml(c) {
    if (c.href) {
      return '<a class="tut-btn" href="' + c.href + '">' + esc(c.label) + "</a>";
    }
    var extra = c.filter ? ' data-jump-filter="' + esc(c.filter) + '"' : "";
    return '<button type="button" class="tut-btn" data-jump="' +
      esc(c.jump) + '"' + extra + ">" + esc(c.label) + "</button>";
  }
  function renderTutorial() {
    var step = TUTORIAL[tutState.step] || TUTORIAL[0];
    var prog = document.getElementById("tutProgress");
    var title = document.getElementById("tutTitle");
    var body = document.getElementById("tutBody");
    var cta = document.getElementById("tutCta");
    var prev = document.getElementById("tutPrev");
    var next = document.getElementById("tutNext");
    if (prog) {
      prog.textContent = "Schritt " + (tutState.step + 1) + " von " +
        TUTORIAL.length;
    }
    if (title) title.innerHTML = step.title;
    if (body) body.innerHTML = step.body;
    if (cta) {
      cta.innerHTML = (step.cta || []).map(tutCtaHtml).join("");
    }
    if (prev) prev.disabled = tutState.step <= 0;
    if (next) {
      next.textContent = tutState.step >= TUTORIAL.length - 1
        ? "Fertig" : "Weiter";
    }
  }
  function tutFinish() {
    tutState.done = true;
    tutSave();
    tutShow(false);
  }
  function tutCollapse() {
    tutState.done = true;
    tutSave();
    tutShow(false);
  }
  function tutOpen(force) {
    if (force) tutState.step = 0;
    tutState.done = false;
    tutSave();
    tutShow(true);
    renderTutorial();
  }
  function applyTutHash() {
    if (!tutWantHash()) return;
    tutOpen(true);
  }
  var tutBound = false;
  function initTutorial() {
    var root = document.getElementById("tutRoot");
    if (!root) return;
    tutState = tutLoad();
    if (tutWantHash()) tutState.done = false;
    tutShow(!tutState.done);
    renderTutorial();
    tutSave();
    if (tutBound) return;
    tutBound = true;
    var prev = document.getElementById("tutPrev");
    var next = document.getElementById("tutNext");
    var skip = document.getElementById("tutSkip");
    var done = document.getElementById("tutDone");
    var close = document.getElementById("tutClose");
    var reopen = document.getElementById("tutReopen");
    if (prev) {
      prev.addEventListener("click", function () {
        if (tutState.step > 0) tutState.step -= 1;
        tutSave();
        renderTutorial();
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        if (tutState.step >= TUTORIAL.length - 1) {
          tutFinish();
          return;
        }
        tutState.step += 1;
        tutSave();
        renderTutorial();
      });
    }
    if (skip) skip.addEventListener("click", tutCollapse);
    if (close) close.addEventListener("click", tutCollapse);
    if (done) done.addEventListener("click", tutFinish);
    if (reopen) {
      reopen.addEventListener("click", function () {
        tutState.done = false;
        tutSave();
        tutShow(true);
        renderTutorial();
      });
    }
  }
  initTutorial();

  document.addEventListener("click", function (e) {
    var b = e.target.closest(".vtab[data-view]");
    if (b) showView(b.dataset.view);
  });
  // Pfeiltasten in der Ansichts-Leiste (wie bei .tab).
  document.addEventListener("keydown", function (e) {
    var b = e.target.closest && e.target.closest(".vtab[data-view]");
    if (!b) return;
    var sibs = [].filter.call(b.parentNode.querySelectorAll(".vtab[data-view]"), function (t) {
      return !t.hidden && t.getAttribute("aria-hidden") !== "true";
    });
    if (!sibs.length) sibs = [].slice.call(b.parentNode.querySelectorAll(".vtab[data-view]"));
    var i = sibs.indexOf(b);
    var next = null;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = sibs[(i + 1) % sibs.length];
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = sibs[(i - 1 + sibs.length) % sibs.length];
    else if (e.key === "Home") next = sibs[0];
    else if (e.key === "End") next = sibs[sibs.length - 1];
    if (!next) return;
    e.preventDefault();
    showView(next.dataset.view);
    next.focus();
  });
  [].forEach.call(document.querySelectorAll(".vtab"), function (t) {
    t.setAttribute("aria-selected", t.classList.contains("on") ? "true" : "false");
    t.tabIndex = t.classList.contains("on") ? 0 : -1;
  });
  [].forEach.call(document.querySelectorAll(".view"), function (v) {
    v.setAttribute("aria-hidden", v.classList.contains("on") ? "false" : "true");
  });

  // ---------- Wirkungsketten ----------
  // Beantwortet die Frage, die vorher nur indirekt über Warnungen zu
  // erahnen war: was hängt an was. Jede Verbindung zeigt zugleich, ob sie
  // im aktuellen Build tatsächlich zündet.

  var REFBY = null;
  function refBy() {
    if (REFBY) return REFBY;
    REFBY = {};
    for (var i = 0; i < REL.length; i++) {
      (REL[i][2] || []).forEach(function (r) {
        (REFBY[r] = REFBY[r] || []).push(i);
      });
    }
    return REFBY;
  }

  function pill(i, live, takeable) {
    return '<span class="pill ' + (live ? "live" : "dead") +
      (takeable ? " take" : "") + '"' +
      (takeable ? ' data-add="' + i + '" role="button" tabindex="0"' : "") +
      ' style="border-left:3px solid var(--q' + CAT[i][3] + ')">' +
      (live ? "✓ " : "") + esc(CAT[i][0]) + "</span>";
  }

  function chainOf(i, have, showMissing) {
    var rows = [], live = 0, dead = 0;

    var base = inheritBase(i);
    var mods = [];
    bmOf(i).forEach(function (t) { pushUniq(mods, t); });
    if (base !== null && base !== undefined) {
      bmOf(base).forEach(function (t) { pushUniq(mods, t); });
    }

    // Vererbung: die Basis muss NICHT im Build stehen — nur ihre Talente zählen.
    if (base !== null && base !== undefined) {
      var inheritOn = mods.some(function (t) { return have[t]; });
      rows.push(["Erbt Talente",
        "<em>von</em> " + pill(base, inheritOn, false) +
        ((REL[i][0] === null || REL[i][0] === undefined)
          ? " <em>uses-Basis — Talente, nicht die Fähigkeit selbst</em>"
          : "")]);
      if (inheritOn) live++;
    }

    var need = REL[i][1];
    if (need !== null && need !== undefined) {
      rows.push(["Braucht", pill(need, !!have[need], !have[need])]);
      if (have[need]) live++; else dead++;
    }

    var modsOn = mods.filter(function (t) { return have[t]; });
    var modsOff = mods.filter(function (t) { return !have[t]; });
    if (modsOn.length || (showMissing && modsOff.length)) {
      var h = modsOn.map(function (t) { return pill(t, true, false); }).join("");
      if (showMissing) {
        h += modsOff.slice(0, 6).map(function (t) { return pill(t, false, true); }).join("");
        if (modsOff.length > 6) {
          h += '<span class="pill dead">+' + (modsOff.length - 6) + "</span>";
        }
      }
      rows.push(["Verbessert durch", h]);
      live += modsOn.length;
      if (!modsOn.length) dead++;
    }

    // Ausgehend: Tooltip-Refs + Basemods dieses Talents. Varianten decken die Basis.
    var outBases = [];
    (REL[i][2] || []).forEach(function (r) { pushUniq(outBases, r); });
    (MODOF[i] || []).forEach(function (r) { pushUniq(outBases, r); });
    var targetsOn = liveFromBases(have, outBases).filter(function (t) {
      return !sameGcdSlot(i, t);
    });
    var targetsOff = outBases.filter(function (r) {
      return !haveInherited(have, r) && !sameGcdSlot(i, r);
    });
    if (targetsOn.length || (showMissing && targetsOff.length)) {
      var h2 = targetsOn.map(function (r) { return pill(r, true, false); }).join("");
      if (showMissing) {
        h2 += targetsOff.slice(0, 6).map(function (r) { return pill(r, false, true); }).join("");
        if (targetsOff.length > 6) {
          h2 += '<span class="pill dead">+' + (targetsOff.length - 6) + "</span>";
        }
      }
      rows.push(["Wirkt auf", h2]);
      live += targetsOn.length;
    }

    // Eingehend: wer nennt dich oder deine Basis — Richtung: die zahlen EIN.
    var back = [];
    function takeBack(r) {
      if (have[r] && mods.indexOf(r) < 0 && !sameGcdSlot(i, r)) pushUniq(back, r);
    }
    (refBy()[i] || []).forEach(takeBack);
    if (base !== null && base !== undefined) {
      (refBy()[base] || []).forEach(takeBack);
    }
    if (back.length) {
      rows.push(["Zahlt ein", back.map(function (r) {
        return pill(r, true, false);
      }).join("")]);
      live += back.length;
    }

    var gate = REL[i][4];
    if (gate) {
      rows.push(["Sperre", '<em>' + esc(gate[0]) + ":</em> " + esc(gate[1])]);
    }
    var gcdPeers = [];
    var dg = REL[i][3];
    if (dg >= 0) {
      gcdPeers = Object.keys(have).map(Number).filter(function (k) {
        return k !== i && sameGcdSlot(i, k);
      });
      if (gcdPeers.length) {
        rows.push(["Gleicher GCD", "<em>ein Slot — nicht parallel</em> " +
          gcdPeers.map(function (k) { return pill(k, false, false); }).join("")]);
        // bewusst kein live++ — Dubletten sind kein zusätzlicher Takt
        dead++;
      }
    }
    var cdPeers = [];
    var cg = REL[i][5];
    if (cg >= 0) {
      cdPeers = Object.keys(have).map(Number).filter(function (k) {
        return k !== i && REL[k] && REL[k][5] === cg;
      });
      if (cdPeers.length) {
        rows.push(["Geteilter CD", '<em>' + esc(CDG[cg] || "gemeinsam") + "</em> " +
          cdPeers.map(function (k) { return pill(k, false, false); }).join("")]);
        dead++;
      }
    }

    var fromUses = (REL[i][0] === null || REL[i][0] === undefined) &&
      base !== null && base !== undefined;
    return {
      rows: rows, live: live, dead: dead,
      gcdPeers: gcdPeers, cdPeers: cdPeers, fromUses: fromUses
    };
  }

  function renderChains(ids) {
    var box = document.getElementById("chainbox");
    if (!box) return;
    var onlyLive = document.getElementById("chainOnlyLive");
    var showMiss = document.getElementById("chainShowMissing");
    onlyLive = !onlyLive || onlyLive.checked;
    showMiss = showMiss && showMiss.checked;

    var have = {}; ids.forEach(function (i) { have[i] = 1; });
    var cards = [], linked = 0, orphans = 0, gcdWarn = 0;

    ids.slice().sort(function (a, b) {
      return CAT[a][1] - CAT[b][1] || CAT[b][3] - CAT[a][3];
    }).forEach(function (i) {
      var c = chainOf(i, have, showMiss);
      if (c.live) linked++;
      // Talent ist tot, wenn keine genannte Basis und keine Schulvariante greift.
      var orphan = false;
      if (CAT[i][1] === 1) {
        var tBases = [];
        (REL[i][2] || []).forEach(function (r) { pushUniq(tBases, r); });
        (MODOF[i] || []).forEach(function (r) { pushUniq(tBases, r); });
        orphan = tBases.length > 0 && !tBases.some(function (b) {
          return haveInherited(have, b);
        });
      }
      if (orphan) orphans++;
      if (c.gcdPeers.length) gcdWarn++;
      // Nur echte Kanten, tote Talente, geteilter GCD/CD — nicht jede uses-Zeile.
      var notable = c.live || orphan || c.gcdPeers.length || c.cdPeers.length;
      if (onlyLive && !notable) return;

      var s = SC[i] || {}, m = MC[i] || {}, foot = [];
      if (s.w) foot.push(s.w + " % Waffe" + (s.sch ? " " + s.sch : ""));
      if (s.flat) foot.push(s.flat[0] + "–" + s.flat[1]);
      if (s.heal) foot.push("Heil " + s.heal[0] + "–" + s.heal[1]);
      if (s.proc) foot.push(fmt(s.proc) + " % Proc");
      else if (METH_GAP[i] && METH_GAP[i].why === "proc_ohne_schaden") {
        foot.push("Proc · Zahl fehlt");
      } else if (m.proc) foot.push(fmt(m.proc) + " % Proc");
      if (m.cd) foot.push("CD " + secs(m.cd));
      if (m.cost) foot.push(m.cost + " " + m.res);

      var meta = (CAT[i][1] ? "TAL" : "ABI") + " · lvl" + CAT[i][4];
      if (c.live) meta += " · " + c.live + (c.live === 1 ? " Kante" : " Kanten");
      if (c.gcdPeers.length) meta += " · gleicher GCD";
      if (c.cdPeers.length) meta += " · geteilter CD";

      var lead = "";
      if (orphan) {
        lead += '<div class="chn-foot" style="color:var(--warn)">Wirkt nicht: ' +
          "keine genannte Fähigkeit und keine Schulvariante im Build.</div>";
      } else if (c.gcdPeers.length) {
        lead += '<div class="chn-foot"><em>Gleicher GCD — ein Slot:</em> ' +
          c.gcdPeers.map(function (k) { return pill(k, false, false); }).join("") +
          "</div>";
      }
      if (!orphan && c.cdPeers.length) {
        lead += '<div class="chn-foot"><em>Geteilter CD</em> (' +
          esc(CDG[REL[i][5]] || "gemeinsam") + "): " +
          c.cdPeers.map(function (k) { return pill(k, false, false); }).join("") +
          "</div>";
      }
      if (!orphan && foot.length) {
        lead += '<div class="chn-foot">' + esc(foot.join(" · ")) + "</div>";
      }

      // GCD/CD stehen sichtbar oben — Details nur Vererbung und Kanten.
      var detRows = c.rows.filter(function (r) {
        return r[0] !== "Gleicher GCD" && r[0] !== "Geteilter CD";
      });
      var bodyRows = detRows.length
        ? detRows.map(function (r) {
            return '<div class="lnk"><b>' + esc(r[0]) + "</b><span>" + r[1] + "</span></div>";
          }).join("")
        : "";
      var detLabel = "Verkettung (" + detRows.length + ")";
      if (detRows.length === 1 && detRows[0][0] === "Erbt Talente") {
        detLabel = c.fromUses ? "Talente der Basis" : "Vererbung";
      }
      cards.push('<div class="chn' + (orphan ? " orphan" : "") + '">' +
        '<div class="chn-hd"><span class="icon" style="width:22px;height:22px;' +
        'flex:0 0 22px;' + iconStyle(i, 22) + '"></span>' +
        '<span class="nm q' + CAT[i][3] + '">' +
        esc(CAT[i][0]) + "</span>" +
        '<span class="meta">' + meta + "</span></div>" +
        lead +
        (bodyRows
          ? wrapDetails('<div class="chn-body">' + bodyRows + "</div>", detLabel)
          : "") +
        "</div>");
    });

    var k = document.getElementById("cK"), k2 = document.getElementById("cK2");
    var label = ids.length
      ? (linked + " verkettet" +
        (gcdWarn ? " · " + gcdWarn + " gleicher GCD" : "") +
        (orphans ? " · " + orphans + " tot" : ""))
      : "—";
    if (k) { k.textContent = ids.length ? String(linked) : "—"; }
    if (k2) {
      k2.textContent = label;
      k2.className = "cnt " + (orphans || gcdWarn ? "over" : linked ? "ok" : "");
    }

    box.innerHTML = ids.length
      ? (cards.length
        ? '<div class="chaingrid">' + cards.slice(0, 6).join("") + "</div>" +
          (cards.length > 6
            ? wrapDetails('<div class="chaingrid">' + cards.slice(6).join("") + "</div>",
              "Weitere Ketten (" + (cards.length - 6) + ")")
            : "")
        : emptyState(
          "Keine Verknüpfung im Katalog.",
          "<p>Häkchen oben ausschalten, um trotzdem alle Einträge zu sehen.</p>"))
      : emptyState(
        "Wähle Fähigkeiten und Talente.",
        "<p>Dann steht hier, was auf was einzahlt und was ins Leere läuft.</p>");
  }

  document.addEventListener("change", function (e) {
    if (e.target.id === "chainOnlyLive" || e.target.id === "chainShowMissing") {
      renderChains(Object.keys(picked).map(Number));
    }
  });

  // Zähler, die an zwei Stellen stehen (Kopfbalken und Panel-Kopf).
  function mirror(from, to) {
    var a = document.getElementById(from), b = document.getElementById(to);
    if (a && b) {
      b.innerHTML = a.innerHTML;
      b.className = a.className;
    }
  }
  function syncHeader() {
    mirror("cI", "cI2");
    mirror("cP", "cP2");
    var chip = document.getElementById("chipChar");
    var val = document.getElementById("chipCharVal");
    var go = document.getElementById("chipImport");
    var hint = document.getElementById("statusHint");
    if (chip || val) {
      var label = CHAR
        ? (CHAR.name || "importiert") + " · " + (CHAR.level || "?") +
          " · " + (CHAR.path || "?")
        : "kein Charakter";
      if (val) val.textContent = label;
      else if (chip) chip.textContent = label;
      if (chip) chip.classList.toggle("set", !!CHAR);
    }
    if (go) go.hidden = !!CHAR;
    if (hint) hint.hidden = !!CHAR;
    function bindJumpChip(el, key, title) {
      if (!el) return;
      el.setAttribute("data-jump", key);
      if (title) el.title = title;
      el.classList.add("chip-jump");
      var nested = el.querySelector("a, button");
      var native = el.tagName === "A" || el.tagName === "BUTTON";
      if (native || nested) {
        el.removeAttribute("role");
        if (!native) el.removeAttribute("tabindex");
        if (nested) el.removeAttribute("aria-label");
        else if (title) el.setAttribute("aria-label", title);
        return;
      }
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      if (title) el.setAttribute("aria-label", title);
    }
    var ci = document.getElementById("chipIssues");
    var ciHd = document.getElementById("cI");
    var nKrit = ciHd ? +(ciHd.getAttribute("data-krit") || 0) : 0;
    var nFix = ciHd ? +(ciHd.getAttribute("data-fix") || 0) : 0;
    if (ci) {
      ci.classList.toggle("bad", nKrit > 0);
    }
    bindJumpChip(ci,
      nKrit ? "issues-krit" : nFix ? "issues-fix" : "issues",
      nKrit ? "Zu kritischen Befunden springen"
        : nFix ? "Zu verbesserbaren Befunden springen"
        : "Zum Befund springen");
    bindJumpChip(document.getElementById("chipPath"), "paths",
      "Zur Path-Empfehlung springen");
    bindJumpChip(document.getElementById("chipChar"), CHAR ? "char" : "import",
      CHAR ? "Zum importierten Charakter springen" : "Zum Import springen");
    bindJumpChip(document.getElementById("chipImport"), "import",
      "Zum Import springen");
    var ca = document.getElementById("cA");
    bindJumpChip(ca && ca.parentElement, "slotsA", "Zu den Abilities springen");
    var ct = document.getElementById("cT");
    bindJumpChip(ct && ct.parentElement, "slotsT", "Zu den Talenten springen");
    var ketten = document.getElementById("tab-vChain");
    if (ketten) {
      ketten.setAttribute("data-jump", "chain");
      ketten.title = "Zu den Wirkungsketten springen";
    }
    function bindCnt(id, key, title) {
      var el = document.getElementById(id);
      if (!el) return;
      el.setAttribute("data-jump", key);
      if (title) el.title = title;
      if (el.tagName !== "A" && el.tagName !== "BUTTON" &&
          !el.closest("button, a")) {
        el.setAttribute("role", "button");
        if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
      }
    }
    bindCnt("cI2", nKrit ? "issues-krit" : nFix ? "issues-fix" : "issues",
      nKrit ? "Zu kritischen Befunden springen"
        : nFix ? "Zu verbesserbaren Befunden springen"
        : "Zum Befund springen");
    bindCnt("cP2", "paths", "Zur Path-Empfehlung springen");
    bindCnt("cB", "stats", "Zur Stat-Priorität springen");
    var hasCards = !!(CHAR && CHAR.scard && CHAR.scard.some(function (s) {
      return s && !s.blocked;
    }));
    bindCnt("cG", hasCards ? "scard" : "gear",
      hasCards ? "Zu den Skill Cards springen" : "Zur Ausrüstung springen");
    bindCnt("cK", "chain", "Zu den Wirkungsketten springen");
    bindCnt("cK2", "chain", "Zu den Wirkungsketten springen");
    bindCnt("cC", CHAR ? "char" : "import",
      CHAR ? "Zum importierten Charakter springen" : "Zum Import springen");
    bindCnt("cV", "sug", "Zu den Vorschlägen springen");
    bindCnt("cS", "scale", "Zur Skalierung springen");
    bindCnt("cF", "struct", "Zur Struktur springen");
    bindCnt("cM", "meth", "Zur Tag-Struktur springen");
    bindCnt("cX", "cmp", "Zum Vergleich springen");
  }

  // ---------- Merken ----------
  var STORE = "aldi-buildschmiede-v1";
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        b: encode(),
        c: CHAR ? document.getElementById("pasteBox").value : "",
        frame: FRAME_PREF
      }));
    } catch (e) { /* Privatmodus: dann eben nicht */ }
  }
  function restore() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return false;
      var d = JSON.parse(raw);
      var any = false;
      // Erst den Charakter: der bringt Stufe, Path und Budget zurueck und
      // setzt dabei auch die Auswahl aus dem Export.
      if (d.c) {
        var p = parseExport(d.c);
        if (p) {
          document.getElementById("pasteBox").value = d.c;
          applyImport(p);
          any = true;
        }
      }
      // Dann die gespeicherte Auswahl darueber. Ohne diesen Schritt kam
      // nach jedem Neuladen der importierte Build zurueck statt des
      // bearbeiteten - alle Aenderungen waeren still verloren gewesen.
      if (d.b) { decode(d.b); any = true; }
      if (d.frame === "levelrun" || d.frame === "endgame" ||
          d.frame === "auto") {
        FRAME_PREF = d.frame;
      }
      return any;
    } catch (e) { /* kaputter Eintrag: ignorieren */ }
    return false;
  }

  // ---------- Vergleich ----------
  // Zwei Builds nebeneinander. Als Quelle taugt beides: ein geteilter Link
  // oder ein Export aus dem Spiel (auch der von "/bs target").

  var RIVAL = null;

  function idsFromExport(d) {
    var ids = [], miss = [];
    function take(tok) {
      var r = resolveTok(tok);
      if (!r) miss.push(tok.n || "?"); else ids.push(r.i);
    }
    (d.abi || []).forEach(function (t) {
      take(typeof t === "string" ? parseAbiToken(t) : t);
    });
    (d.tal || []).forEach(function (t) {
      take(typeof t === "string" ? parseTalToken(t) : t);
    });
    return { ids: ids, miss: miss };
  }

  function parseRival(text) {
    text = String(text || "").trim();
    if (!text) return null;

    // Erst der Link: alles nach b= bis zum naechsten Trennzeichen.
    var m = text.match(/b=([0-9a-z.]+)/i);
    if (m && text.indexOf("CHAR|") < 0) {
      var ids = [];
      m[1].split(".").forEach(function (t) {
        var n = parseInt(t, 36);
        if (!isNaN(n) && n >= 0 && n < CAT.length) ids.push(n);
      });
      return ids.length ? { name: "Geteilter Build", ids: ids, stats: {} } : null;
    }

    var d = parseExport(text);
    if (!d) return null;
    var r = idsFromExport(d);
    return {
      name: d.name || "Fremder Build", level: d.level, path: d.path,
      cls: d.cls, ids: r.ids, miss: r.miss, stats: d.stats || {},
      ilvl: d.ilvl, inspect: !!d.inspect, weapons: d.weapons || [],
      gear: d.gear || [],
      spec: d.spec, specName: d.specName, specs: d.specs || [],
      mode: d.mode, locked: d.locked || [],
      essA: d.essA, essT: d.essT,
      essASpent: d.essASpent, essTSpent: d.essTSpent,
      scard: d.scard || [], carded: d.carded || []
    };
  }

  // Kennzahlen, die einen Build in einer Zeile beschreiben.
  function fingerprint(ids) {
    var p = profile(ids);
    var mult = 0, wsum = 0, ele = 0;
    ids.forEach(function (i) {
      var s = SC[i];
      if (!s) return;
      if (s.w) { wsum += s.w; if (s.sch) ele++; }
      (s.inc || []).forEach(function (x) {
        if (x[2] === "dmg" || x[2] === "heal") mult += x[0];
      });
    });
    var q = [0, 0, 0, 0, 0];
    ids.forEach(function (i) { q[CAT[i][3]]++; });
    return {
      n: ids.length,
      abi: ids.filter(function (i) { return CAT[i][1] === 0; }).length,
      tal: ids.filter(function (i) { return CAT[i][1] === 1; }).length,
      w: p.w, wm: p.wm, h: p.h, ele: ele,
      wsum: wsum, mult: mult, q: q,
      path: scorePaths(p)[0]
    };
  }

  // Semantik aus DEINER Sicht: gut = du liegst vorn, warn = er liegt vorn.
  // Ein "+" in der Spalte heisst immer, dass er mehr davon hat.
  function cmpCell(a, b, label, unit) {
    var d = b - a;
    var cls = d === 0 ? "" : (d > 0 ? "warn" : "good");
    return "<tr><td>" + esc(label) + '</td><td class="num">' + fmtN(a) + (unit || "") +
      '</td><td class="num">' + fmtN(b) + (unit || "") +
      '</td><td class="num ' + cls + '">' +
      (d === 0 ? "—" : (d > 0 ? "+" : "") + fmtN(d) + (unit || "")) + "</td></tr>";
  }
  function fmtN(v) {
    if (typeof v !== "number" || isNaN(v)) return "—";
    return String(Math.round(v * 10) / 10).replace(".", ",");
  }

  function renderCompare() {
    var box = document.getElementById("cmpbox");
    var hd = document.getElementById("cX");
    if (!box) return;
    if (!RIVAL) {
      hd.textContent = "—"; hd.className = "cnt";
      box.innerHTML = emptyState(
        "Noch nichts zu vergleichen.",
        "<p>Füge oben einen Build-Link oder einen Export ein. " +
          "<code>/bs target</code> im Spiel liest den Build deines Ziels aus.</p>");
      return;
    }

    var mine = Object.keys(picked).map(Number);
    var his = RIVAL.ids;
    var hasMine = {}; mine.forEach(function (i) { hasMine[i] = 1; });
    var hasHis = {}; his.forEach(function (i) { hasHis[i] = 1; });

    var both = mine.filter(function (i) { return hasHis[i]; });
    var onlyMine = mine.filter(function (i) { return !hasHis[i]; });
    var onlyHis = his.filter(function (i) { return !hasMine[i]; });

    var A = fingerprint(mine), B = fingerprint(his);
    hd.textContent = both.length + " gleich";
    hd.className = "cnt ok";

    var o = [];

    o.push('<div class="cmphd"><span>' +
      esc(CHAR && CHAR.name ? CHAR.name : "Dein Build") +
      (CHAR && CHAR.specName ? " · " + esc(CHAR.specName) :
        CHAR && CHAR.spec ? " · Spec #" + CHAR.spec : "") +
      (CHAR && CHAR.specs && CHAR.specs.length
        ? " · Specs: " + CHAR.specs.join(", ") : "") +
      "</span>" +
      '<span class="vs">gegen</span><span>' + esc(RIVAL.name) +
      (RIVAL.level ? " · Stufe " + RIVAL.level : "") +
      (RIVAL.path ? " · Path of " + esc(RIVAL.path) : "") +
      (RIVAL.specName ? " · " + esc(RIVAL.specName) :
        RIVAL.spec ? " · Spec #" + RIVAL.spec : "") +
      (RIVAL.specs && RIVAL.specs.length
        ? " · Specs: " + RIVAL.specs.join(", ") : "") +
      (RIVAL.inspect ? ' <span class="tagm">inspiziert</span>' : "") +
      "</span></div>");

    var metaBits = [];
    if (CHAR && (CHAR.essA !== undefined || RIVAL.essA !== undefined)) {
      metaBits.push("Essence frei du " + (CHAR.essA || 0) + "/" + (CHAR.essT || 0) +
        " · er " + (RIVAL.essA || 0) + "/" + (RIVAL.essT || 0));
    }
    if (CHAR && (CHAR.essASpent !== undefined || RIVAL.essASpent !== undefined)) {
      metaBits.push("ausgegeben du " + (CHAR.essASpent || 0) + "/" +
        (CHAR.essTSpent || 0) + " · er " + (RIVAL.essASpent || 0) + "/" +
        (RIVAL.essTSpent || 0));
    }
    if ((CHAR && CHAR.locked && CHAR.locked.length) ||
        (RIVAL.locked && RIVAL.locked.length)) {
      metaBits.push("Locks du " + ((CHAR && CHAR.locked) || []).length +
        " · er " + (RIVAL.locked || []).length);
    }
    if (metaBits.length) {
      o.push('<div class="qhint">' + metaBits.map(esc).join(" · ") + "</div>");
    }

    o.push('<div class="cmpsplit"><span class="c-mine">' + onlyMine.length +
      " nur bei dir</span><span class=\"c-both\">" + both.length +
      ' gleich</span><span class="c-his">' + onlyHis.length +
      " nur bei ihm</span></div>");

    // Zahlen nebeneinander
    o.push('<div class="tblwrap"><table class="stat cmp"><thead><tr><th></th>' +
      "<th>du</th><th>er</th><th>er − du</th></tr></thead><tbody>");
    o.push(cmpCell(A.abi, B.abi, "Abilities"));
    o.push(cmpCell(A.tal, B.tal, "Talente"));
    o.push(cmpCell(A.w, B.w, "Waffenangriffe"));
    o.push(cmpCell(A.ele, B.ele, "davon elementar"));
    o.push(cmpCell(A.wsum, B.wsum, "Waffenprozente gesamt", " %"));
    o.push(cmpCell(A.mult, B.mult, "Multiplikatoren", " %"));
    o.push(cmpCell(A.h, B.h, "heilende Einträge"));
    o.push(cmpCell(A.q[4], B.q[4], "Legendary"));
    o.push(cmpCell(A.q[3], B.q[3], "Epic"));
    if (CHAR && RIVAL.stats && RIVAL.stats.SP !== undefined) {
      o.push('<tr class="sep"><td colspan="4">Charakterwerte</td></tr>');
      o.push(cmpCell(CHAR.stats.SP, RIVAL.stats.SP, "Spell Power"));
      o.push(cmpCell(CHAR.stats.AP, RIVAL.stats.AP, "Attack Power"));
      o.push(cmpCell(CHAR.stats.CRIT, RIVAL.stats.CRIT, "Melee-Crit", " %"));
      o.push(cmpCell(CHAR.stats.SCRIT, RIVAL.stats.SCRIT, "Spell-Crit", " %"));
    }
    if (CHAR && CHAR.ilvl && RIVAL.ilvl) {
      o.push(cmpCell(CHAR.ilvl, RIVAL.ilvl, "Gegenstandsstufe"));
    }
    o.push("</tbody></table></div>");
    o.push('<div class="qhint"><span class="lg good">du vorn</span> · ' +
      '<span class="lg warn">er vorn</span>. Mehr ist nicht automatisch besser — ' +
      "zwei Legendaries weniger können am Budget liegen, nicht an schlechteren " +
      "Fähigkeiten.</div>");

    // Gear slot-by-slot, nur was beide Exporte liefern — keine erfundenen Stats
    if (CHAR && (CHAR.gear || []).length && (RIVAL.gear || []).length) {
      var myG = gearBySlot(CHAR.gear), hisG = gearBySlot(RIVAL.gear);
      o.push('<div class="schd">Ausrüstung nach Slot</div>');
      o.push('<div class="tblwrap"><table class="stat cmp"><thead><tr>' +
        "<th>Slot</th><th>du</th><th>er</th></tr></thead><tbody>");
      ALL_GEAR_SLOTS.forEach(function (slot) {
        var a = myG[slot], b = hisG[slot];
        if (!a && !b) return;
        var same = a && b && (
          (a.itemId && b.itemId && a.itemId === b.itemId) ||
          (!a.itemId && !b.itemId && a.name === b.name && a.ilvl === b.ilvl)
        );
        function cell(g) {
          if (!g) return "—";
          var tone = gearQTone(g.q);
          return '<span style="color:var(--q' + tone + ')">' + esc(g.name) +
            "</span> <span class=\"meta\">ilvl " + g.ilvl +
            (g.itemId ? " #" + g.itemId : "") + "</span>";
        }
        o.push("<tr class=\"" + (same ? "same" : "diff") + "\"><td>" +
          esc(GEAR_LABEL[slot] || slot) + "</td><td>" + cell(a) +
          "</td><td>" + cell(b) + "</td></tr>");
      });
      o.push("</tbody></table></div>");
    }

    // Empfohlener Path je Build - der interessanteste Unterschied
    if (A.path && B.path && A.path.k !== B.path.k) {
      o.push('<div class="flag pre"><b>Andere Ausrichtung</b> ' +
        "Dein Build spricht für <b>" + esc(PATHBY[A.path.k].n) + "</b>, sein Build für <b>" +
        esc(PATHBY[B.path.k].n) + "</b>. Das sind keine vergleichbaren Builds — ein direkter " +
        "Vergleich der Zahlen oben führt in die Irre.</div>");
    }

    // Listen
    function list(title, arr, addable) {
      if (!arr.length) return;
      o.push('<div class="schd">' + title + "</div>");
      arr.sort(function (a, b) { return CAT[b][3] - CAT[a][3]; })
        .slice(0, 14).forEach(function (i) {
          // Warum du das nicht einfach uebernehmen kannst - vor dem Klick,
          // nicht erst danach.
          var stop = null;
          if (addable) {
            if (tooHigh(i)) stop = "Stufe " + CAT[i][4];
            else if (overBudget(i)) stop = QN[CAT[i][3]] + "-Budget voll";
            else if (CAT[i][1] === 1 && counts().t >= MAX_T) stop = "Talente voll";
            else if (CAT[i][1] === 0 && counts().a >= MAX_A) stop = "Abilities voll";
          }
          o.push('<div class="cmprow' + (addable ? " add" : "") +
            (stop ? " locked" : "") + '"' +
            (addable && !stop ? ' data-add="' + i + '" role="button" tabindex="0"' : "") + ">" +
            '<span class="icon" style="width:20px;height:20px;flex:0 0 20px;' +
            iconStyle(i, 20) + '"></span>' +
            '<span class="nm q' + CAT[i][3] + '">' +
            esc(CAT[i][0]) + "</span>" +
            (stop ? '<span class="stop">' + esc(stop) + "</span>"
                  : (addable ? '<span class="sugadd">+</span>' : "")) + "</div>");
        });
      if (arr.length > 14) {
        o.push('<div class="qhint">… und ' + (arr.length - 14) + " weitere</div>");
      }
    }
    list("Hat er, du nicht — klicken zum Übernehmen", onlyHis, true);
    list("Hast nur du", onlyMine, false);

    if (RIVAL.miss && RIVAL.miss.length) {
      o.push('<div class="qhint">' + RIVAL.miss.length +
        " Einträge seines Builds kennt der Katalog nicht: " +
        RIVAL.miss.slice(0, 5).map(esc).join(", ") + ".</div>");
    }

    box.innerHTML = o.join("");
  }

  document.getElementById("bCmp").addEventListener("click", function () {
    var v = document.getElementById("cmpBox").value;
    var r = parseRival(v);
    if (!r) { toast("Weder Link noch Export erkannt"); return; }
    RIVAL = r;
    renderCompare();
    refreshOfficial();
    renderArchetypes();
    toast("Vergleich mit " + r.name);
  });
  document.getElementById("bCmpClear").addEventListener("click", function () {
    RIVAL = null;
    document.getElementById("cmpBox").value = "";
    document.getElementById("cmpbox").innerHTML = "";
    document.getElementById("cX").textContent = "—";
  });

  // ---------- Sortierung ----------
  // Der Katalog kam bisher in Rohreihenfolge. Sobald ein Charakter da ist,
  // ist "geschaetzter Treffer" die interessanteste Reihenfolge - vorher
  // taugt sie nicht, weil ohne Waffenschaden alles 0 waere.
  function sortKey(mode, i) {
    var s = SC[i] || {};
    if (mode === "name") return CAT[i][0].toLowerCase();
    if (mode === "qual") return -(CAT[i][3] * 1000 + (1000 - (CAT[i][4] || 0)));
    if (mode === "level") return CAT[i][4] || 0;
    if (mode === "wpct") return -(s.w || 0);
    if (mode === "dmg") return -estHit(i);
    if (mode === "cyc") return -perCycle(i);
    return i;
  }
  function estHit(i) {
    var s = SC[i];
    if (!s || !s.w || !CHAR) return 0;
    var w = CHAR.weapons.filter(function (x) {
      return x.slot === (s.wh === "oh" ? "OH" : s.wh === "ranged" ? "RANGED" : "MH");
    })[0];
    if (!w || !w.dmg) return 0;
    var m = String(w.dmg).match(/(\d+)\s*-\s*(\d+)/);
    if (!m) return 0;
    return ((+m[1] + +m[2]) / 2) * s.w / 100;
  }

  // ---------- Archetyp als Startpunkt ----------
  // Die 21 Archetypen lagen ungenutzt in den Daten. Sie ersetzen keine
  // Feinarbeit, aber ein leeres Blatt ist der schlechteste Startpunkt.
  function loadArchetype(name) {
    var list = ARCH[name];
    if (!list || !list.length) { toast("Unbekannter Archetyp"); return; }
    var added = 0, addedT = 0, skipped = 0, reasons = {};
    function note(r) { reasons[r] = (reasons[r] || 0) + 1; skipped++; }

    var take = function (i) {
      if (picked[i]) return;
      var c = counts();
      if (CAT[i][1] === 1 && c.t >= MAX_T) return note("Talente voll");
      if (CAT[i][1] === 0 && c.a >= MAX_A) return note("Abilities voll");
      if (tooHigh(i)) return note("Stufe zu hoch");
      recountBudget();
      if (overBudget(i)) return note("Seltenheits-Budget");
      // Keine zweite Variante derselben Sache dazulegen.
      var g = REL[i][3];
      if (g >= 0) {
        var clash = Object.keys(picked).some(function (k) { return REL[k][3] === g; });
        if (clash) return note("Dublette");
      }
      picked[i] = true;
      return true;
    };

    list.forEach(function (i) { if (take(i)) added++; });

    // Die Archetypen im Katalog bestehen ausschliesslich aus Faehigkeiten.
    // Ein Grundgeruest ohne ein einziges Talent skaliert nicht - also die
    // Talente dazuholen, die genau diese Faehigkeiten verbessern.
    var wantT = {};
    Object.keys(picked).map(Number).forEach(function (i) {
      (BM[i] || []).forEach(function (t) { wantT[t] = (wantT[t] || 0) + 1; });
      var b = inheritBase(i);
      if (b !== null && b !== undefined) {
        (BM[b] || []).forEach(function (t) { wantT[t] = (wantT[t] || 0) + 1; });
      }
    });
    Object.keys(wantT).map(Number)
      .sort(function (a, b) { return wantT[b] - wantT[a] || CAT[b][3] - CAT[a][3]; })
      .forEach(function (t) { if (take(t)) addedT++; });

    refresh();
    var tail = Object.keys(reasons).map(function (r) {
      return reasons[r] + "× " + r;
    }).join(", ");
    toast(added + " Fähigkeiten" +
      (addedT ? " + " + addedT + " passende Talente" : "") +
      (skipped ? " · " + skipped + " übersprungen (" + tail + ")" : ""));
  }

  function renderArchetypes() {
    var box = document.getElementById("archbox");
    if (!box) return;
    var names = Object.keys(ARCH).sort(function (a, b) {
      return ARCH[b].length - ARCH[a].length || a.localeCompare(b);
    });

    // Wie viele davon passen ueberhaupt in dein Budget? Das vorher zu sagen
    // ist ehrlicher, als hinterher "11 uebersprungen" zu melden.
    function fits(n) {
      var free = [0, 0, 0, 0, 0], any = false;
      for (var q = 1; q <= 4; q++) {
        var lim = qualityLimit(q);
        if (lim) { any = true; free[q] = Math.max(0, lim - USE[q]); }
      }
      if (!any) return null;
      var used = [0, 0, 0, 0, 0], ok = 0;
      ARCH[n].forEach(function (i) {
        var q = entryQual(i);
        if (picked[i]) return;
        if (!qualityLimit(q)) { ok++; return; }
        if (used[q] + entryCost(i) <= free[q]) { used[q] += entryCost(i); ok++; }
      });
      return ok;
    }

    // Zusammensetzung: Archetypen sind im Katalog reine Faehigkeitslisten.
    function mix(n) {
      var q = {};
      ARCH[n].forEach(function (i) { q[CAT[i][3]] = (q[CAT[i][3]] || 0) + 1; });
      return Object.keys(q).sort(function (a, b) { return b - a; })
        .map(function (k) { return q[k] + " " + QN[k]; }).join(", ");
    }

    box.innerHTML =
      '<div class="qhint">Ein Archetyp ist im Katalog eine <em>reine ' +
      "Fähigkeitsliste</em> — Talente bringt er keine mit, die suchst du " +
      "danach selbst (der Kasten <em>Passt dazu</em> hilft dabei). Fast alle " +
      "bestehen aus Epics, dein Epic-Budget entscheidet also, wie viele du " +
      "wirklich bekommst. Deine bestehende Auswahl bleibt stehen.</div>" +
      '<div class="archgrid">' + names.map(function (n) {
        var f = fits(n);
        return '<button class="archb" data-arch="' + esc(n) + '" title="' +
          esc(mix(n)) + '">' + esc(n) +
          "<span>" + (f === null ? ARCH[n].length
                                 : f + " / " + ARCH[n].length) + "</span></button>";
      }).join("") + "</div>";
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-arch]");
    if (b) loadArchetype(b.dataset.arch);
  });

  // ---------- Offizieller Build-Code ----------
  // Das Addon liefert ihn mit; der Client baut daraus eine ascension.gg-URL
  // (CharacterAdvancementUtil.GetBuildWebURL).
  function officialLink() {
    if (!CHAR || !CHAR.code) return "";
    return "https://ascension.gg/v2/builder/area-52/overview/" +
      encodeURIComponent(CHAR.code);
  }

  // ---------- Teilen ----------
  function encode() {
    var ids = Object.keys(picked).map(Number).sort(function (a, b) { return a - b; });
    return ids.map(function (n) { return n.toString(36); }).join(".");
  }
  function decode(s) {
    picked = Object.create(null);
    (s || "").split(".").forEach(function (t) {
      var n = parseInt(t, 36);
      if (!isNaN(n) && n >= 0 && n < CAT.length) picked[n] = true;
    });
  }
  function shareUrl() {
    return location.origin + location.pathname + "#b=" + encode();
  }

  document.getElementById("bLink").addEventListener("click", function () {
    var u = shareUrl();
    el.url.value = u;
    location.hash = "b=" + encode();
    el.url.select();
    try {
      navigator.clipboard.writeText(u);
      toast("Link kopiert");
    } catch (e) {
      document.execCommand("copy");
      toast("Link kopiert");
    }
  });
  document.getElementById("bText").addEventListener("click", function () {
    var A = [], T = [];
    Object.keys(picked).map(Number).forEach(function (i) {
      (CAT[i][1] ? T : A).push(CAT[i][0] + " (" + QN[CAT[i][3]] + ", lvl" + CAT[i][4] + ")");
    });
    A.sort(); T.sort();
    var txt = "ALDI EHRFÜRCHTIG — Build\n\n" +
      "ABILITIES (" + A.length + "/30)\n" + A.map(function (s) { return "  " + s; }).join("\n") +
      "\n\nTALENTE (" + T.length + "/25)\n" + T.map(function (s) { return "  " + s; }).join("\n");
    el.url.value = txt.slice(0, 200) + " …";
    try { navigator.clipboard.writeText(txt); toast("Build als Text kopiert"); }
    catch (e) { toast("Kopieren nicht möglich"); }
  });
  // Wenn das Addon den offiziellen Code mitgeliefert hat, ist der Link
  // zum Ascension-Builder geschenkt.
  function refreshOfficial() {
    var host = document.getElementById("official");
    if (!host) return;
    var u = officialLink();
    host.innerHTML = u
      ? 'Offizieller Build-Code aus dem Spiel: <a href="' + esc(u) +
        '" target="_blank" rel="noopener">bei ascension.gg öffnen</a>'
      : "";
  }

  document.getElementById("bAI").addEventListener("click", function () {
    var ids = Object.keys(picked);
    if (!ids.length) { toast("Erst einen Build wählen"); return; }
    var txt = buildPrompt();
    el.url.value = txt.slice(0, 120) + " …";
    try {
      navigator.clipboard.writeText(txt);
      toast("Prompt kopiert (" + Math.round(txt.length / 100) / 10 + " k Zeichen)");
    } catch (e) { toast("Kopieren nicht möglich"); }
  });

  // ---------- Methoden (Wissen-Reiter, statisch aus D.meth) ----------
  // Pipeline: pipeline/methods.py → data/methods.json. Keine Nachrechnung
  // von Koeffizienten hier — nur Anzeige.
  var CONF_DE = { high: "hoch", mid: "mittel", low: "niedrig" };
  var WHY_DE = {
    schadenstext_ohne_zahl: "Schadenstext, Zahl fehlt",
    nur_multiplikator_kein_basisschaden: "nur Multiplikator, kein Basisschaden",
    proc_ohne_schaden: "Proc ohne Schadenszahl",
    flat_ohne_koeffizient: "Flat ohne SP/AP-Koeffizient"
  };

  function methName(i) {
    return (CAT[i] && CAT[i][0]) || ("#" + i);
  }

  // Build-Fingerprint aus Ascension SpellTags.dbc — nur Tag-Präsenz, keine DPS-Zahlen.
  function spellTagFingerprint(ids) {
    var facets = stagFacetList();
    var covered = {};
    var schools = {};
    var tagged = 0;
    facets.forEach(function (f) { covered[f.key] = false; });
    (ids || []).forEach(function (i) {
      var e = STAG_BY_I[i];
      if (!e) return;
      tagged++;
      (e.facets || []).forEach(function (k) { covered[k] = true; });
      (e.schools || []).forEach(function (s) { schools[s] = 1; });
    });
    var score = 0, max = 0, gaps = [];
    facets.forEach(function (f) {
      var w = stagWeight(f);
      max += w;
      if (covered[f.key]) score += w;
      else gaps.push({ key: f.key, w: w, label: stagLabel(f.key) });
    });
    gaps.sort(function (a, b) { return b.w - a.w; });
    return {
      covered: covered,
      gaps: gaps,
      score: score,
      max: max,
      pct: max ? Math.round(100 * score / max) : 0,
      tagged: tagged,
      n: (ids || []).length,
      schools: Object.keys(schools).sort()
    };
  }

  function spellTagFillers(ids, gapKeys, limit) {
    limit = limit || 10;
    var have = {};
    (ids || []).forEach(function (i) { have[i] = 1; });
    var want = {};
    (gapKeys || []).forEach(function (k) { want[k] = 1; });
    var scored = [];
    Object.keys(STAG_BY_I).forEach(function (ik) {
      var i = +ik;
      if (have[i] || !CAT[i]) return;
      if (tooHigh(i) || overBudget(i)) return;
      if (isUndesiredIdx(i)) return;
      var e = STAG_BY_I[i];
      if (!e || !e.facets || !e.facets.length) return;
      var filled = e.facets.filter(function (k) { return want[k]; });
      if (!filled.length) return;
      var lvl = CAT[i][4] || 0;
      var kind = CAT[i][1] || 0;
      var bonus = (10 - Math.min(lvl, 60) / 6) + (kind === 0 ? 2 : 0);
      if (isDesiredIdx(i) || isLockedIdx(i)) bonus += 3;
      if (isCardedIdx(i)) bonus += 2;
      scored.push({
        i: i,
        fill: filled.length,
        filled: filled,
        s: filled.length * 10 + bonus
      });
    });
    scored.sort(function (a, b) {
      return b.s - a.s || b.fill - a.fill || (CAT[a.i][4] || 0) - (CAT[b.i][4] || 0);
    });
    return scored.slice(0, limit);
  }

  function renderSpellTagFingerprint(ids) {
    var box = document.getElementById("methbox");
    var tab = document.getElementById("methTab");
    var hd = document.getElementById("cM");
    if (!box) return;

    var show = !!(STAGS && STAGS.entries && STAGS.entries.length);
    if (tab) tab.hidden = !show;
    if (!show) {
      box.innerHTML = "";
      if (hd) { hd.textContent = "—"; hd.className = "cnt"; }
      return;
    }

    if (!ids || !ids.length) {
      if (hd) { hd.textContent = "—"; hd.className = "cnt"; }
      box.innerHTML = emptyHint(
        "Wähle einen Build — dann siehst du die Tag-Abdeckung.",
        "<p>Dieser Reiter zeigt die strukturelle Abdeckung aus Ascension " +
          "<code>SpellTags.dbc</code> (Mobilität, Interrupt, CC, Schulen). " +
          "Tags kommen aus dem Client, nicht aus Heuristiken.</p>");
      return;
    }

    var fp = spellTagFingerprint(ids);
    if (hd) {
      hd.textContent = fp.pct + "% · " + fp.gaps.length + " Lücken";
      hd.className = "cnt " + (fp.gaps.length > 4 ? "over" : fp.pct >= 70 ? "ok" : "");
    }

    var o = [];
    o.push('<div class="stagscore"><b>' + fp.score + " / " + fp.max
      + "</b> · " + fp.pct + "% · getaggt " + fp.tagged + "/" + fp.n);
    if (fp.schools.length) {
      o.push(" · Schulen: " + fp.schools.map(function (s) {
        return SCHOOL_DE[s] || s;
      }).map(esc).join(", "));
    }
    o.push("</div>");

    var fillers = [];
    if (fp.gaps.length) {
      var topGaps = fp.gaps.slice(0, 4);
      fillers = spellTagFillers(ids, topGaps.map(function (g) { return g.key; }), 10);
      o.push('<div class="wepline"><b>Lücken</b> ' + topGaps.map(function (g) {
        return esc(g.label) + " (−" + g.w + ")";
      }).join(" · ") + "</div>");
    } else {
      o.push('<div class="flag syn"><b>Alle gewichteten Facetten belegt</b> '
        + "— laut SpellTags deckt der Build die " + frameLabel()
        + "-Checkliste ab.</div>");
    }

    var more = [];
    more.push('<div class="qhint"><b>Tag-Struktur</b> — gewichtete Facetten-Abdeckung '
      + "für " + frameLabel() + ". Quelle: <code>SpellTags.dbc</code> ∩ Katalog "
      + "(" + (STAGS.taggedEntries || Object.keys(STAG_BY_I).length)
      + " getaggte Einträge). Keine erfundenen Schadenszahlen.</div>");
    more.push('<div class="staggrid">');
    stagFacetList().forEach(function (f) {
      var ok = !!fp.covered[f.key];
      more.push('<div class="stag' + (ok ? " ok" : " gap") + '">'
        + '<span class="stagmark">' + (ok ? "✓" : "✗") + "</span>"
        + '<span class="stagnam">' + esc(stagLabel(f.key)) + "</span>"
        + '<span class="stagw">' + stagWeight(f) + "</span></div>");
    });
    more.push("</div>");
    if (fillers.length) {
      more.push('<div class="geartitle" style="padding:10px 14px 0">'
        + "Katalog-Vorschläge für diese Lücken</div>");
      fillers.forEach(function (f) {
        var covers = f.filled.map(stagLabel).join(", ");
        more.push('<div class="sug" data-add="' + f.i + '" role="button" tabindex="0">'
          + '<span class="icon" style="width:22px;height:22px;flex:0 0 22px;'
          + iconStyle(f.i, 22) + '"></span>'
          + '<div class="sugb"><span class="nm q'
          + CAT[f.i][3] + '">' + esc(CAT[f.i][0]) + "</span>"
          + '<span class="sugwhy">schließt ' + f.fill
          + (f.fill === 1 ? " Lücke" : " Lücken") + ": "
          + esc(covers) + " · Stufe " + (CAT[f.i][4] || "?") + "</span></div>"
          + '<span class="sugadd">+</span></div>');
      });
    }
    o.push(wrapDetails(more.join(""),
      fillers.length
        ? "Facetten und Vorschläge (" + fillers.length + ")"
        : "Alle Facetten"));
    box.innerHTML = o.join("");
  }

  function renderSpellTagsWissen() {
    var root = document.getElementById("stagsRoot");
    if (!root) return;
    if (!STAGS || !STAGS.entries || !STAGS.entries.length) {
      root.innerHTML = "";
      return;
    }
    var o = [];
    o.push('<div class="headline"><b>4. SpellTag-Strukturfingerprint</b>');
    o.push("Offizielle Ascension-Taxonomie aus <code>SpellTags.dbc</code> / "
      + "<code>SpellTagTypes.dbc</code>. Ergänzt Tempo, Modifier-Reichweite und Lücken — ersetzt sie nicht. "
      + "Live-Auswertung deines Builds: <em>Auswertung → Tag-Struktur</em>.</div>");
    o.push('<div class="flag syn"><b>'
      + (STAGS.taggedEntries || STAGS.entries.length) + " / "
      + (STAGS.catalogSize || CAT.length)
      + " Katalogeinträge getaggt</b> · "
      + stagFacetList().length + " Facetten. Schulen und Rollen nur, "
      + "wenn der Client sie setzt.");
    if (TAGN && TAGN.types) {
      o.push(" · <code>D.tagn</code>: "
        + Object.keys(TAGN.types).length + " SpellTagTypes-Namen");
    }
    o.push("</div>");
    var facetBits = ['<div class="staggrid wissen">'];
    stagFacetList().forEach(function (f) {
      facetBits.push('<div class="stag ok"><span class="stagnam">'
        + esc(stagLabel(f.key)) + "</span>"
        + '<span class="stagw">Gew. ' + stagWeight(f)
        + "</span></div>");
    });
    facetBits.push("</div>");
    facetBits.push('<div class="srcnote">Interrupt und Mobilität wiegen für ' +
      frameLabel() + " "
      + "stärker als z.&nbsp;B. Cleave. Fehlende Tags heißen „nicht in der DBC "
      + "markiert“, nicht „Fähigkeit nutzlos“.</div>");
    o.push(wrapDetails(facetBits.join(""),
      "Facetten (" + stagFacetList().length + ")"));
    root.innerHTML = o.join("");
  }

  function renderMethods() {
    var root = document.getElementById("methRoot");
    if (!root) return;
    if (!METH || !METH.tempo) {
      root.innerHTML = '<p class="srcnote">Keine Methoden-Daten (data/methods.json). '
        + '<code>python3 pipeline/methods.py</code> ausführen.</p>';
      renderSpellTagsWissen();
      return;
    }
    var html = [];
    var t = METH.tempo;
    var h = METH.modheat;
    var g = METH.gaps;
    var r = METH.resmap;

    html.push('<div class="headline"><b>1. Tempo-Score</b> ' +
      '<span class="meta">(' + frameLabel() + ', Level 10–60)</span>');
    html.push(esc(t.note || ""));
    html.push("</div>");
    html.push('<div class="flag syn"><b>' + (t.nHigh || 0)
      + " mit DBC-Cooldown</b> · " + t.n
      + " mit messbarem Anteil (Level " + (t.lvl || []).join("–")
      + "). Score = Anteil ÷ CD (sonst GCD " + t.gcd + " s).</div>");
    if (t.dupGroups && t.dupGroups.nMulti) {
      html.push('<div class="flag pre"><b>Gleicher GCD — nicht addieren</b> · '
        + t.dupGroups.nMulti + " Dublettengruppen mit je ≥2 Schulvarianten"
        + (t.dupGroups.nMembers ? (" (" + t.dupGroups.nMembers + " Einträge)") : "")
        + ". Varianten derselben Gruppe teilen sich einen GCD; zwei Scores "
        + "aus einer Gruppe sind kein doppelter Takt. "
        + "Geteilte Ability-CDs stehen separat in <code>cdgroups</code>.</div>");
    }

    function tempoTable(rows, title) {
      if (!rows || !rows.length) return;
      var tbl = [];
      tbl.push('<div class="tblwrap"><table class="stat"><thead><tr>');
      tbl.push("<th>Score</th><th>Fähigkeit</th><th>Level</th><th>Anteil</th>"
        + "<th>CD</th><th>Vertrauen</th></tr></thead><tbody>");
      rows.slice(0, 25).forEach(function (row) {
        var part = row.w != null ? (row.w + " % Waffe")
          : row.ap != null ? (row.ap + " % AP")
          : row.sp != null ? (row.sp + " % SP") : "—";
        if (row.sch) part += " · " + row.sch;
        tbl.push("<tr><td class=\"num\">" + row.s + "</td><td>"
          + esc(methName(row.i)) + "</td><td class=\"num\">" + row.lvl
          + "</td><td>" + esc(part) + "</td><td class=\"num\">"
          + (row.cd != null ? row.cd + " s" : "GCD")
          + "</td><td>" + esc(CONF_DE[row.conf] || row.conf)
          + "</td></tr>");
      });
      tbl.push("</tbody></table></div>");
      html.push(wrapDetails(tbl.join(""),
        title + " (" + Math.min(rows.length, 25) + ")"));
    }
    tempoTable(t.topHigh, "Mit gemessenem Cooldown (Vertrauen hoch)");
    tempoTable(t.top, "Gesamtrangliste (inkl. GCD-Schätzung)");

    if (t.flatOhneKoeff && t.flatOhneKoeff.length) {
      html.push('<div class="flag pre"><b>Flat ohne Koeffizient — nicht gerankt</b> ');
      html.push(t.flatOhneKoeff.slice(0, 12).map(function (row) {
        return esc(methName(row.i));
      }).join(", "));
      if (t.flatOhneKoeff.length > 12) html.push(" …");
      html.push("</div>");
    }

    html.push('<div class="headline"><b>2. Modifier-Ketten-Hitze</b>');
    html.push("Wie viele Abilities ein Talent trifft (gleiche Basis inkl. Schulvarianten). ");
    html.push(esc((h && h.note) || ""));
    html.push("</div>");
    if (h && h.talents && h.talents.length) {
      var heat = [];
      heat.push('<div class="tblwrap"><table class="stat"><thead><tr>');
      heat.push("<th>Reichweite</th><th>Talent</th><th>Basis</th>"
        + "<th>Abilities in der Kette</th></tr></thead><tbody>");
      h.talents.slice(0, 20).forEach(function (row) {
        heat.push("<tr><td class=\"num\">" + row.h + "</td><td>"
          + esc(methName(row.i)) + "</td><td>"
          + esc(methName(row.base)) + "</td><td class=\"num\">"
          + row.h + "</td></tr>");
      });
      heat.push("</tbody></table></div>");
      html.push(wrapDetails(heat.join(""),
        "Talent-Hitze (" + Math.min(h.talents.length, 20) + ")"));
    }
    if (h && h.bases && h.bases.length) {
      var bases = [];
      bases.push('<div class="tblwrap"><table class="stat"><thead><tr>');
      bases.push("<th>Reichweite</th><th>Basis</th><th>Varianten</th>"
        + "<th>Talente</th></tr></thead><tbody>");
      h.bases.slice(0, 15).forEach(function (row) {
        bases.push("<tr><td class=\"num\">" + row.h + "</td><td>"
          + esc(methName(row.i)) + "</td><td class=\"num\">" + row.v
          + "</td><td class=\"num\">" + row.t + "</td></tr>");
      });
      bases.push("</tbody></table></div>");
      html.push(wrapDetails(bases.join(""),
        "Basen mit der größten Reichweite (" + Math.min(h.bases.length, 15) + ")"));
    }

    html.push('<div class="headline"><b>3. Ehrliche Zahlenlücken</b>');
    html.push(esc((g && g.note) || ""));
    html.push("</div>");
    html.push('<div class="flag pre"><b>' + ((g && g.n) || 0)
      + " Lücken</b> — Katalog nennt Schaden/Heilung, scaling.json liefert "
      + "keine messbare Zahl.</div>");
    if (g && g.items && g.items.length) {
      var gaps = [];
      gaps.push('<div class="tblwrap"><table class="stat"><thead><tr>');
      gaps.push("<th>Fähigkeit</th><th>Level</th><th>Grund</th></tr></thead><tbody>");
      g.items.slice(0, 30).forEach(function (row) {
        gaps.push("<tr><td>" + esc(methName(row.i))
          + "</td><td class=\"num\">" + row.lvl + "</td><td>"
          + esc(WHY_DE[row.why] || row.why) + "</td></tr>");
      });
      gaps.push("</tbody></table></div>");
      html.push(wrapDetails(gaps.join(""),
        "Lückenliste (" + Math.min(g.items.length, 30) + ")"));
    }

    if (r && r.pools) {
      html.push('<div class="headline"><b>Ressourcenkarte (DBC)</b>');
      html.push(esc(r.note || ""));
      html.push("</div>");
      var pools = [];
      pools.push('<div class="tblwrap"><table class="stat"><thead><tr>');
      pools.push("<th>Pool</th><th>Abilities mit Kosten</th>"
        + "<th>Stichproben</th></tr></thead><tbody>");
      Object.keys(r.pools).sort().forEach(function (pool) {
        var p = r.pools[pool];
        var samples = (p.samples || []).slice(0, 4).map(function (s) {
          return methName(s.i) + (s.cost != null ? " (" + s.cost + ")" : "");
        }).join(", ");
        pools.push("<tr><td>" + esc(pool) + "</td><td class=\"num\">" + p.n
          + "</td><td>" + esc(samples) + "</td></tr>");
      });
      pools.push("</tbody></table></div>");
      html.push(wrapDetails(pools.join(""),
        "Pools (" + Object.keys(r.pools).length + ")"));
    }

    root.innerHTML = html.join("");
    renderSpellTagsWissen();
  }

  document.getElementById("bClear").addEventListener("click", function () {
    picked = Object.create(null);
    location.hash = "";
    refresh();
    toast("Geleert");
  });

  function syncFrameCtl() {
    document.querySelectorAll(".frameb").forEach(function (b) {
      b.classList.toggle("on", b.getAttribute("data-frame") === FRAME_PREF);
    });
    var hint = document.getElementById("frameHint");
    if (hint) {
      var auto = isEndgameLevel(CHAR && CHAR.level) ? "Endgame" : "Levelrun";
      hint.textContent = FRAME_PREF === "auto"
        ? "wirkt als " + auto +
          (CHAR && CHAR.level ? " (Stufe " + CHAR.level + ")" : "")
        : "manuell · " + frameLabel();
    }
    var brand = document.getElementById("brandFrame");
    if (brand) {
      brand.textContent = "Season 10 Wildcard · " + frameLabel();
    }
  }

  document.querySelectorAll(".frameb").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var f = btn.getAttribute("data-frame");
      if (f !== "auto" && f !== "levelrun" && f !== "endgame") return;
      FRAME_PREF = f;
      syncFrameCtl();
      refresh();
      toast("Rahmen: " + (f === "auto" ? "Auto (" + frameLabel() + ")"
        : frameLabel()));
    });
  });

  function refresh() {
    var ids = Object.keys(picked).map(Number);
    syncFrameCtl();
    slots();
    recountBudget();
    renderChar();
    renderBudget();
    renderPaths(ids);
    renderIssues(ids);
    renderScale(ids);
    renderSuggest(ids);
    renderStats(ids);
    renderChains(ids);
    renderCompare();
    refreshOfficial();
    renderArchetypes();
    analyse();
    renderSpellTagFingerprint(ids);
    render();
    syncHeader();
    save();
  }

  // Build aus URL laden
  var h = location.hash.match(/b=([0-9a-z.]+)/);
  if (h) { decode(h[1]); el.url.value = shareUrl(); }
  else { restore(); }
  // #t= verlinkt eine Stelle in der Oberfläche. Seit dem Umbau gibt es
  // zwei Ebenen: die Ansicht im Kopfbalken und die Reiter im Nachschlage-
  // werk. Beide über denselben Parameter erreichbar halten, sonst zeigen
  // ältere geteilte Links ins Leere.
  function applyHashTarget() {
    var raw = (location.hash || "").replace(/^#/, "");
    if (/tut=1/.test(raw) && typeof tutOpen === "function") tutOpen(true);
    if (!raw || /^b=/.test(raw)) return;
    var ht = raw.match(/t=([A-Za-z]+)/);
    if (ht) {
      var vb = document.querySelector('[data-view="' + ht[1] + '"]');
      if (vb) { showView(ht[1]); return; }
      var tb = document.querySelector('[data-tab="' + ht[1] + '"]');
      if (!tb) return;
      var view = tb.closest(".view");
      if (view) showView(view.id);
      tb.click();
      return;
    }
    var id = raw.split("&")[0];
    if (JUMP[id]) { jumpTo(id); return; }
    var el = document.getElementById(id);
    if (el) jumpTo(el);
  }
  initTutorial();
  applyHashTarget();

  window.addEventListener("hashchange", function () {
    var m = location.hash.match(/b=([0-9a-z.]+)/);
    if (m) { decode(m[1]); refresh(); }
    // Ein reiner Hashwechsel laedt die Seite nicht neu - ohne diesen
    // Aufruf wirkte ein Link auf eine andere Ansicht nur beim ersten
    // Oeffnen und danach nie wieder.
    applyHashTarget();
  });

  renderArchetypes();
  renderGenerator();
  renderAI();
  renderMethods();
  refresh();
})();
