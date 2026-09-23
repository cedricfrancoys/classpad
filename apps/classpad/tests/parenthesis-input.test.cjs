"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const {test} = require("node:test");
const {parseMath} = require("../source/math-parser.js");
const {isLikelyMath} = require("../source/math-detection.js");
const source = fs.readFileSync(require.resolve("../source/main.js"), "utf8");
const code = source.slice(source.indexOf("function planClosingParenthesis("), source.indexOf('editor.addEventListener("keydown", (e) => {'));

function harness(text, caret, formulaOnly) {
  const handlers = {};
  const result = {text, caret, prevented:false, saves:0, inputs:0};
  const input = {
    value:text, selectionStart:caret, selectionEnd:caret,
    addEventListener:(_, handler) => { handlers.formula = handler; },
    setSelectionRange(start, end) { assert.equal(start, end); result.caret = start; },
    dispatchEvent() { result.inputs++; result.text = this.value; }
  };
  const context = vm.createContext({
    parseMath, isLikelyMath, Event, markdownComposing:false,
    editor:{addEventListener:(_, handler) => { handlers.editor = handler; }},
    formulaInput:input,
    getEditorSnapshot:() => ({source:text, caretOffset:caret, formulae:["z^2"]}),
    renderMarkdown:(text, formulae, caret) => {
      assert.deepEqual(formulae, ["z^2"]);
      Object.assign(result, {text, caret});
    },
    scheduleSave:() => { result.saves++; }
  });
  vm.runInContext(code, context);
  return {result, input, type(overrides = {}) {
    handlers[formulaOnly ? "formula" : "editor"]({
      cancelable:true, isComposing:false, inputType:"insertText", data:")",
      preventDefault:() => { result.prevented = true; }, ...overrides
    });
  }};
}

for (const formulaOnly of [false, true]) {
  for (const [text, caret, expected] of [
    ["x^2+3", 5, "(x^2+3)"],
    ["x^2+3+7", 5, "(x^2+3)+7"],
    ["a+(b)", 5, "(a+(b))"],
    ["(x^2+3)", 7, "((x^2+3))"],
    ["x ^ 2 + 3", 9, "(x ^ 2 + 3)"]
  ]) {
    test((formulaOnly ? "dialog" : "editor") + ": " + text + " at " + caret, () => {
      const h = harness(text, caret, formulaOnly);
      h.type();
      assert.equal(h.result.text, expected);
      assert.equal(h.result.caret, caret + 2);
      assert.equal(h.result.prevented, true);
      assert.equal(formulaOnly ? h.result.inputs : h.result.saves, 1);
    });
  }
  for (const text of ["a+(x^2+2", "a+(x ^ 2 + 2", "((x+2)", "", "x+", "x+2)"]) {
    test("native closing " + formulaOnly + ": " + text, () => {
      const h = harness(text, text.length, formulaOnly);
      h.type();
      assert.equal(h.result.prevented, false);
      assert.equal(h.result.caret, text.length);
    });
  }
  for (const overrides of [{isComposing:true}, {inputType:"insertFromPaste"}, {inputType:"historyUndo"}, {cancelable:false}]) {
    test("native event " + formulaOnly + JSON.stringify(overrides), () => {
      const h = harness("x+2", 3, formulaOnly);
      h.type(overrides);
      assert.equal(h.result.prevented, false);
    });
  }
}
for (const [text, expected] of [
  ["Calcul : x^2+3", "Calcul : (x^2+3)"],
  ["inverse\u2192x^2+3", "inverse\u2192(x^2+3)"],
  ["Texte\nx^2+3", "Texte\n(x^2+3)"],
  ["\uFFFC x^2+3", "\uFFFC (x^2+3)"]
]) {
  test("preserve context: " + text, () => {
    const h = harness(text, text.length, false);
    h.type();
    assert.equal(h.result.text, expected);
    assert.equal(h.result.caret, text.length + 2);
  });
}
test("prose stays native", () => {
  const h = harness("une phrase", 10, false);
  h.type();
  assert.equal(h.result.prevented, false);
});
test("dialog selection stays native", () => {
  const h = harness("x+2", 1, true);
  h.input.selectionEnd = 3;
  h.type();
  assert.equal(h.result.prevented, false);
});
test("editor selection stays native", () => {
  const h = harness("x+2", null, false);
  h.type();
  assert.equal(h.result.prevented, false);
});
