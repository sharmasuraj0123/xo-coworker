// Concentric corners: a box in a rounded box's corner takes the outer corner minus its inset (--nest-r − --nest-in), so a
// change of size, padding or row height keeps them concentric.
//   node tests/concentric.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
const app = css("app.css"), side = css("side.css"), art = css("artifacts.css"), tok = css("tokens.css");
const NEST = "calc\\(var\\(--nest-r\\) - var\\(--nest-in\\)\\)";
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("a sidebar row's tile sits the same inset from its top, bottom and left, derived from the row and the tile", () => {
  assert.match(tok, /--tile-sm:28px;/);
  assert.match(app, /\.nrow,\.prow\{[^}]*--nest-r:var\(--r-lg\);--nest-in:calc\(\(var\(--h-row\) - var\(--tile-sm\)\) \/ 2\);min-height:var\(--h-row\);padding:calc\(var\(--nest-in\) - 1px\) 10px calc\(var\(--nest-in\) - 1px\) calc\(var\(--nest-in\) - 1px\);border-radius:var\(--nest-r\)/);
  assert.match(app, new RegExp(`\\.nr-ic,\\.pr-ic\\{[^}]*width:var\\(--tile-sm\\);height:var\\(--tile-sm\\);border-radius:${NEST}`));
  assert.doesNotMatch(side, /\.nr-ic,\.pr-ic\{border-radius:calc\(var\(--r-lg\) - 7px\)\}/);
  assert.match(side, /\.side :is\(\.nrow,\.prow\):focus-visible\{border-radius:var\(--nest-r\)\}/);
});
t("More's rows sit in its popover's corner: --r-xl − its padding and line; their tiles follow", () => {
  assert.match(tok, /--r-pop-row:calc\(var\(--r-xl\) - var\(--s-2\) - 1px\);/);
  assert.match(side, /\.side-pop\{[^}]*padding:var\(--s-2\);border-radius:var\(--r-xl\)/);
  assert.match(side, /\.side-pop \.nrow\{--nest-r:var\(--r-pop-row\)\}/);
});
t("an Artifacts card's well and pin, the @ list's rows, the Next and dock cards' corner buttons take the nest", () => {
  assert.match(art, new RegExp(`\\.md-well\\{[^}]*border-radius:${NEST} ${NEST} 0 0`));
  assert.match(app, new RegExp(`\\.md-pin\\{position:absolute;top:var\\(--cell-in\\);right:var\\(--cell-in\\);[^}]*border-radius:${NEST}`));
  assert.match(app, new RegExp(`\\.at-list li\\{[^}]*border-radius:${NEST}`));
  assert.match(app, /\.at-list\{[^}]*--nest-r:var\(--r-lg\);--nest-in:7px;padding:6px;border-radius:var\(--nest-r\)/);
  assert.match(app, new RegExp(`\\.next \\.nx-btns \\.b\\{border-radius:${NEST}\\}`));
  assert.match(app, /\.next\{--nest-r:var\(--r-3xl\);--nest-pad:21px;--nest-in:calc\(var\(--nest-pad\) \+ 1px\);[^}]*padding:var\(--nest-pad\)/);
  assert.match(app, new RegExp(`\\.card\\.is-dock \\.c-act:not\\(:has\\(\\.c-low\\)\\) \\.c-btns \\.b\\{border-radius:${NEST}\\}`));
  assert.doesNotMatch(app, /\.c-btns \.b\{border-radius:calc\(var\(--r-2xl\) - 13px\)\}/);
});
console.log(`\n${passed} passed`);
