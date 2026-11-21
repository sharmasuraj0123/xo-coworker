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
t("a menu's rows sit in its corner: --r-menu − its padding and line; More is a menu, the sidebar editor keeps --r-xl", () => {
  assert.match(tok, /--r-menu:var\(--r-lg\); --menu-pad:var\(--s-1\); --menu-row:var\(--h-ctl\);/);
  assert.match(tok, /--r-pop-row:calc\(var\(--r-menu\) - var\(--menu-pad\) - 1px\);/);
  assert.match(tok, /--r-xl-in:calc\(var\(--r-xl\) - var\(--s-2\) - 1px\);/);
  assert.match(side, /\.side-pop\{[^}]*padding:var\(--s-2\);border-radius:var\(--r-xl\)/);
  assert.match(side, /\.side-pop \.nrow\{--nest-r:var\(--r-pop-row\)\}/);
  assert.match(side, /\.side-pop\[role=menu\]\{min-width:var\(--menu-w\);padding:var\(--menu-pad\);border-radius:var\(--r-menu\)\}/);
  assert.match(side, /\.side-pop\[role=dialog\] \.nrow\{--nest-r:var\(--r-xl-in\)\}/);
});
t("the model picker's footer buttons sit in its corner: --nest-r − --nest-in from the pop", () => {
  assert.match(app, /\.iq-pop\{--nest-r:var\(--r-menu\);--nest-in:calc\(var\(--menu-pad\) \+ 1px\);[^}]*border-radius:var\(--nest-r\)/);
  assert.match(app, /\.iq-f\{[^}]*padding:var\(--s-1\) 0 0 var\(--s-2\)/);
  for (const sel of ["iq-back", "iq-done"]) assert.match(app, new RegExp(`\\.${sel}\\{[^}]*border-radius:${NEST}`), sel);
});
t("every menu reads the menu tokens: its padding and corner, its rows' height and corner", () => {
  const css = ["app", "diffs", "dropdown", "launchpad", "panel", "side"].map((f) => readFileSync(new URL(`../css/${f}.css`, import.meta.url), "utf8")).join("\n");
  for (const [box, row] of [[".tw-menu", ".tw-menu button"], [".vw-menu", ".vw-menu :is([role=menuitem],[role=menuitemradio])"], [".dd-menu", ".dd-row"], [".lp-mn", ".lp-mn button"], [".fl-menu", ".fl-menu button"]]) {
    const q = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(css, new RegExp(`(^|\\n)${q(box)}\\{[^}]*padding:var\\(--menu-pad\\);border-radius:var\\(--r-menu\\)`), box);
    assert.match(css, new RegExp(`(^|\\n)${q(row)}\\{[^}]*height:var\\(--menu-row\\);[^}]*border-radius:var\\(--r-pop-row\\)`), row);
  }
  assert.match(css, /\.side-pop\[role=menu\] \.nrow\{gap:var\(--s-2\);min-height:var\(--menu-row\);padding:0 var\(--s-2\)\}/);
  assert.match(css, /\.side-pop\[role=menu\] \.nr-ic\{width:var\(--ic\);height:var\(--ic\);background:none;border:0\}/);
});
t("an Artifacts card's well and pin, the @ list's rows, the Next and dock cards' corner buttons take the nest", () => {
  assert.match(art, new RegExp(`\\.md-well\\{[^}]*border-radius:${NEST} ${NEST} 0 0`));
  assert.match(app, new RegExp(`\\.md-pin\\{position:absolute;top:var\\(--cell-in\\);right:var\\(--cell-in\\);[^}]*border-radius:${NEST}`));
  assert.match(app, new RegExp(`\\.at-list li\\{[^}]*border-radius:${NEST}`));
  assert.match(app, /\.at-list\{[^}]*--nest-r:var\(--r-lg\);--nest-in:7px;padding:6px;border-radius:var\(--nest-r\)/);
  assert.match(app, /\.next\{--nest-r:var\(--r-card\);--nest-in:var\(--card-in\);/);
  assert.match(app, new RegExp(`:is\\(\\.card,\\.next\\) :is\\(\\.c-btns,\\.c-opts\\) \\.b\\{border-radius:${NEST}\\}`));
  assert.doesNotMatch(app, /\.c-btns \.b\{border-radius:calc\(var\(--r-2xl\) - 13px\)\}/);
});
console.log(`\n${passed} passed`);
