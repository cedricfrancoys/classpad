# Math tests

Run commands from the project root. Node's built-in test runner is used without dependencies.
`--test-isolation=none` avoids child-process restrictions in the Windows sandbox.

## Regression coverage

```powershell
node --test --test-isolation=none packages/classpad/apps/classpad/tests/math.test.cjs
```

The parser snapshots preserve the behavior before extraction. Four detection snapshots and the
Unicode heading assertion were deliberately updated when the prose false positives were fixed.

## Real classroom notes: desired behavior

```powershell
node --test --test-isolation=none packages/classpad/apps/classpad/tests/real-notes.test.cjs
```

`fixtures/real-notes.md` contains the supplied notes, including spelling and mathematical mistakes,
indentation, blank lines, and the literal escaped heading `3\. equation`. The introductory separator
from the request is not part of the notes. A final newline is included.

`fixtures/real-notes.expected.json` describes each line independently of the implementation:
strings are text to preserve; objects such as `{"math":"x+3=5"}` are complete formula spans.
Edit these annotations to change the expected boundaries. A separate integrity test checks that
the annotations reconstruct the original document exactly, including spaces and Unicode characters.

The expectations assume that:

- Titles and numbered headings remain text, including `rappel de 2eme`.
- `inverse→` and `opposé→` remain text; the expression immediately after the arrow is math.
- Explanations after formulas remain text, even with only one separating space.
- `s={2}`, negative solutions, and fractional solution sets are mathematical expressions.
  The parser and renderer support braces, including empty sets. Use semicolons between numeric
  elements (`s={-2;1,5;12/7}`), since a comma between digits denotes a decimal number.
- A mathematically incorrect equation is still a formula. These tests do not check whether a
  transformation is correct or solve equations. The student's input must not be corrected.

Tests cover per-line segmentation, parser acceptance of each expected formula, whole-document
formula order, and lossless reconstruction. They exercise the extracted functions on real text;
they do not simulate typing, caret movement, HTML rendering, or browser import/export UI.

The desired behavior is implemented; all assertions should pass. The expectations remain independent
of the detector, with no `skip`, `todo`, or inverted assertions.

## Boundary and rendering coverage

```powershell
node --test --test-isolation=none packages/classpad/apps/classpad/tests/math-boundaries.test.cjs
```

This suite tests prose on its own, numbered lists containing formulas, arrows without spaces,
mixed text and formulas, whitespace preservation, invalid sets, set ASTs, and rendering with a
minimal DOM. It does not replace a visual browser check.

Automatic detection is a heuristic: compact variables/products and known functions are preferred;
common short prose words are excluded. Longer variable names need an immediately adjacent explicit
operator for automatic recognition (`total+taxe`). Explicit parsing and Ctrl+M remain available for
ambiguous expressions such as `vitesse * temps = distance`. The parser itself does not reject prose
identifiers, and this change does not alter existing precedence or implicit-multiplication semantics.

Run all three suites together:

```powershell
node --test --test-isolation=none packages/classpad/apps/classpad/tests/math.test.cjs packages/classpad/apps/classpad/tests/real-notes.test.cjs packages/classpad/apps/classpad/tests/math-boundaries.test.cjs
```
