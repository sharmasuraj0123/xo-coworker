import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import { createNoticeLine } from "../modules/conversation/notice-line.js";
import { sheet, rules, context, decls } from "./lib/cascade.mjs";

const ROOT = new URL("../", import.meta.url);
const app = sheet(new URL("../css/app.css", import.meta.url)), mx = sheet(new URL("modules/conversation/msgx.css", ROOT));
const all = rules(new URL("tests/lib/x.mjs", ROOT));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

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
    "app.css: .tp .dock.is-stacked>.herald { bottom: calc(100% + var(--dock-gap)) }",
    "app.css: .dock.is-top>.herald { bottom: auto }",
  ], "on the bar's fade with nothing docked, --dock-gap over the composer whatever the bar's fade room; on the stack's top, --dock-gap over it, with anything docked; under the stack when the dock leads its page");
  // the line was once placed 20 px into a bar whose fade room was 30 and 22 on a phone: 10 and 8 px over the box
  const bars = app.match(/\.cbar\{[^}]*padding:[^;}]+/g).map((d) => d.replace(/^.*padding:/, ""));
  assert.ok(bars.length >= 2, "the bar's rules: the dock's, a phone's");
  for (const p of bars) assert.ok(p === "0" || p.startsWith("var(--cbar-fade) "), `the bar's top room is --cbar-fade: ${p}`);
  const tok = sheet(new URL("core/ui/tokens.css", ROOT));
  assert.match(tok, /--dock-gap:var\(--s-\d+\)/, "the gap is on the space scale");
  assert.match(tok, /--cbar-fade:\d+px/);
  assert.match(app, /\.tdock:not\(:empty\)\{margin-bottom:var\(--dock-gap\)\}/, "the decision over the box: the same gap");
  assert.match(app, /\.dock\.is-stacked>\.cbar\{padding-top:0\}/, "with anything docked, the gap over the box is that thing's, not the fade room");
  assert.match(app, /\.herald\{position:absolute;z-index:1;/, "drawn over the bar's fade it rides above the bar, a later sibling");
});
t("the conversation keeps room for the notices' line while it shows over its foot (it never covers the last bubble)", () => {
  // measured where it stands (the dock's observer, and each time the line is drawn); none while it's hidden
  assert.match(mx, /:root\[data-msgx\] \.scroller\{padding-bottom:calc\(var\(--dock-h\) - 18px \+ var\(--herald-room, 0px\)\)\}/);
});
const { document } = await dom('<main id="app"><div id="dock"><div id="herald"></div></div></main>');
const herald = document.getElementById("herald"), composer = {};
herald.getBoundingClientRect = () => ({ top: 60 });
document.getElementById("dock").getBoundingClientRect = () => ({ top: 100 });
const S = { view: "home", herald: { text: "Saved", kind: "done", n: 1, until: Infinity } };
const line = createNoticeLine({ S, world: { state: {} }, MK: composer, composerNow: () => composer, panelHost: () => null, connDest: () => ({}) });
line.heraldRender([]);
assert.equal(document.getElementById("app").style.getPropertyValue("--herald-room"), "48px");
S.herald = { ...S.herald, n: 2, text: "Updated" };
line.heraldRender([]);
const notice = herald.firstElementChild;
assert.ok(notice.classList.contains("is-in"));
const changes = new MutationObserver(() => {});
changes.observe(notice, { attributes: true });
line.heraldRender([]);
assert.ok(herald.firstElementChild === notice);
assert.ok(notice.classList.contains("is-in"));
assert.equal(changes.takeRecords().length, 0, "an unchanged notice does not replay its entrance");
changes.disconnect();
S.herald = null;
line.heraldRender([]);
assert.equal(document.getElementById("app").style.getPropertyValue("--herald-room"), "0px");
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
