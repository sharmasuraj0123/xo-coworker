// The notices' line never lies on anything docked over the composer: what's docked there is one stack, and the line
// sits on its top. It was placed against the composer bar alone, with one exception written for the put-away file's
// chip (the controls grader on f93345a, S007: "Can't reach XO" over the ×'s ring at 390), so the thread's decision
// card, docked between them, still lay 6 px under it at 390 and met it with no ring room at 1440 (seen on 86b3f9b in
// the create-project grader's shot). Now the line is the stack's first child, placed against the dock's whole box:
// on the composer bar's fade when nothing is docked (where it was), on the stack's top, clear of its ring's room, when
// anything is (measured: the bar's top below the dock's). The census of the stack as drawn, every docked box in four
// cells, is in tests/browser/flows.test.cjs (STACK).
//   node tests/notice-clear.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rules, context, decls } from "./lib/cascade.mjs";

const ROOT = new URL("../", import.meta.url);
const read = (f) => readFileSync(new URL(f, ROOT), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
const app = read("css/app.css"), mx = read("css/msgx.css"), html = readFileSync(new URL("index.html", ROOT), "utf8").replace(/<!--[\s\S]*?-->/g, "");
const js = readFileSync(new URL("js/app.js", ROOT), "utf8");
const all = rules(new URL("tests/lib/x.mjs", ROOT));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("one stack: the dock holds the line first, then what's docked, then the composer bar; the line isn't in the bar", () => {
  const dock = html.slice(html.indexOf('<div class="dock" id="dock">'));
  const kids = [...dock.matchAll(/\n {8}<div class="([\w-]+)"(?: id="([\w-]+)")?/g)].map((m) => m[1]).slice(0, 4);
  assert.deepEqual(kids.slice(0, 3), ["herald", "tdock", "cbar"]);
  const bar = dock.slice(dock.indexOf('<div class="cbar">'), dock.indexOf('<form class="composer"'));
  assert.doesNotMatch(bar, /id="herald"/, "the line is placed against the stack, not the bar");
});
t("census: what's docked over the composer is in the flow, so the dock's top is the stack's top, at every width", () => {
  for (const w of [1440, 390]) {
    const placed = all.filter((r) => context(r, w).active && /(^|[\s>])\.(tdock|cbar)$/.test(r.sel))
      .flatMap((r) => decls(r.d).filter((d) => d.p === "position" && /absolute|fixed/.test(d.v)).map((d) => `${r.f}: ${r.sel} { position: ${d.v} }`));
    assert.deepEqual(placed, [], `at ${w}, nothing docked is taken out of the stack`);
  }
});
t("census: the line is placed by the stack alone, never against one thing docked in it", () => {
  const herald = all.filter((r) => /\.herald$/.test(r.sel)).filter((r) => decls(r.d).some((d) => /^(bottom|top|inset)$/.test(d.p)));
  const named = herald.filter((r) => /\.(tdock|card|dock-fold|composer)\b/.test(r.sel)).map((r) => `${r.f}: ${r.sel}`);
  assert.deepEqual(named, [], "no rule places the line against a docked thing");
  const where = herald.filter((r) => !/body\.stage-covers/.test(r.sel)).map((r) => `${r.f}: ${r.sel} { bottom: ${decls(r.d).find((d) => d.p === "bottom").v} }`);
  assert.deepEqual(where, [
    "app.css: .herald { bottom: calc(100% - var(--cbar-fade) + var(--dock-gap)) }",
    "app.css: body:not(.stage-covers) .dock.is-stacked>.herald { bottom: calc(100% + var(--dock-gap)) }",
  ], "on the bar's fade with nothing docked, --dock-gap over the composer whatever the bar's fade room; on the stack's top, --dock-gap over it, with anything docked");
  // the line was once placed 20 px into a bar whose fade room was 30 and 22 on a phone: 10 and 8 px over the box
  // (the owner, 19 Nov). Every bar's top room is the one token the line is placed from.
  const css = (f) => readFileSync(new URL(`../css/${f}`, import.meta.url), "utf8");
  const bars = css("app.css").match(/\.cbar\{[^}]*padding:[^;}]+/g).map((d) => d.replace(/^.*padding:/, ""));
  assert.ok(bars.length >= 2, "the bar's rules: the dock's, a phone's");
  for (const p of bars) assert.ok(p === "0" || p.startsWith("var(--cbar-fade) "), `the bar's top room is --cbar-fade: ${p}`);
  const tok = css("tokens.css");
  assert.match(tok, /--dock-gap:var\(--s-\d+\)/, "the gap is on the space scale");
  assert.match(tok, /--cbar-fade:\d+px/);
  assert.match(app, /\.tdock:not\(:empty\)\{margin-bottom:var\(--dock-gap\)\}/, "the decision over the box: the same gap");
  assert.match(app, /\.dock\.is-stacked>\.cbar\{padding-top:0\}/, "with anything docked, the gap over the box is that thing's, not the fade room");
  assert.match(app, /\.herald\{position:absolute;z-index:1;/, "drawn over the bar's fade it rides above the bar, a later sibling");
});
t("anything docked is measured, in the dock's own observer, before the frame is painted", () => {
  assert.match(js, /const dock = \$\("#dock"\), bar = dock\.querySelector\("\.cbar"\);\s*new ResizeObserver\(\(\) => \{\s*\$\("#app"\)\.style\.setProperty\("--dock-h", `\$\{dock\.offsetHeight\}px`\);\s*const on = bar\.getBoundingClientRect\(\)\.top - dock\.getBoundingClientRect\(\)\.top > 0\.5;\s*if \(dock\.classList\.contains\("is-stacked"\) !== on\) dock\.classList\.toggle\("is-stacked", on\);\s*heraldRoom\(\);[^\n]*\s*\}\)\.observe\(dock\);/);
});
t("the conversation keeps room for the notices' line while it shows over its foot (it never covers the last bubble)", () => {
  // measured where it stands (the dock's observer, and each time the line is drawn); none while it's hidden
  assert.match(js, /function heraldRoom\(\) \{[\s\S]*?getClientRects\(\)\.length > 0[\s\S]*?setProperty\("--herald-room"/);
  assert.match(js, /box\._line = h;\s*heraldRoom\(\);/);
  assert.match(mx, /:root\[data-msgx\] \.scroller\{padding-bottom:calc\(var\(--dock-h\) - 18px \+ var\(--herald-room, 0px\)\)\}/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
