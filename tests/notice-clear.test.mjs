import assert from "node:assert/strict";
import { dom } from "./lib/dom.mjs";
import { createNoticeLine } from "../modules/conversation/notice-line.js";
import { context } from "./lib/cascade.mjs";
import { publishedRules, stylesheetRows } from "./lib/css-snapshot.mjs";

const all = publishedRules();
const values = (selector, property) => all.filter(({ sel }) => sel === selector)
  .flatMap(({ declarations }) => declarations.filter(({ p }) => p === property).map(({ v }) => v));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

t("census: what's docked over the composer is in the flow, so the dock's top is the stack's top, at every width", () => {
  for (const w of [1440, 390]) {
    const placed = all.filter((r) => context(r, w).active && /(^|[\s>])\.(tdock|cbar)$/.test(r.sel))
      .flatMap((r) => r.declarations.filter((d) => d.p === "position" && /absolute|fixed/.test(d.v)).map((d) => r.sel));
    assert.deepEqual(placed, [], `at ${w}, nothing docked is taken out of the stack`);
  }
});
t("census: the line is placed by the stack alone, never against one thing docked in it", () => {
  const herald = all.filter((r) => /\.herald$/.test(r.sel)).filter((r) => r.declarations.some((d) => /^(bottom|top|inset)$/.test(d.p)));
  const named = herald.filter((r) => /\.(tdock|card|dock-fold|composer)\b/.test(r.sel)).map((r) => r.sel);
  assert.deepEqual(named, [], "no rule places the line against a docked thing");
  const where = herald.filter((r) => !/body\.stage-covers/.test(r.sel)).map((r) => [r.sel, r.declarations.find((d) => d.p === "bottom")?.v]);
  assert.deepEqual(where, [
    [".herald", "calc(100% - var(--cbar-fade) + var(--dock-gap))"],
    ["body:not(.stage-covers) .dock.is-stacked>.herald", "calc(100% + var(--dock-gap))"],
    [".tp .dock.is-stacked>.herald", "calc(100% + var(--dock-gap))"],
    [".dock.is-top>.herald", "var(--dock-gap)"],
  ], "on the bar's fade with nothing docked, --dock-gap over the composer whatever the bar's fade room; on the stack's top, --dock-gap over it, with anything docked; --dock-gap over the page's foot when the dock leads it");
  const bars = values(".cbar", "padding");
  assert.ok(bars.length >= 2, "the bar's rules: the dock's, a phone's");
  for (const p of bars) assert.ok(p === "0" || p.startsWith("var(--cbar-fade) "), `the bar's top room is --cbar-fade: ${p}`);
  assert.ok(stylesheetRows.some(({ property, value }) => property === "--dock-gap" && /^var\(--s-\d+\)$/.test(value)));
  assert.ok(stylesheetRows.some(({ property, value }) => property === "--cbar-fade" && /^\d+px$/.test(value)));
  assert.ok(values(".tdock:not(:empty)", "margin-bottom").includes("var(--dock-gap)"));
  assert.ok(values(".dock.is-stacked>.cbar", "padding-top").includes("0"));
  assert.ok(values(".herald", "position").includes("absolute"));
  assert.ok(values(".herald", "z-index").includes("1"));
});
t("the conversation keeps room for the notices' line while it shows over its foot (it never covers the last bubble)", () => {
  const room = values(":root[data-msgx] .scroller", "padding-bottom");
  assert.ok(room.includes("calc(var(--dock-h) - 18px + var(--herald-room, 0px))"));
});
const { document, window } = await dom('<main id="app"><div id="dock"><div id="herald"></div></div></main>');
const herald = document.getElementById("herald"), composer = {};
herald.getBoundingClientRect = () => ({ top: 60 });
document.getElementById("dock").getBoundingClientRect = () => ({ top: 100 });
const S = { view: "home", herald: { text: "Saved", kind: "done", n: 1, until: Infinity } };
const line = createNoticeLine({ notice: () => S.herald, world: { state: {} }, MK: composer, composerNow: () => composer, panelHost: () => null, connDest: () => ({}) });
line.heraldRender([]);
assert.equal(document.getElementById("app").style.getPropertyValue("--herald-room"), "48px");
S.herald = { ...S.herald, n: 2, text: "Updated" };
line.heraldRender([]);
const notice = herald.firstElementChild;
assert.ok(notice.classList.contains("is-in"));
const changes = new window.MutationObserver(() => {});
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
