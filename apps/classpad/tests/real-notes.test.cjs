"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {test} = require("node:test");
const {parseMath} = require("../source/math-parser.js");
const {identifyImportedFormulae} = require("../source/math-detection.js");
const expectedLines = require("./fixtures/real-notes.expected.json");
// Match normalizeMarkdownEnd's newline conversion at the import boundary.
const source = fs.readFileSync(path.join(__dirname, "fixtures/real-notes.md"), "utf8")
  .replace(/\r\n?/g, "\n");
const sourceLines = source.split("\n");

function originalText(segments) {
  return segments.map(segment => typeof segment === "string" ? segment : segment.math).join("");
}

function expectedImport(segments) {
  return {
    source: segments.map(segment => typeof segment === "string" ? segment : "\uFFFC").join(""),
    formulae: segments.filter(segment => typeof segment !== "string").map(segment => segment.math)
  };
}

test("fixture annotations reproduce the complete notes exactly", () => {
  for (const segments of expectedLines) {
    assert.ok(Array.isArray(segments));
    for (const segment of segments) {
      if (typeof segment !== "string") {
        assert.deepEqual(Object.keys(segment), ["math"]);
        assert.equal(typeof segment.math, "string");
        assert.ok(segment.math.length > 0);
      }
    }
  }
  assert.equal(expectedLines.map(originalText).join("\n"), source);
});

for (const [index, segments] of expectedLines.entries()) {
  const label = `line ${index + 1}: ${JSON.stringify(originalText(segments))}`;
  test(`segmentation / ${label}`, () => {
    assert.deepEqual(identifyImportedFormulae(sourceLines[index]), expectedImport(segments));
  });
  // Syntax acceptance is independent of automatic segmentation and equation truth.
  for (const segment of segments.filter(segment => typeof segment !== "string")) {
    test(`parser / line ${index + 1}: ${segment.math}`, () => {
      assert.doesNotThrow(() => parseMath(segment.math));
    });
  }
}

test("complete document keeps the expected formula order and text boundaries", () => {
  const expected = expectedLines.map(expectedImport);
  assert.deepEqual(identifyImportedFormulae(source), {
    source: expected.map(line => line.source).join("\n"),
    formulae: expected.flatMap(line => line.formulae)
  });
});

test("detected document can be reconstructed without losing or changing characters", () => {
  const result = identifyImportedFormulae(source);
  let index = 0;
  const reconstructed = result.source.replace(/\uFFFC/g, () => result.formulae[index++]);
  assert.equal(index, result.formulae.length);
  assert.equal(reconstructed, source);
});

test("unescaped equation heading also remains text", () => {
  assert.deepEqual(identifyImportedFormulae("3. equation"), {
    source: "3. equation", formulae: []
  });
});
