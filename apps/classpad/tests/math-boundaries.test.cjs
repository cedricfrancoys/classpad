"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const {test} = require("node:test");
const {parseMath} = require("../source/math-parser.js");
const {isLikelyMath, identifyImportedFormulae} = require("../source/math-detection.js");

for (const text of [
  "rappel de 2eme", "1. puissances", "2. produits remarquables", "3. equation",
  "binome conjugué", "mm dénominateur", "changer les numérateur",
  "on peut retirer un mm nbre aux 2 mmbres sans changer l'égalité",
  "change de cote change de signe", "priorité des opération papumuad pemdas pema",
  "dd(double distributivité)", "inverse→", "opposé→", "ex:", "2eme", "2 mm",
  "12/09/2026", "1/2", "12-15"
]) {
  test(`prose stays text: ${text}`, () => {
    assert.equal(isLikelyMath(text), false);
    assert.deepEqual(identifyImportedFormulae(text), {source:text, formulae:[]});
  });
}

for (const [source, converted, formulae] of [
  ["1. x²", "1. \uFFFC", ["x²"]],
  ["  2) x+1", "  2) \uFFFC", ["x+1"]],
  ["3\\. x²", "3\\. \uFFFC", ["x²"]],
  ["inverse→(a)^-1=a^-1", "inverse→\uFFFC", ["(a)^-1=a^-1"]],
  ["opposé→-a", "opposé→\uFFFC", ["-a"]],
  ["ex:x+1!", "ex:\uFFFC!", ["x+1"]],
  ["x+3=5 donc x=2", "\uFFFC donc \uFFFC", ["x+3=5", "x=2"]],
  ["x=2\ton peut continuer", "\uFFFC\ton peut continuer", ["x=2"]],
  ["x  +  3 =  5", "\uFFFC", ["x  +  3 =  5"]],
  ["s = { -2; 1,5; 12/7 } donc x=2", "\uFFFC donc \uFFFC", ["s = { -2; 1,5; 12/7 }", "x=2"]],
  ["s={};", "\uFFFC;", ["s={}"]],
  ["total+taxe", "\uFFFC", ["total+taxe"]],
  ["sqrt(x) + sin(x)", "\uFFFC", ["sqrt(x) + sin(x)"]],
  ["2 x + 2ab + x5y", "\uFFFC", ["2 x + 2ab + x5y"]]
]) {
  test(`boundaries and whitespace: ${source}`, () => {
    assert.deepEqual(identifyImportedFormulae(source), {source:converted, formulae});
  });
}

test("solution sets expose their elements, including decimal and fractional values", () => {
  assert.deepEqual(parseMath("s={-2;1,5;12/7}"), {
    type:"binary", op:"=", left:{type:"id", name:"s"},
    right:{type:"set", elements:[
      {type:"unary", op:"-", expr:{type:"number", value:"2"}},
      {type:"number", value:"1,5"},
      {type:"binary", op:"/", left:{type:"number", value:"12"}, right:{type:"number", value:"7"}}
    ]}
  });
  assert.deepEqual(parseMath("{}"), {type:"set", elements:[]});
  assert.deepEqual(parseMath("{x,y}"), {type:"set", elements:[{type:"id", name:"x"}, {type:"id", name:"y"}]});
});

for (const source of ["s={2", "s=2}", "s={2;}", "s={;2}", "s={1 2}", "s={2;3}}"] ) {
  test(`malformed set is rejected: ${source}`, () => {
    assert.throws(() => parseMath(source));
    assert.equal(isLikelyMath(source), false);
  });
}

test("explicit parsing remains permissive for named variables", () => {
  assert.doesNotThrow(() => parseMath("vitesse * temps = distance"));
  assert.equal(isLikelyMath("vitesse * temps = distance"), false);
});

test("solution sets render with braces and existing math layout", () => {
  // Exercise the production renderer with a minimal DOM, without editor startup.
  function node(text = "") {
    return {
      children:[], className:"",
      appendChild(child) { this.children.push(child); return child; },
      get textContent() { return text + this.children.map(child => child.textContent).join(""); },
      set textContent(value) { text = value; this.children = []; }
    };
  }
  const document = {createElement:() => node(), createTextNode:text => node(text)};
  const main = fs.readFileSync(path.join(__dirname, "../source/main.js"), "utf8");
  const from = main.indexOf("function el(");
  const to = main.indexOf("function renderSource(", from);
  assert.ok(from >= 0 && to > from);
  const context = vm.createContext({document});
  vm.runInContext(main.slice(from, to), context);
  const rendered = context.renderAst(parseMath("s={-2;12/7}"));
  assert.equal(rendered.textContent, "s={-2; 127}");
  function hasFraction(element) {
    return element.className === "mfrac" || element.children.some(hasFraction);
  }
  assert.ok(hasFraction(rendered));
  assert.equal(context.renderAst(parseMath("s={}")).textContent, "s={}");
});
