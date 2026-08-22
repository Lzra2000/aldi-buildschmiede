#!/usr/bin/env node
/**
 * Extract parseExport (+ helpers) from src/builder-app.js and parse a fixture.
 *
 * Usage:
 *   node tests/parse_export_harness.js data/testexport-charakter.txt
 *   node tests/parse_export_harness.js --self-check
 *
 * Prints one JSON object on stdout (no browser, no DOM).
 */
"use strict";

var fs = require("fs");
var path = require("path");

var ROOT = path.resolve(__dirname, "..");
var APP = path.join(ROOT, "src", "builder-app.js");

function loadParseExport() {
  var src = fs.readFileSync(APP, "utf8").replace(/\r\n/g, "\n");

  var start = src.indexOf("function stripIds(raw)");
  if (start < 0) throw new Error("stripIds not found in builder-app.js");

  var pe = src.indexOf("function parseExport(text)", start);
  if (pe < 0) throw new Error("parseExport not found in builder-app.js");

  var ai = src.indexOf("\n  function applyImport(", pe);
  if (ai < 0) throw new Error("applyImport marker not found after parseExport");

  // stripIds … parseLinkTail … parseExport (ends just before applyImport)
  var block = src.slice(start, ai).trim();
  if (!/function parseExport\(text\)/.test(block)) {
    throw new Error("extracted block missing parseExport");
  }

  var QUAL_KEY = { uncommon: 1, rare: 2, epic: 3, legendary: 4 };
  var factory = new Function(
    "QUAL_KEY",
    block + "\n; return parseExport;"
  );
  return factory(QUAL_KEY);
}

function parseFile(filePath) {
  var parseExport = loadParseExport();
  var text = fs.readFileSync(filePath, "utf8");
  return parseExport(text);
}

function selfCheck() {
  var parseExport = loadParseExport();
  var fixtures = [
    {
      file: "testexport-charakter.txt",
      check: function (d) {
        if (!d) return "null";
        if (d.pathEntry !== 12003) return "pathEntry";
        if (!d.draft || !d.modes || d.modes.indexOf("DRAFT") < 0) return "MODE DRAFT";
        if (!d.wc || !d.wc.RRAbi || d.wc.RRAbi.cur !== 2 || d.wc.RRAbi.req !== 5) {
          return "WC RRAbi";
        }
        if (!d.wc.RRTal || d.wc.RRTal.next !== 5) return "WC RRTal";
        if (d.countA !== 10 || d.countT !== 9) return "COUNT";
        if (!d.abi || d.abi.length !== 10) return "ABI len";
        if (!d.tal || d.tal.length !== 9) return "TAL len";
        return null;
      }
    },
    {
      file: "testexport-fremd.txt",
      check: function (d) {
        if (!d) return "null";
        if (d.pathEntry !== 12001) return "pathEntry";
        if (d.draft) return "draft should be false";
        if (!d.modes || d.modes.indexOf("WILDCARD") < 0) return "MODE";
        if (!d.wc || typeof d.wc.RRAbi !== "object") return "WC RRAbi";
        if (d.countA !== 7 || d.countT !== 9) return "COUNT";
        if (!d.abi || d.abi.length !== 7) return "ABI len";
        if (!d.tal || d.tal.length !== 9) return "TAL len";
        return null;
      }
    },
    {
      file: "testexport-gear.txt",
      check: function (d) {
        if (!d) return "null";
        if (d.pathEntry !== 12002) return "pathEntry";
        if (!d.draft || !d.modes || d.modes.indexOf("DRAFT") < 0) return "MODE DRAFT";
        if (!d.wc || !d.wc.RRAbi || d.wc.RRAbi.cur !== 4) return "WC RRAbi";
        if (!d.wc.RRTal || d.wc.RRTal.req !== 4) return "WC RRTal";
        if (d.countA !== 5 || d.countT !== 3) return "COUNT";
        if (!d.abi || d.abi.length !== 5) return "ABI len";
        if (!d.tal || d.tal.length !== 3) return "TAL len";
        return null;
      }
    }
  ];

  var fails = [];
  fixtures.forEach(function (fx) {
    var p = path.join(ROOT, "data", fx.file);
    var err = fx.check(parseExport(fs.readFileSync(p, "utf8")));
    if (err) fails.push(fx.file + ": " + err);
  });
  if (fails.length) {
    console.error(JSON.stringify({ ok: false, fails: fails }));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: true, fixtures: fixtures.length }));
}

function main() {
  var arg = process.argv[2];
  if (!arg || arg === "--self-check") {
    selfCheck();
    return;
  }
  var filePath = path.isAbsolute(arg) ? arg : path.resolve(process.cwd(), arg);
  var d = parseFile(filePath);
  if (!d) {
    console.error("parseExport returned null");
    process.exit(1);
  }
  console.log(JSON.stringify(d));
}

main();
