(function(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.ClasspadMathParser = factory();
  }
})(globalThis, function() {
"use strict";

function normalizeMathSource(src) {
  return src
    .replace(/²/g, "^2")
    .replace(/³/g, "^3")
    .replace(/\./g, "*");
}

function tokenize(src) {
  src = normalizeMathSource(src);
  const tokens = [];
  let i = 0;

  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }

    if (/[0-9]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[0-9]/.test(src[j])) j++;
      if (src[j] === "," && /[0-9]/.test(src[j + 1] || "")) {
        j++;
        while (j < src.length && /[0-9]/.test(src[j])) j++;
      }
      const raw = src.slice(i, j);
      tokens.push({type:"number", value:raw});
      i = j;
      continue;
    }

    if (/[A-Za-zÀ-ÿ_]/.test(ch)) {
      let j = i + 1;
      while (j < src.length && /[A-Za-zÀ-ÿ0-9_]/.test(src[j])) j++;
      tokens.push({type:"id", value:src.slice(i, j)});
      i = j;
      continue;
    }

    if ("+-*/^=(),|{};".includes(ch)) {
      tokens.push({type:ch, value:ch});
      i++;
      continue;
    }

    throw new Error("Caractère non reconnu : " + ch);
  }

  tokens.push({type:"eof"});
  return tokens;
}

function parseMath(src) {
  const tokens = tokenize(src);
  let pos = 0;

  const peek = () => tokens[pos];
  const take = (type) => {
    const t = tokens[pos];
    if (t.type !== type) throw new Error("Attendu : " + type);
    pos++;
    return t;
  };

  function parsePrimary(stopAtAbsoluteBar = false) {
    const t = peek();

    if (t.type === "number") {
      pos++;
      return {type:"number", value:t.value};
    }

    if (t.type === "id") {
      pos++;
      const name = t.value;

      if (peek().type === "(") {
        take("(");
        const args = [];
        if (peek().type !== ")") {
          args.push(parseExpression());
          while (peek().type === ",") {
            take(",");
            args.push(parseExpression());
          }
        }
        take(")");
        return {type:"call", name, args};
      }

      return {type:"id", name};
    }

    if (t.type === "{") {
      take("{");
      const elements = [];
      if (peek().type !== "}") {
        elements.push(parseExpression());
        while (peek().type === ";" || peek().type === ",") {
          pos++;
          elements.push(parseExpression());
        }
      }
      take("}");
      return {type:"set", elements};
    }

    if (t.type === "(") {
      take("(");
      const expr = parseExpression();
      take(")");
      return {type:"group", expr};
    }

    if (t.type === "|") {
      take("|");
      const expr = parseExpression(true);
      take("|");
      return {type:"absolute", expr};
    }

    if (t.type === "+" || t.type === "-") {
      pos++;
      return {type:"unary", op:t.type, expr:parsePrimary(stopAtAbsoluteBar)};
    }

    throw new Error("Expression incomplète");
  }

  function parsePower(stopAtAbsoluteBar = false) {
    let left = parsePrimary(stopAtAbsoluteBar);
    if (peek().type === "^") {
      take("^");
      const right = parsePower(stopAtAbsoluteBar); // Right-associative.
      left = {type:"binary", op:"^", left, right};
    }
    return left;
  }

  function parseMulDiv(stopAtAbsoluteBar = false) {
    let left = parsePower(stopAtAbsoluteBar);
    while (peek().type === "*" || peek().type === "/" ||
        peek().type === "id" || peek().type === "(" ||
        (!stopAtAbsoluteBar && peek().type === "|")) {
      const explicitOperator = peek().type === "*" || peek().type === "/";
      const op = explicitOperator ? peek().type : "*";
      if (explicitOperator) pos++;
      const right = parsePower(stopAtAbsoluteBar);
      left = {type:"binary", op, left, right};
    }
    return left;
  }

  function parseAddSub(stopAtAbsoluteBar = false) {
    let left = parseMulDiv(stopAtAbsoluteBar);
    while (peek().type === "+" || peek().type === "-") {
      const op = peek().type;
      pos++;
      const right = parseMulDiv(stopAtAbsoluteBar);
      left = {type:"binary", op, left, right};
    }
    return left;
  }

  function parseExpression(stopAtAbsoluteBar = false) {
    let left = parseAddSub(stopAtAbsoluteBar);
    if (peek().type === "=") {
      take("=");
      const right = parseExpression(stopAtAbsoluteBar);
      left = {type:"binary", op:"=", left, right};
    }
    return left;
  }

  const ast = parseExpression();
  if (peek().type !== "eof") throw new Error("Expression non comprise entièrement");
  return ast;
}


return {normalizeMathSource, parseMath};
});
