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
const app = read("css/app.css"), fv = read("css/fileview.css"), mx = read("css/msgx.css"), html = readFileSync(new URL("index.html", ROOT), "utf8").replace(/<!--[\s\S]*?-->/g, "");
const js = readFileSync(new URL("js/app.js", ROOT), "utf8");
const all = rules(new URL("tests/lib/x.mjs", ROOT));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("one stack: the dock holds the line first, then what's docked, then the composer bar; the line isn't in the bar", () => {
  const dock = html.slice(html.indexOf('<div class="dock" id="dock">'));
  const kids = [...dock.matchAll(/\n {8}<div class="([\w-]+)"(?: id="([\w-]+)")?/g)].map((m) => m[1]).slice(0, 4);
  assert.deepEqual(kids, ["herald", "fdock", "tdock", "cbar"]);
  const bar = dock.slice(dock.indexOf('<div class="cbar">'), dock.indexOf('<form class="composer"'));
  assert.doesNotMatch(bar, /id="herald"/, "the line is placed against the stack, not the bar");
});
t("census: what's docked over the composer is in the flow, so the dock's top is the stack's top, at every width", () => {
  for (const w of [1440, 390]) {
    const placed = all.filter((r) => context(r, w).active && /(^|[\s>])\.(fdock|tdock|cbar)$/.test(r.sel))
      .flatMap((r) => decls(r.d).filter((d) => d.p === "position" && /absolute|fixed/.test(d.v)).map((d) => `${r.f}: ${r.sel} { position: ${d.v} }`));
    assert.deepEqual(placed, [], `at ${w}, nothing docked is taken out of the stack`);
  }
});
t("census: the line is placed by the stack alone, never against one thing docked in it", () => {
  const herald = all.filter((r) => /\.herald(:not\(\.is-out\))?$|\.herald\.is-out$/.test(r.sel)).filter((r) => decls(r.d).some((d) => /^(bottom|top|inset)$/.test(d.p)));
  const named = herald.filter((r) => /\.(fdock|tdock|fchip|card|dock-fold|composer)\b/.test(r.sel)).map((r) => `${r.f}: ${r.sel}`);
  assert.deepEqual(named, [], "no rule places the line against a docked thing");
  const where = herald.filter((r) => !/\.herald\.is-out|body\.stage-covers/.test(r.sel)).map((r) => `${r.f}: ${r.sel} { bottom: ${decls(r.d).find((d) => d.p === "bottom").v} }`);
  assert.deepEqual(where, [
    "app.css: .herald { bottom: calc(100% - 20px) }",
    "app.css: body:not(.stage-covers) .dock.is-stacked>.herald:not(.is-out) { bottom: calc(100% + var(--ring-room)) }",
    "app.css: .herald { bottom: calc(100% - 14px) }",
  ], "on the bar's fade with nothing docked (20 and 14 into the bar: 10 and 8 over the composer); on the stack's top, clear of its ring's room, with anything docked");
  assert.match(app, /\.herald\{position:absolute;z-index:1;/, "drawn over the bar's fade it rides above the bar, a later sibling");
});
t("anything docked is measured, in the dock's own observer, before the frame is painted", () => {
  assert.match(js, /const dock = \$\("#dock"\), bar = dock\.querySelector\("\.cbar"\);\s*new ResizeObserver\(\(\) => \{\s*\$\("#app"\)\.style\.setProperty\("--dock-h", `\$\{dock\.offsetHeight\}px`\);\s*const on = bar\.getBoundingClientRect\(\)\.top - dock\.getBoundingClientRect\(\)\.top > 0\.5;\s*if \(dock\.classList\.contains\("is-stacked"\) !== on\) dock\.classList\.toggle\("is-stacked", on\);\s*heraldRoom\(\);[^\n]*\s*\}\)\.observe\(dock\);/);
});
t("the conversation keeps room for the notices' line while it shows over its foot (it never covers the last bubble)", () => {
  // measured where it stands (the dock's observer, and each time the line is drawn); none while it's out over a file
  assert.match(js, /function heraldRoom\(\) \{[\s\S]*?classList\.contains\("is-out"\)[\s\S]*?setProperty\("--herald-room"/);
  assert.match(js, /box\._line = h;\s*heraldRoom\(\);/);
  assert.match(mx, /:root\[data-msgx\] \.scroller\{padding-bottom:calc\(var\(--dock-h\) - 18px \+ var\(--herald-room, 0px\)\)\}/);
});
t("a notice drawn out over Files keeps its own place (not moved by this)", () => {
  assert.match(fv, /\.herald\.is-out\{position:fixed;/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
