(function(root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory(require("./math-parser.js"));
  } else {
    root.ClasspadMathDetection = factory(root.ClasspadMathParser);
  }
})(globalThis, function(parser) {
"use strict";

const {normalizeMathSource, parseMath} = parser;

const mathFunctions = new Set(["sqrt", "sin", "cos", "tan", "log", "ln", "abs"]);
// Short prose words are otherwise indistinguishable from implicit products.
const proseWords = new Set([
  "au", "de", "du", "en", "et", "il", "je", "la", "le", "les", "ma", "me",
  "ne", "ni", "on", "ou", "sa", "se", "si", "ta", "te", "tu", "un", "une",
  "aux", "mm", "dd", "ex", "is", "of", "the", "to", "and", "or"
]);

function hasMathIdentifiers(source) {
  for (const match of source.matchAll(/[A-Za-zÀ-ÿ_][A-Za-zÀ-ÿ0-9_]*/g)) {
    const name = match[0];
    const lower = name.toLowerCase();
    const before = source.slice(0, match.index);
    const after = source.slice(match.index + name.length);
    if (mathFunctions.has(lower) && /^\s*\(/.test(after)) continue;
    if (proseWords.has(lower)) return false;
    // Keep compact algebraic products (ab, x5y) and indexed variables (x12).
    if (/^[A-Za-z](?:\d*[A-Za-z])?\d*$/.test(name) || lower === "pi") continue;
    // Named variables remain possible when explicitly joined to an operator.
    // Whitespace alone must never turn an ordinary word into a variable.
    if (/[=+*/^]$/.test(before) || /^[=+*/^]/.test(after)) continue;
    return false;
  }
  return true;
}

function isLikelyMath(src) {
  const raw = src.trim();
  // Inspect list punctuation before a dot is normalized to multiplication.
  if (/^\d+\\?[.)]\s/.test(raw)) return false;
  const s = normalizeMathSource(raw);
  if (s.length < 2) return false;
  if (!hasMathIdentifiers(s)) return false;

  // Exclude dates, page fractions, etc.
  if (/^\d{1,4}\/\d{1,2}\/\d{1,4}$/.test(s)) return false;
  if (/^\d+\/\d+$/.test(s)) return false; // Deliberately conservative.
  if (/^\d+[-–]\d+$/.test(s)) return false;

  const hasOperator = /[=+*^|]/.test(s) || /\/[A-Za-z_(]/.test(s) || /[A-Za-z_)]+\//.test(s);
  const hasMathFunction = /\b(sqrt|sin|cos|tan|log|ln|abs)\s*\(/i.test(s);
  const hasImplicitMultiplication = /(?:\d|\))\s*(?:[A-Za-zÀ-ÿ_(])/.test(s);
  const hasUnaryVariable = /^[-+]\s*[A-Za-z]$/.test(s);
  const hasVariable = /[A-Za-z]/.test(s);

  if (!(hasOperator || hasMathFunction || hasImplicitMultiplication || hasUnaryVariable)) return false;
  if (!hasVariable && !hasMathFunction && !/\^/.test(s)) return false;

  try {
    parseMath(s);
    return true;
  } catch {
    return false;
  }
}

function identifyImportedFormulae(source) {
  const formulae = [];
  const convertedSource = source.split("\n").map(line => {
    const listPrefix = line.match(/^\s*\d+\\?[.)]\s+/);
    const contentStart = listPrefix ? listPrefix[0].length : 0;
    // Include boundaries without requiring spaces, as in "inverse→x^-1".
    // Keep braces, commas and semicolons together for solution sets.
    const tokens = Array.from(line.matchAll(/[^\s→:!?]+/g))
      .filter(token => token.index >= contentStart);
    let result = "";
    let cursor = 0;
    let tokenIndex = 0;

    while (tokenIndex < tokens.length) {
      const start = tokens[tokenIndex].index;
      let match = null;

      // Find the longest valid expression starting at the current word.
      // Recognize both compact and spaced expressions, such as x^2 and x + 2 = 5.
      const lastCandidateIndex = Math.min(tokens.length - 1, tokenIndex + 31);
      for (let endIndex = lastCandidateIndex; endIndex >= tokenIndex; endIndex--) {
        const tokenEnd = tokens[endIndex].index + tokens[endIndex][0].length;
        const raw = line.slice(start, tokenEnd);
        const punctuationMatch = raw.match(/([,;:.!?]+)$/);
        const punctuation = punctuationMatch ? punctuationMatch[1] : "";
        const candidate = punctuation ? raw.slice(0, -punctuation.length) : raw;

        if (isLikelyMath(candidate)) {
          match = {candidate, punctuation, tokenEnd, nextIndex:endIndex + 1};
          break;
        }
      }

      if (!match) {
        tokenIndex++;
        continue;
      }

      result += line.slice(cursor, start) + "\uFFFC" + match.punctuation;
      cursor = match.tokenEnd;
      tokenIndex = match.nextIndex;
      formulae.push(match.candidate);
    }

    return result + line.slice(cursor);
  }).join("\n");

  return {source:convertedSource, formulae};
}


return {isLikelyMath, identifyImportedFormulae};
});
