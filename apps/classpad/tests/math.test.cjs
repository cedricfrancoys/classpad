"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {test} = require("node:test");
const parser = require("../source/math-parser.js");
const detection = require("../source/math-detection.js");
const fixtures = require("./math-behavior.fixtures.json");

test("Unicode powers and identifiers keep their existing interpretation", () => {
  assert.equal(parser.normalizeMathSource("x² + y³"), "x^2 + y^3");
  assert.deepEqual(parser.parseMath("x² + y³"), parser.parseMath("x^2 + y^3"));
  assert.deepEqual(parser.parseMath("2é"), {
    type: "binary", op: "*",
    left: {type: "number", value: "2"},
    right: {type: "id", name: "é"}
  });
  assert.deepEqual(detection.identifyImportedFormulae("1. puissances\nx²\n"), {
    source: "1. puissances\n\uFFFC\n", formulae: ["x²"]
  });
});

// Original parser snapshots; detection expectations include deliberate prose fixes.
for (const fixture of fixtures) {
  test(`regression: ${JSON.stringify(fixture.source)}`, () => {
    assert.equal(parser.normalizeMathSource(fixture.source), fixture.normalized);
    if (fixture.error) {
      assert.throws(() => parser.parseMath(fixture.source), {message: fixture.error});
    } else {
      assert.deepEqual(parser.parseMath(fixture.source), fixture.ast);
    }
    assert.equal(detection.isLikelyMath(fixture.source), fixture.likely);
    assert.deepEqual(detection.identifyImportedFormulae(fixture.source), fixture.imported);
  });
}

test("classic browser scripts expose the same behavior without a DOM", () => {
  const sourceDir = path.join(__dirname, "../source");
  const html = fs.readFileSync(path.join(sourceDir, "index.html"), "utf8");
  const scripts = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map(match => match[1]);
  assert.deepEqual(scripts, ["math-parser.js", "math-detection.js", "main.js", "document-outline.js"]);
  const browser = vm.createContext({});
  for (const name of scripts.slice(0, 2)) {
    vm.runInContext(fs.readFileSync(path.join(sourceDir, name), "utf8"), browser, {filename: name});
  }
  for (const fixture of fixtures) {
    assert.equal(browser.ClasspadMathParser.normalizeMathSource(fixture.source), fixture.normalized);
    if (fixture.error) {
      assert.throws(() => browser.ClasspadMathParser.parseMath(fixture.source), {message: fixture.error});
    } else {
      assert.deepEqual(JSON.parse(JSON.stringify(browser.ClasspadMathParser.parseMath(fixture.source))), fixture.ast);
    }
    assert.equal(browser.ClasspadMathDetection.isLikelyMath(fixture.source), fixture.likely);
    assert.deepEqual(JSON.parse(JSON.stringify(browser.ClasspadMathDetection.identifyImportedFormulae(fixture.source))), fixture.imported);
  }
  const main = fs.readFileSync(path.join(sourceDir, "main.js"), "utf8");
  const bindings = main.match(/const \{parseMath\} = globalThis\.ClasspadMathParser;\r?\nconst \{isLikelyMath, identifyImportedFormulae\} = globalThis\.ClasspadMathDetection;/);
  assert.ok(bindings, "main.js must bind the extracted APIs");
  vm.runInContext(bindings[0], browser);
  assert.equal(vm.runInContext("isLikelyMath('2x')", browser), true);
});
