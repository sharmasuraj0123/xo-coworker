import assert from "node:assert/strict";
import { rules, context, spec, cmp, decls } from "./lib/cascade.mjs";

const all = rules(new URL("../tests/lib/x.mjs", import.meta.url));
const live = all.filter((r) => context(r, 1440).active);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const LAYER = ':root:root .side :is(.prow.busy,.prow.needs,.prow.is-on,.nrow.is-on):hover';

t("one hover layer over every stateful row: working, needs you, the one you're on, the current nav row", () => {
  const r = live.find((x) => x.sel === LAYER);
  assert.ok(r, LAYER);
  assert.match(r.d, /background-image:linear-gradient\(color-mix\(in srgb,var\(--ink\) 6%,transparent\)/);
});
t("it outranks every state's wash, both themes (a wash's background shorthand would clear it)", () => {
  const layer = live.find((x) => x.sel === LAYER), ls = spec(layer.sel);
  const washes = live.filter((x) => /(^|\s)\.(prow|nrow)\.(busy|needs|is-on)/.test(x.sel.replace(/^.*?(\.(prow|nrow)\.)/, " $1")) && !/:hover|::|\s\.(pr|nr)-/.test(x.sel) && decls(x.d).some((d) => d.p === "background"));
  assert.ok(washes.length >= 7, `the washes found: ${washes.map((w) => w.sel).join(" | ")}`);
  const beat = washes.filter((w) => !(cmp(ls, spec(w.sel)) > 0 || (cmp(ls, spec(w.sel)) === 0 && layer.n > w.n)));
  assert.deepEqual(beat.map((w) => w.sel), [], "washes the layer doesn't outrank");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
