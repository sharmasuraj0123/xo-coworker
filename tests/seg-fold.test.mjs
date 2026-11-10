// In a narrow pane the viewer's segments fold to their icons, and only a button with an icon folds: every segment
// button keeps a visible label or icon (the controls grader on 131d146, S225, 390 light and dark: an image's Actual
// size button was blank; its words were two spans, "Actual size" and "1:1", with no icon, and the fold hid every
// .vw-seg button span under 520 px). A button without an icon keeps its words, the short ones in a narrow pane.
//   node tests/seg-fold.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const panel = readFileSync(new URL("../css/panel.css", import.meta.url), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const src = readFileSync(new URL("../js/viewer.js", import.meta.url), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const fold = (() => { const m = /@container flpv \(max-width:520px\)\{([\s\S]*?\})\}/.exec(panel); assert.ok(m, "the narrow pane's fold"); return m[1]; })();

t("only a button with an icon folds to it", () => {
  assert.match(fold, /\.vw-seg button:where\(:has\(svg\)\)\{width:28px;padding:0;justify-content:center\}/, 'at the weight it had: a phone keeps its 36');
  assert.match(fold, /\.vw-seg button:where\(:has\(svg\)\) span\{display:none\}/);
  assert.doesNotMatch(fold, /\.vw-seg button span\{display:none\}/, "never every button's words");
});
t("a button without one keeps its words, the short ones in a narrow pane", () => {
  assert.match(fold, /\.vw-seg \.vw-wide\{display:none\}\.vw-seg \.vw-narrow\{display:inline\}/);
});
t("every segment button the viewer draws has an icon, or words outside a folded span", () => {
  const groups = [...src.matchAll(/<div class="vw-seg[^"]*" role="group"[^>]*>([\s\S]*?)<\/div>/g)].map((m) => m[1]);
  assert.ok(groups.length >= 3, "the viewer's segments");
  for (const g of groups) for (const b of g.match(/<button\b[\s\S]*?<\/button>/g) || []) {
    const icon = /\$\{(?:ICON\.\w+|[A-Z_]+_IC)\}|<svg/.test(b);
    const bare = b.replace(/<button[^>]*>/, "").replace(/<\/button>/, "").replace(/<span[\s\S]*?<\/span>/g, "").replace(/\$\{[^}]*\}/g, "").trim();
    assert.ok(icon || bare || /class="vw-narrow"/.test(b), `a button that would be blank folded: ${b.slice(0, 120)}`);
  }
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
