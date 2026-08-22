(function () {
  "use strict";

  var D = JSON.parse(document.getElementById("data").textContent);
  var CAT = D.cat;          // [name, kind, class, quality, level, desc]
  var REL = D.rel;          // [baseIdx, needsIdx, refs[], dupGroup]
  var ARCH = D.arch;        // archetyp -> [idx]
  var SPR = D.spr;          // {cols, tile, idx[]}
  var CDG = D.cdg || [];    // Namen der Shared-Cooldown-Gruppen
  var BM = D.bm || {};      // Basis-Index -> Talente, die sie verbessern
  var TAG = D.tag || [];    // Bitmaske: woraus zieht ein Eintrag seinen Wert
  var SC = D.sc || [];      // aus den Tooltips gelesene Skalierungszahlen
  var MC = D.mc || [];      // Cooldown, Castzeit, Kosten aus Spell.dbc

  var QN = ["Normal", "Uncommon", "Rare", "Epic", "Legendary"];
  var MAX_A = 30, MAX_T = 25;

  // Umkehrindex: Katalogposition -> Archetypname
  var archOf = {};
  Object.keys(ARCH).forEach(function (k) {
    ARCH[k].forEach(function (i) { archOf[i] = k; });
  });

  var picked = Object.create(null);   // idx -> true
  var el = {};
  ["q", "fKind", "fClass", "fQual", "fScale", "fSort", "list", "hits", "slotsA", "slotsT",
   "cA", "cT", "cF", "flags", "url", "toast"].forEach(function (id) {
    el[id] = document.getElementById(id);
  });

  // ---------- Hilfen ----------
  // Der Versatz im Sprite haengt von der ANGEZEIGTEN Kachelgroesse ab,
  // nicht von der Groesse im Bild. Wer background-size ueberschreibt, muss
  // die Position mitskalieren - sonst zeigt der Ausschnitt ins Leere.
  // Genau das war der Grund, warum die Icons in "Dein Build" fehlten.
  function iconStyle(i, size) {
    var t = SPR.idx[i];
    if (t < 0) return "background:var(--sunken)";
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

  // ---------- Klassenfilter füllen ----------
  (function () {
    var cs = {};
    CAT.forEach(function (r) { cs[r[2]] = 1; });
    Object.keys(cs).sort().forEach(function (c) {
      var o = document.createElement("option");
      o.value = c; o.textContent = c;
      el.fClass.appendChild(o);
    });
  })();

  // ---------- Katalogliste ----------
  var shown = [];
  function render() {
    var q = el.q.value.trim().toLowerCase();
    var fk = el.fKind.value, fc = el.fClass.value, fq = el.fQual.value;
    var fs = el.fScale.value;
    var hit = [], CAP = 300;
    for (var i = 0; i < CAT.length; i++) {
      var r = CAT[i];
      if (fk !== "" && String(r[1]) !== fk) continue;
      if (fc !== "" && r[2] !== fc) continue;
      if (fq !== "" && String(r[3]) !== fq) continue;
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
  }

  function row(i, r) {
    var a = archOf[i];
    var block = tooHigh(i) ? " lock" : (overBudget(i) && !picked[i] ? " lock" : "");
    return '<div class="row' + (picked[i] ? " picked" : block) + '" data-i="' + i + '" role="button" tabindex="0">' +
      '<span class="icon" style="width:32px;height:32px;flex:0 0 32px;' + iconStyle(i) + '"></span>' +
      '<span class="body"><span class="nm" style="color:var(--q' + r[3] + ')">' + esc(r[0]) + "</span>" +
      (a ? ' <span class="meta" style="color:var(--accent)">' + esc(a) + "</span>" : "") +
      '<span class="ds">' + esc(r[5]) + "</span>" + badges(i) + "</span>" +
      '<span class="meta">' + (r[1] ? "TAL" : "ABI") + "<br>" + esc(r[2]) +
      "<br>" + (tooHigh(i) ? '<span class="lvlbad">lvl' + r[4] + "</span>" : "lvl" + r[4]) +
      "</span></div>";
  }

  el.list.addEventListener("click", function (e) {
    var t = e.target.closest(".row");
    if (t) toggle(+t.dataset.i);
  });
  el.list.addEventListener("keydown", function (e) {
    if (e.key !== "Enter" && e.key !== " ") return;
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
  ["fKind", "fClass", "fQual", "fScale", "fSort"].forEach(function (id) {
    el[id].addEventListener("input", render);
  });

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
        toast(QN[CAT[i][3]] + "-Budget ist voll (" + qualityLimit(CAT[i][3]) + ")");
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
    return '<div class="slot"><span class="icon" style="width:20px;height:20px;flex:0 0 20px;' +
      iconStyle(i, 20) + '"></span>' +
      '<span class="nm" style="color:var(--q' + r[3] + ')" title="' + esc(r[5]) + '">' +
      esc(r[0]) + "</span>" +
      '<button data-rm="' + i + '" aria-label="Entfernen">×</button></div>';
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

    // 1. Doppeltn
    var groups = {};
    ids.forEach(function (i) {
      var g = REL[i][3];
      if (g >= 0) (groups[g] = groups[g] || []).push(i);
    });
    Object.keys(groups).forEach(function (g) {
      if (groups[g].length > 1) {
        out.push('<div class="flag dup"><b>Doppelt</b> — ' +
          groups[g].map(function (i) { return esc(CAT[i][0]); }).join(" · ") +
          " machen dasselbe, nur in einer anderen Schadensschule. Einer reicht — die " +
          "anderen kosten dich nur Plätze.</div>");
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
      var base = REL[i][0];
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
          "Infrage kämen: " + sug + ".</div>");
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
      var refs = REL[i][2] || [];
      if (!refs.length) return;
      var anyHave = refs.some(function (j) {
        if (have[j]) return true;
        // Auch zaehlen, wenn eine Schulvariante von j im Build steht:
        // das Talent wirkt dann ueber die Modifier-Vererbung.
        return ids.some(function (k) { return REL[k][0] === j; });
      });
      if (!anyHave) {
        var names = refs.slice(0, 3).map(function (j) { return esc(CAT[j][0]); }).join(", ");
        out.push('<div class="flag pre"><b>Wirkt nicht</b> — ' + esc(CAT[i][0]) +
          " verbessert " + names + ". Nichts davon steht in deinem Build.</div>");
      }
    });

    var dup = out.filter(function (s) { return s.indexOf("flag dup") > 0; }).length;
    var bad = out.filter(function (s) { return s.indexOf("flag pre") > 0; }).length;
    var good = out.filter(function (s) { return s.indexOf("flag syn") > 0; }).length;
    el.cF.textContent = ids.length ? (good + " Synergien · " + (dup + bad) + " Warnungen") : "—";
    el.cF.className = "cnt " + (bad + dup ? "over" : good ? "ok" : "");
    el.flags.innerHTML = out.length ? out.join("") :
      '<div class="empty">' + (ids.length ? "Keine Auffälligkeiten." : "Wähle etwas aus.") + "</div>";
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
      bad: "Kein Spell-Power-Multiplikator. Jeder Zauber in deinem Build läuft " +
           "hier ungeboostet mit."
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
            "je nachdem was höher ist. Spell Power aus Items und Effekten ×1,75. " +
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

  function profile(ids) {
    var p = { w: 0, m: 0, h: 0, wm: 0, crit: 0, arpen: 0, phys: 0, n: ids.length };
    ids.forEach(function (i) {
      var t = TAG[i] || 0;
      var isW = !!(t & T_WEAPON), isM = !!(t & T_MAGIC);
      if (isW) p.w++;
      if (isM) p.m++;
      if (isW && isM) p.wm++;
      if (t & T_HEAL) p.h++;
      if (t & T_PHYS) p.phys++;
      if (t & T_CRIT) p.crit++;
      if (t & T_ARPEN) p.arpen++;
    });
    p.pw = p.w - p.wm;
    p.pm = p.m - p.wm;
    return p;
  }

  // Punkte + Begruendung. Bewusst grob: der Builder kennt dein Gear nicht.
  function scorePaths(p) {
    var s = [
      { k: "heal", v: p.h * 3,
        why: p.h ? p.h + (p.h === 1 ? " heilender Eintrag" : " heilende Einträge") +
            " im Build" : "nichts Heilendes gewählt" },
      { k: "int", v: p.pm * 3 + (p.m ? 1 : 0),
        why: p.pm ? p.pm + (p.pm === 1 ? " reiner Zauber" : " reine Zauber") +
            " ohne Waffenanteil" : "keine reinen Zauber" },
      { k: "dua", v: p.wm * 5 + Math.min(p.pw, p.pm) * 3,
        why: p.wm ? p.wm + "× Waffenschaden als Element — genau der Fall, für den es " +
                    "den Path gibt"
                  : (Math.min(p.pw, p.pm) ? "physische und magische Anteile gemischt"
                                          : "kein Hybridanteil") },
      { k: "str", v: p.pw * 2 + p.arpen * 3,
        why: p.arpen ? p.arpen + "× Armor Penetration im Build"
                     : (p.pw ? p.pw + (p.pw === 1 ? " rein physischer Waffenangriff"
                                                  : " rein physische Waffenangriffe")
                             : "keine reinen Waffenangriffe") },
      { k: "agi", v: p.pw * 2 + p.crit,
        why: p.crit ? p.crit + (p.crit === 1 ? " Eintrag, der" : " Einträge, die") +
            " auf kritische Treffer " + (p.crit === 1 ? "baut" : "bauen")
                    : (p.pw ? p.pw + (p.pw === 1 ? " rein physischer Waffenangriff"
                                                 : " rein physische Waffenangriffe")
                            : "keine reinen Waffenangriffe") }
    ];
    s.sort(function (a, b) { return b.v - a.v || a.k.localeCompare(b.k); });
    return s;
  }

  function renderPaths(ids) {
    var box = document.getElementById("paths");
    var hd = document.getElementById("cP");
    if (!ids.length) {
      hd.textContent = "—"; hd.className = "cnt";
      box.innerHTML = '<div class="empty">Wähle Fähigkeiten — dann kommt hier die ' +
        "Path-Empfehlung mit Begründung.</div>";
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
      "<p>" + P.core + "</p>" +
      '<p class="fit"><strong>Passt, weil:</strong> ' + esc(sc.filter(function (x) {
        return x.k === top; })[0].why) + ". " + esc(P.good) + "</p>" +
      '<p class="fit warnline"><strong>Der Haken:</strong> ' + esc(P.bad) + "</p>" +
      '<div class="wpn"><div><b>Mit Einhandwaffe</b>' + P.oneH + "</div>" +
      "<div><b>Mit Zweihandwaffe</b>" + P.twoH + "</div></div>" +
      "</div>");

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

    // Was der Path konkret mit deinen Auswahlen macht
    var notes = pathNotes(ids, P, p);
    if (notes.length) {
      o.push('<div class="pnotes"><b>Was ' + esc(P.n) + " mit deinen Auswahlen macht</b>" +
        notes.join("") + "</div>");
    }
    box.innerHTML = o.join("");
  }

  // Konkrete, benannte Skalierungsaussagen statt Allgemeinplaetze.
  function pathNotes(ids, P, p) {
    var out = [], shown = 0, MAX = 6;
    var wm = [], pm = [], pw = [], hl = [];
    ids.forEach(function (i) {
      var t = TAG[i] || 0;
      if ((t & T_WEAPON) && (t & T_MAGIC)) wm.push(i);
      else if (t & T_MAGIC) pm.push(i);
      else if (t & T_WEAPON) pw.push(i);
      if (t & T_HEAL) hl.push(i);
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

  function parseExport(text) {
    var d = { stats: {}, gear: [], weapons: [], abi: [], tal: [] };
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
          break;
        case "PATH":
          seen = true;
          d.path = (parts[0] || "").trim();
          break;
        case "ESSENCE":
          parts.forEach(function (p) {
            var m = p.split(":");
            if (m[0] === "A") d.essA = +m[1] || 0;
            if (m[0] === "T") d.essT = +m[1] || 0;
          });
          break;
        case "STAT":
          parts.forEach(function (p) {
            var m = p.split(":");
            if (m.length === 2) d.stats[m[0].toUpperCase()] = parseFloat(m[1]);
          });
          break;
        case "WEAPON":
          d.weapons.push({
            slot: parts[0], name: parts[1],
            ilvl: +(parts[2] || "").replace("ilvl", "") || 0,
            speed: parseFloat((parts[3] || "").replace("speed", "")) || 0,
            dmg: parts[4] || "",
            dps: parseFloat((parts[5] || "").replace("dps", "")) || 0,
            loc: parts[6] || "", sub: parts[7] || ""
          });
          break;
        case "ILVL":
          d.ilvl = parseFloat(parts[0]) || 0;
          break;
        case "GEAR":
          d.gear.push({ slot: parts[0], name: parts[1], ilvl: +parts[2] || 0,
                        q: +parts[3] || 0, sub: parts[4] || "" });
          break;
        case "ABI":
          seen = true;
          d.abi = (parts[0] || "").split(";").filter(Boolean);
          break;
        case "TAL":
          seen = true;
          d.tal = (parts[0] || "").split(";").filter(Boolean)
            .map(function (t) {
              var i = t.lastIndexOf(":");
              return i > 0 ? { n: t.slice(0, i), r: +t.slice(i + 1) || 1 }
                           : { n: t, r: 1 };
            });
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
    var hit = 0;
    function take(name) {
      var i = BYNAME[String(name).toLowerCase().trim()];
      if (i === undefined) { UNMATCHED.push(name); return; }
      picked[i] = true; hit++;
    }
    d.abi.forEach(take);
    d.tal.forEach(function (t) { take(t.n); });
    CHAR = d;
    return hit;
  }

  // ---------- Charakterkarte ----------
  function renderChar() {
    var box = document.getElementById("charBox");
    var hd = document.getElementById("cC");
    if (!CHAR) {
      hd.textContent = "—"; hd.className = "cnt";
      box.innerHTML = '<div class="empty">Noch kein Charakter eingelesen.</div>';
      return;
    }
    var c = CHAR, s = c.stats;
    hd.textContent = c.name || "importiert";
    hd.className = "cnt ok";

    var mh = c.weapons.filter(function (w) { return w.slot === "MH"; })[0];
    var twoH = mh && /2HWEAPON/i.test(mh.loc);

    var o = [];
    o.push('<div class="charhd"><b>' + esc(c.name || "?") + "</b> · Stufe " +
      (c.level || "?") + " " + esc(c.race || "") + " · Path of " +
      esc(c.path || "?") + (mh ? " · " + (twoH ? "Zweihand" : "Einhand") : "") + "</div>");

    var rows = [
      ["Spell Power", s.SP], ["Attack Power", s.AP], ["Healing", s.HEAL],
      ["Strength", s.STR], ["Agility", s.AGI], ["Intellect", s.INT],
      ["Spirit", s.SPI], ["Stamina", s.STA],
      ["Melee-Crit", s.CRIT, "%"], ["Spell-Crit", s.SCRIT, "%"],
      ["Hit Rating", s.HITRATING], ["Armor", s.ARMOR]
    ].filter(function (r) { return r[1] !== undefined && !isNaN(r[1]); });

    o.push('<div class="statgrid">');
    rows.forEach(function (r) {
      o.push("<div><span>" + esc(r[0]) + "</span><b>" +
        (r[2] ? r[1].toFixed(2) : Math.round(r[1])) + (r[2] || "") + "</b></div>");
    });
    o.push("</div>");

    if (mh) {
      o.push('<div class="wepline"><b>Waffe</b> ' + esc(mh.name) +
        " · " + mh.dps.toFixed(1) + " DPS · Tempo " + mh.speed.toFixed(2) +
        (mh.sub && mh.sub !== "-" ? " · " + esc(mh.sub) : "") + "</div>");
    }
    if (c.ilvl) {
      o.push('<div class="wepline"><b>Gegenstandsstufe</b> ' + c.ilvl.toFixed(2) +
        " über " + c.gear.length + " Slots</div>");
    }
    box.innerHTML = o.join("");
  }

  // ---------- Befund: kritisch / verbesserbar ----------
  // Reihenfolge ist Absicht: was dich Schaden kostet, steht oben.
  var ALL_GEAR_SLOTS = ["Head", "Neck", "Shoulder", "Back", "Chest", "Wrist",
    "Hands", "Waist", "Legs", "Feet", "Ring1", "Ring2", "Trinket1", "Trinket2",
    "MainHand"];

  function charIssues(ids) {
    if (!CHAR) return [];
    var c = CHAR, s = c.stats, out = [];
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
      push("krit", "Du hast " + bits.join(" und ") + " liegen",
        " Das ist Schaden, den du geschenkt bekommst, sobald du sie ausgibst. " +
        "Nichts an deinem Build ist wichtiger als das.");
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
        "ließe sich das so nicht lernen. Tausch die überzähligen gegen " +
        "niedrigere Stufen.");
    }

    // 2. Path gegen Build.
    //    Schweregrad nach Punkteabstand: liegt der aktuelle Path dicht dran,
    //    ist das eine Feinjustierung und kein Alarm.
    if (have && best && have.k !== best.k) {
      var want = PATHBY[best.k];
      var all = scorePaths(p);
      var mine = 0;
      all.forEach(function (x) { if (x.k === have.k) mine = x.v; });
      var close = best.v > 0 && mine >= best.v * 0.75;

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
    } else if (have) {
      push("ok", "Path passt",
        " <b>" + esc(have.n) + "</b> ist auch das, was dein Build verlangt: " +
        esc(best ? best.why : "") + ".");
    } else if (c.path) {
      push("fix", "Path nicht erkannt",
        " Das Addon meldet „" + esc(c.path) + "“. Kann ich keinem der fünf Paths " +
        "zuordnen — die Empfehlung oben ignoriert deinen aktuellen Path deshalb.");
    }

    // 3. Heilbuild ohne Heilpath und umgekehrt
    if (have && have.k === "heal" && p.h === 0) {
      push("krit", "Path of Healing ohne einen einzigen Heilzauber",
        " Der Path rechnet deine Spell Power in Healing Power um. Wenn nichts " +
        "heilt, verschenkst du den kompletten Path-Bonus.");
    }
    if (have && have.k !== "heal" && p.h >= 5) {
      push("fix", p.h + " heilende Einträge, aber nicht auf Path of Healing",
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
        }).join(" und ") + " aus, hat aber nichts, das " +
        (dry.length === 1 ? "sie" : "sie") + " auffüllt. " +
        dry.join(" und ") + " regeneriert nicht von selbst — ohne " +
        "Generator stehst du nach den ersten Sekunden mit leerer Leiste da.");
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

    // 6. Hit - direkt aus dem Client-Tooltip
    if (s && s.HITRATING !== undefined && s.HITRATING === 0 && (p.w + p.phys) > 0) {
      push("fix", "0 Hit Rating",
        " Dein Charakterfenster sagt: 8 % Trefferchance brauchst du, um gegen " +
        "einen Raidboss nie zu verfehlen, 5 % gegen Spieler. Bei 0 Rating " +
        "verpufft ein Teil deiner Angriffe komplett.");
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
          " " + missing.join(", ") + ". Jeder davon ist Spell Power oder ein " +
          "Attribut, das du nicht bekommst.");
      }
    }

    // 8. Plaetze nicht ausgereizt
    var cnt = counts();
    if (cnt.a < MAX_A || cnt.t < MAX_T) {
      var free = [];
      if (cnt.a < MAX_A) free.push((MAX_A - cnt.a) + " Ability-Plätze");
      if (cnt.t < MAX_T) free.push((MAX_T - cnt.t) + " Talent-Plätze");
      push("fix", free.join(" und ") + " frei",
        " Ein leerer Platz gibt dir nichts. Selbst ein mittelmäßiger Eintrag " +
        "schlägt einen leeren Slot.");
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
      box.innerHTML = '<div class="empty">Importiere deinen Charakter mit ' +
        "<code>/bs</code>, dann steht hier, was kritisch ist und was du " +
        "verbessern kannst.</div>";
      return;
    }
    var krit = list.filter(function (h) { return h.indexOf("issue krit") > 0; }).length;
    var fix = list.filter(function (h) { return h.indexOf("issue fix") > 0; }).length;
    hd.textContent = krit + " kritisch · " + fix + " verbesserbar";
    hd.className = "cnt " + (krit ? "over" : fix ? "ok" : "full");
    box.innerHTML = list.join("");
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
    var dir = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    var sibs = [].slice.call(b.parentNode.children);
    var next = sibs[(sibs.indexOf(b) + dir + sibs.length) % sibs.length];
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
    var o = SC[i];
    if (!o) return "";
    var b = [];
    if (o.w) {
      b.push('<span class="bdg w">' + fmt(o.w) + " % " +
        (o.wh === "any" ? "Waffe" : HAND[o.wh]) + "</span>");
    }
    if (o.sch) b.push('<span class="bdg s">' + esc(o.sch) + "</span>");
    else if (o.fsch) b.push('<span class="bdg s">' + esc(o.fsch) + "</span>");
    // Wenn Grundschaden und Tick dieselbe Zahl sind, ist es dieselbe
    // Information zweimal - dann reicht das Tick-Abzeichen.
    if (o.flat && !(o.tick && o.tick === o.flat[0] && o.flat[0] === o.flat[1])) {
      b.push('<span class="bdg f">' + o.flat[0] +
        (o.flat[1] !== o.flat[0] ? "–" + o.flat[1] : "") + "</span>");
    }
    if (o.heal) {
      b.push('<span class="bdg f">Heil ' + o.heal[0] +
        (o.heal[1] !== o.heal[0] ? "–" + o.heal[1] : "") + "</span>");
    }
    if (o.dot) b.push('<span class="bdg d">' + o.dot + " s</span>");
    if (o.tick) b.push('<span class="bdg d">' + o.tick + "/s</span>");
    if (o.ap) b.push('<span class="bdg w">' + fmt(o.ap) + " % AP</span>");
    if (o.sp) b.push('<span class="bdg w">' + fmt(o.sp) + " % SP</span>");
    (o.inc || []).forEach(function (x) {
      b.push('<span class="bdg m">+' + fmt(x[0]) + " % " + esc(short(x[1])) + "</span>");
    });
    (o.red || []).forEach(function (x) {
      b.push('<span class="bdg f">−' + fmt(x[0]) + " % " + esc(short(x[1])) + "</span>");
    });
    (o.gen || []).forEach(function (g) {
      b.push('<span class="bdg g">+' +
        (g[0] < 0 ? -g[0] + " % " : g[0] + " ") + esc(g[1]) + "</span>");
    });
    if (o.proc) b.push('<span class="bdg p">' + fmt(o.proc) + " % Proc</span>");
    // Cooldown kommt aus der DBC, nicht aus dem Text - der Tooltip
    // nennt ihn fast nie und die DBC immer.
    var mb = mechBadges(i);
    return (b.length || mb) ? '<span class="bdgs">' + b.join("") + mb + "</span>" : "";
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
    if (mode === "cd" || mode === "nocd" || mode === "free") {
      return mechMatch(i, mode);
    }
    return true;
  }

  // ---------- Mechanik aus der Client-DBC ----------
  // MC[i] kommt aus Spell.dbc, ueber die echte Spell-ID zugeordnet.
  // Diese Werte stehen in keinem Tooltip: die Textauswertung fand 12
  // Cooldowns, die DBC kennt 797.

  function mechBadges(i) {
    var m = MC[i];
    if (!m) return "";
    var b = [];
    if (m.cd) b.push('<span class="bdg c">CD ' + secs(m.cd) + "</span>");
    if (m.cast) b.push('<span class="bdg c">' + fmt(m.cast) + " s Cast</span>");
    else if (m.cd || m.cost) b.push('<span class="bdg c">instant</span>');
    if (m.cost) b.push('<span class="bdg r">' + fmt(m.cost) + " " + esc(m.res) + "</span>");
    if (m.range) b.push('<span class="bdg f">' + m.range + " m</span>");
    return b.join("");
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
      box.innerHTML = '<div class="empty">Wähle etwas aus — dann steht hier, ' +
        "woraus dein Schaden kommt.</div>";
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

    // 1. Waffenangriffe, nach geschaetztem Treffer sortiert
    var hits = ids.filter(function (i) { return SC[i] && SC[i].w; })
      .map(function (i) {
        var base = baseFor(SC[i].wh);
        return { i: i, pct: SC[i].w, hand: SC[i].wh,
                 est: base ? base * SC[i].w / 100 : 0 };
      })
      .sort(function (a, b) { return (b.est - a.est) || (b.pct - a.pct); });

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

    // 3. Flat-Damage ehrlich als Luecke ausweisen
    var flat = ids.filter(function (i) {
      return SC[i] && SC[i].flat && !SC[i].w;
    });
    if (flat.length) {
      o.push('<div class="schd">Fester Grundschaden</div>');
      o.push('<div class="scsum"><b>' + flat.length + " Einträge mit fester Zahl</b>" +
        "Was Spell Power hier draufrechnet, steht in keinem dieser Tooltips. " +
        "Die Zahlen unten sind der <em>Grundwert ohne dein Gear</em> — dein " +
        "tatsächlicher Schaden liegt darüber.</div>");
      flat.slice(0, 10).forEach(function (i) {
        var s = SC[i];
        o.push('<div class="scrow"><span class="nm">' + esc(CAT[i][0]) + "</span>" +
          '<span class="val">' + s.flat[0] +
          (s.flat[1] !== s.flat[0] ? "–" + s.flat[1] : "") + "</span>" +
          '<span class="sub">' + (s.fsch ? esc(s.fsch) : "physisch") +
          (s.dot ? ", über " + s.dot + " s" : "") + "</span></div>");
      });
    }

    var n = hits.length + mult.length;
    hd.textContent = n ? String(n) : "—";
    hd.className = "cnt " + (n ? "ok" : "");
    box.innerHTML = o.length ? o.join("") :
      '<div class="empty">Aus den Tooltips deiner Auswahl lässt sich keine Zahl ' +
      "herauslesen. Das heißt nicht, dass sie nicht skalieren — es steht nur " +
      "nicht im Text.</div>";
  }

  // ---------- Seltenheits-Budget ----------
  // Ascension begrenzt nicht nur Plaetze, sondern auch Seltenheit. Ohne die
  // Zahlen aus dem Spiel kennen wir nur die Verteilung, nicht die Grenze -
  // dann wird angezeigt statt blockiert.

  var QUAL_KEY = { uncommon: 1, rare: 2, epic: 3, legendary: 4 };

  function qualityUse(ids) {
    var u = [0, 0, 0, 0, 0];
    ids.forEach(function (i) { u[CAT[i][3]] += qualityCost(CAT[i][3]); });
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
    var q = CAT[i][3];
    var lim = qualityLimit(q);
    if (!lim) return false;
    return USE[q] + qualityCost(q) > lim;
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
      var pct = Math.min(100, use[q] / lim * 100);
      o.push('<div class="qrow"><span class="qn" style="color:var(--q' + q + ')">' +
        QN[q] + '</span><span class="qbar"><i style="width:' + pct + "%;" +
        "background:var(--q" + q + ')"></i></span><span class="qv' +
        (use[q] > lim ? " over" : "") + '">' + use[q] + " / " + lim + "</span></div>");
    }
    if (!any) {
      box.innerHTML = '<div class="qhint">Seltenheits-Budget unbekannt — importiere ' +
        "deinen Charakter, dann wird hier mitgezählt. Im Spiel darfst du nicht " +
        "beliebig viele Epics und Legendaries tragen.</div>";
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
      var b = REL[i][0];
      if (b !== null && b !== undefined) bases[b] = 1;
    });

    // Was nennen meine Talente, das ich nicht habe?
    var wanted = {};
    ids.forEach(function (i) {
      (REL[i][2] || []).forEach(function (j) { if (!have[j]) wanted[j] = (wanted[j] || 0) + 1; });
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
      box.innerHTML = '<div class="empty">Wähle etwas — dann schlägt die Seite ' +
        "vor, was dazu passt.</div>";
      return;
    }
    if (!list.length) {
      box.innerHTML = '<div class="empty">Kein Vorschlag. Entweder passt schon ' +
        "alles zusammen, oder deine Plätze sind voll.</div>";
      return;
    }
    box.innerHTML =
      '<div class="qhint">Aus den Tooltip-Verweisen deiner Auswahl abgeleitet. ' +
      "Dubletten, zu hohe Stufen, gesperrte Paths und volles Seltenheits-Budget " +
      "sind schon aussortiert.</div>" +
      list.map(function (x) {
        return '<div class="sug" data-add="' + x.i + '" role="button" tabindex="0">' +
          '<span class="icon" style="width:26px;height:26px;flex:0 0 26px;' +
          iconStyle(x.i, 26) + '"></span>' +
          '<span class="sugb"><span class="nm" style="color:var(--q' + CAT[x.i][3] +
          '">' + esc(CAT[x.i][0]) + "</span>" +
          '<span class="sugwhy">' + x.why + "</span></span>" +
          '<span class="sugadd">+</span></div>';
      }).join("");
  }

  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-add]");
    if (b) toggle(+b.dataset.add);
  });

  // ---------- Build-Generator ----------
  // Baut aus dem gesamten Katalog einen vollstaendigen Build zu einer
  // Ausrichtung. Kein Zufall und kein Sprachmodell: jeder Eintrag wird
  // gegen die vorhandenen Daten bewertet, und jede Aufnahme laesst sich
  // begruenden. Was im Spiel nicht ginge, kommt gar nicht erst in Frage.

  var THEMES = [
    {
      k: "ele", n: "Elementarer Waffenkämpfer",
      d: "Waffenangriffe, die als Feuer, Frost oder Natur zählen. Ignorieren " +
         "Armor und ziehen trotzdem vollen Nutzen aus Spell Power.",
      score: function (i) {
        var t = TAG[i] || 0, s = SC[i] || {};
        var v = 0;
        if ((t & T_WEAPON) && (t & T_MAGIC)) v += 10;
        else if (t & T_WEAPON) v += 3;
        if (s.w) v += s.w / 40;
        return v;
      }
    },
    {
      k: "phys", n: "Reiner Waffenkämpfer",
      d: "Physischer Schaden aus Waffenangriffen. Einfach zu spielen, " +
         "skaliert geradlinig mit Waffe und Attack Power.",
      score: function (i) {
        var t = TAG[i] || 0, s = SC[i] || {};
        var v = 0;
        if ((t & T_WEAPON) && !(t & T_MAGIC)) v += 9;
        if (t & T_PHYS) v += 3;
        if (s.w) v += s.w / 35;
        if (s.ap) v += 3;
        return v;
      }
    },
    {
      k: "cast", n: "Zauberwirker",
      d: "Reine Sprüche ohne Waffenanteil. Der Pfad mit dem stärksten " +
         "Spell-Power-Multiplikator.",
      score: function (i) {
        var t = TAG[i] || 0, s = SC[i] || {};
        var v = 0;
        if ((t & T_MAGIC) && !(t & T_WEAPON)) v += 9;
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
        if (TAG[i] & T_MAGIC) v += 2;
        return v;
      }
    },
    {
      k: "heal", n: "Heiler",
      d: "Heilung als Hauptaufgabe. Braucht zwingend Path of Healing, sonst " +
         "wird deine Spell Power nie in Healing Power umgerechnet.",
      score: function (i) {
        var t = TAG[i] || 0, s = SC[i] || {};
        var v = 0;
        if (t & T_HEAL) v += 9;
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
    var q = CAT[i][3], lim = qualityLimit(q);
    if (lim && use[q] + qualityCost(q) > lim) return false;
    var g = REL[i][3];
    if (g >= 0) {
      for (var k in sel) { if (REL[k][3] === g) return false; }
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

    function take(i, reason) {
      sel[i] = true;
      why[i] = reason;
      use[CAT[i][3]] += qualityCost(CAT[i][3]);
      if (CAT[i][1] === 1) cnt.t++; else cnt.a++;
    }

    // Runde 1: Faehigkeiten nach Themenpassung.
    var pool = [];
    for (var i = 0; i < CAT.length; i++) {
      if (CAT[i][1] !== 0) continue;
      var v = th.score(i);
      if (v > 0) pool.push([v + CAT[i][3] * 0.4, i]);
    }
    pool.sort(function (a, b) { return b[0] - a[0]; });
    for (var p = 0; p < pool.length && cnt.a < MAX_A; p++) {
      var idx = pool[p][1];
      if (genLegal(idx, sel, use, cnt)) take(idx, "passt zur Ausrichtung");
    }

    // Runde 2: Talente, die genau diese Faehigkeiten verbessern.
    // Erst hier wird aus einer Liste ein Build.
    var bases = {};
    Object.keys(sel).map(Number).forEach(function (i) {
      bases[i] = 1;
      var b = REL[i][0];
      if (b !== null && b !== undefined) bases[b] = 1;
    });
    var tpool = [];
    for (var j = 0; j < CAT.length; j++) {
      if (CAT[j][1] !== 1) continue;
      var hits = (MODOF[j] || []).filter(function (b) { return bases[b]; });
      var refs = (REL[j][2] || []).filter(function (r) { return sel[r]; });
      var sc = hits.length * 6 + refs.length * 4;
      // Reine Schadensmultiplikatoren zaehlen auch ohne Namensbezug.
      ((SC[j] || {}).inc || []).forEach(function (x) {
        if (x[2] === "dmg" && themeKey !== "heal") sc += 1.5;
        if (x[2] === "heal" && themeKey === "heal") sc += 2.5;
      });
      if (sc > 0) tpool.push([sc + CAT[j][3] * 0.3, j, hits, refs]);
    }
    tpool.sort(function (a, b) { return b[0] - a[0]; });
    for (var q2 = 0; q2 < tpool.length && cnt.t < MAX_T; q2++) {
      var t2 = tpool[q2];
      if (!genLegal(t2[1], sel, use, cnt)) continue;
      take(t2[1], t2[2].length
        ? "verbessert " + CAT[t2[2][0]][0]
        : (t2[3].length ? "wirkt auf " + CAT[t2[3][0]][0] : "hebt deinen Schaden"));
    }

    return { theme: th, ids: Object.keys(sel).map(Number), why: why, use: use };
  }

  // ---------- Stat-Priorität aus dem fertigen Build ----------
  // Jede Gewichtung zaehlt eine Eigenschaft, die im Build tatsaechlich
  // vorkommt - keine Faustregeln.
  function statPriority(ids) {
    var w = { SP: 0, AP: 0, Crit: 0, Haste: 0, Int: 0, Agi: 0, Str: 0,
              Heal: 0, Hit: 0, Sta: 0 };
    var n = { weapon: 0, weaponTal: 0, spell: 0, heal: 0, cast: 0,
              instant: 0, crit: 0 };

    ids.forEach(function (i) {
      var t = TAG[i] || 0, s = SC[i] || {}, m = MC[i] || {};
      if (s.w || (t & T_WEAPON)) {
        if (CAT[i][1] === 0) n.weapon++; else n.weaponTal++;
        w.SP += 3; w.AP += 2; w.Hit += 1;
      }
      if ((t & T_MAGIC) && !s.w) { n.spell++; w.SP += 3; }
      if (s.flat) w.SP += 1;
      if (t & T_HEAL) { n.heal++; w.Heal += 3; w.SP += 1; }
      if (m.cast) { n.cast++; w.Haste += 2.5; }
      else if (m.cd) { n.instant++; w.Haste += 0.3; }
      if (t & T_CRIT) { n.crit++; w.Crit += 2; }
      if (t & (T_WEAPON | T_MAGIC | T_HEAL)) w.Crit += 0.6;
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
          : "");
      case "AP": return (n.weapon + n.weaponTal) +
        " Einträge mit Waffenbezug, gleiche 14:1-Regel";
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
      case "Hit": return "Waffenangriffe können verfehlen — 8 % gegen Bosse";
      case "Sta": return "Überleben, kein Schaden";
      default: return "";
    }
  }

  function renderGenerator() {
    var box = document.getElementById("genbox");
    if (!box) return;
    var o = [];

    o.push('<div class="qhint">Durchsucht alle 3.071 Einträge und stellt ' +
      "einen vollständigen Build zusammen: erst die Fähigkeiten der " +
      "Ausrichtung, dann die Talente, die genau <em>diese</em> Fähigkeiten " +
      "verbessern. Dubletten, zu hohe Stufen, gesperrte Paths und dein " +
      "Seltenheits-Budget sind dabei berücksichtigt." +
      (CHAR ? "" : " <strong>Ohne importierten Charakter kennt der Generator " +
       "weder deine Stufe noch dein Budget</strong> — dann sind die " +
       "Vorschläge theoretisch.") + "</div>");

    o.push('<div class="genlist">' + THEMES.map(function (t) {
      return '<button class="genb" data-gen="' + t.k + '"><b>' + esc(t.n) +
        "</b><span>" + esc(t.d) + "</span></button>";
    }).join("") + "</div>");

    if (lastGen) {
      var g = lastGen;
      var abi = g.ids.filter(function (i) { return CAT[i][1] === 0; });
      var tal = g.ids.filter(function (i) { return CAT[i][1] === 1; });
      o.push('<div class="scsum"><b>' + esc(g.theme.n) + "</b>" +
        abi.length + " Fähigkeiten und " + tal.length + " Talente " +
        "zusammengestellt. Übernehmen ersetzt deine aktuelle Auswahl.</div>");
      o.push('<div class="pastebtns" style="padding:10px 14px">' +
        '<button class="primary" id="bGenApply">Build übernehmen</button>' +
        '<button id="bGenDrop">Verwerfen</button></div>');
      o.push('<div class="schd">Ausgewählt</div>');
      g.ids.slice().sort(function (a, b) {
        return CAT[a][1] - CAT[b][1] || CAT[b][3] - CAT[a][3];
      }).slice(0, 20).forEach(function (i) {
        o.push('<div class="cmprow"><span class="icon" style="width:20px;' +
          'height:20px;flex:0 0 20px;' + iconStyle(i, 20) + '"></span>' +
          '<span class="nm" style="color:var(--q' + CAT[i][3] + '">' +
          esc(CAT[i][0]) + "</span>" +
          '<span class="genwhy">' + esc(g.why[i] || "") + "</span></div>");
      });
      if (g.ids.length > 20) {
        o.push('<div class="qhint">… und ' + (g.ids.length - 20) + " weitere</div>");
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
      box.innerHTML = '<div class="empty">Wähle oder generiere einen Build — ' +
        "dann steht hier, worauf du beim Gear achten musst.</div>";
      return;
    }
    var r = statPriority(ids);
    hd.textContent = r.rows.length ? STAT_LABEL[r.rows[0].k] : "—";
    hd.className = "cnt ok";

    var o = ['<div class="qhint">Abgeleitet aus deinem Build, nicht aus einer ' +
      "Faustregel: " + r.n.weapon + " Waffenangriffe" +
      (r.n.weaponTal ? " (+" + r.n.weaponTal + " Talente dazu)" : "") + ", " +
      r.n.spell + " reine Sprüche, " + r.n.heal + " heilende Einträge, " +
      r.n.cast + " mit Castzeit" + (r.path ? ", Path " + esc(r.path.n.replace("Path of ", ""))
      : "") + ".</div>"];
    r.rows.forEach(function (x, n) {
      o.push('<div class="statrow"><span class="rk">' + (n + 1) + "</span>" +
        '<span class="sn">' + esc(STAT_LABEL[x.k]) + "</span>" +
        '<span class="sbar"><i style="width:' + x.pct + '%"></i></span>' +
        '<span class="sp">' + x.pct + "</span>" +
        '<span class="swhy">' + esc(statReason(x.k, r.n, r.path)) + "</span></div>");
    });
    o.push('<div class="qhint">Die Prozentzahl ist relativ zum wichtigsten ' +
      "Stat, keine Schadenszunahme. Sie sagt dir, was du bei gleichem " +
      "Itemplatz bevorzugen solltest.</div>");
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
    L.push("3. Auf welche Item-Stats soll ich beim Leveln von 10 auf 59 " +
      "achten, und in welcher Reihenfolge?");
    L.push("4. Fehlt dem Build etwas Grundsätzliches — Ressourcen, " +
      "Überleben, Flächenschaden?");
    L.push("");
    L.push("Nenne Fähigkeiten beim Namen und begründe kurz. Wenn dir Daten " +
      "fehlen, sag das, statt zu raten.");

    return L.join("\n");
  }

  // ---------- Merken ----------
  var STORE = "aldi-buildschmiede-v1";
  function save() {
    try {
      localStorage.setItem(STORE, JSON.stringify({
        b: encode(), c: CHAR ? document.getElementById("pasteBox").value : ""
      }));
    } catch (e) { /* Privatmodus: dann eben nicht */ }
  }
  function restore() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return false;
      var d = JSON.parse(raw);
      if (d.c) {
        var p = parseExport(d.c);
        if (p) {
          document.getElementById("pasteBox").value = d.c;
          applyImport(p);
          document.getElementById("impPanel").open = false;
          return true;
        }
      }
      if (d.b) { decode(d.b); return true; }
    } catch (e) { /* kaputter Eintrag: ignorieren */ }
    return false;
  }

  // ---------- Vergleich ----------
  // Zwei Builds nebeneinander. Als Quelle taugt beides: ein geteilter Link
  // oder ein Export aus dem Spiel (auch der von "/bs target").

  var RIVAL = null;

  function idsFromExport(d) {
    var ids = [], miss = [];
    function take(name) {
      var i = BYNAME[String(name).toLowerCase().trim()];
      if (i === undefined) miss.push(name); else ids.push(i);
    }
    (d.abi || []).forEach(take);
    (d.tal || []).forEach(function (t) { take(t.n); });
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
      ilvl: d.ilvl, inspect: !!d.inspect, weapons: d.weapons || []
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

  // Die Farbe liest sich aus DEINER Sicht: gruen heisst, du liegst vorn.
  // Ein "+" in der Spalte heisst immer, dass er mehr davon hat.
  function cmpCell(a, b, label, unit) {
    var d = b - a;
    var cls = d === 0 ? "" : (d > 0 ? "down" : "up");
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
      return;   // Eingabefeld bleibt stehen, nur das Ergebnis fehlt
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
      esc(CHAR && CHAR.name ? CHAR.name : "Dein Build") + "</span>" +
      '<span class="vs">gegen</span><span>' + esc(RIVAL.name) +
      (RIVAL.level ? " · Stufe " + RIVAL.level : "") +
      (RIVAL.path ? " · Path of " + esc(RIVAL.path) : "") +
      (RIVAL.inspect ? ' <span class="tagm">inspiziert</span>' : "") +
      "</span></div>");

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
    o.push('<div class="qhint"><span class="lg up">grün</span> du liegst vorn · ' +
      '<span class="lg down">orange</span> er liegt vorn. Mehr ist nicht ' +
      "automatisch besser — zwei Legendaries weniger können am Budget liegen, " +
      "nicht an schlechteren Skills.</div>");

    // Empfohlener Path je Build - der interessanteste Unterschied
    if (A.path && B.path && A.path.k !== B.path.k) {
      o.push('<div class="flag syn"><b>Andere Ausrichtung</b> ' +
        "Dein Build spricht für <b>" + esc(PATHBY[A.path.k].n) + "</b>, seiner für <b>" +
        esc(PATHBY[B.path.k].n) + "</b>. Ihr baut nicht dasselbe — ein direkter " +
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
            '<span class="nm" style="color:var(--q' + CAT[i][3] + '">' +
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
      var b = REL[i][0];
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
        var q = CAT[i][3];
        if (picked[i]) return;
        if (!qualityLimit(q)) { ok++; return; }
        if (used[q] + qualityCost(q) <= free[q]) { used[q] += qualityCost(q); ok++; }
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
      "danach selbst (der Reiter <em>Vorschläge</em> hilft dabei). Fast alle " +
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

  document.getElementById("bClear").addEventListener("click", function () {
    picked = Object.create(null);
    location.hash = "";
    refresh();
    toast("Geleert");
  });

  function refresh() {
    var ids = Object.keys(picked).map(Number);
    slots();
    recountBudget();
    renderChar();
    renderBudget();
    renderPaths(ids);
    renderIssues(ids);
    renderScale(ids);
    renderSuggest(ids);
    renderStats(ids);
    renderCompare();
    refreshOfficial();
    renderArchetypes();
    analyse();
    render();
    save();
  }

  // Build aus URL laden
  var h = location.hash.match(/b=([0-9a-z.]+)/);
  if (h) { decode(h[1]); el.url.value = shareUrl(); }
  else { restore(); }
  var ht = location.hash.match(/t=([A-Za-z]+)/);
  if (ht) {
    var tb = document.querySelector('[data-tab="' + ht[1] + '"]');
    if (tb) tb.click();
  }
  window.addEventListener("hashchange", function () {
    var m = location.hash.match(/b=([0-9a-z.]+)/);
    if (m) { decode(m[1]); refresh(); }
  });

  renderArchetypes();
  renderGenerator();
  refresh();
})();
