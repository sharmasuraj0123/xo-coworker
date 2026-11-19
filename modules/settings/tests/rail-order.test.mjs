// The Settings rail takes the shape's order, technical pages under "Advanced", without ever moving the focused tab.
import assert from "node:assert/strict";
import { shapePage, RAIL } from "./shape-fixture.mjs";

let passed = 0;
const t = async (name, fn) => { try { await fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.stack); process.exitCode = 1; } };
const order = (nav) => [...nav.children].map((el) => el.dataset.set || el.className);
/** Each node the rail moves, by name, from now on. */
function moves(nav) {
  const moved = [];
  for (const k of ["insertBefore", "appendChild"]) { const f = nav[k].bind(nav); nav[k] = (el, ...r) => { moved.push(el.dataset.set || el.className); return f(el, ...r); }; }
  return moved;
}

await t("pages a shape marks advanced go under one label at the rail's foot; the rest keep their order", async () => {
  const P = await shapePage({ advanced: ["general", "routing"] });
  assert.deepEqual(order(P.nav()), ["shape", "rules", "shp-navh", "general", "routing"]);
  assert.equal(P.nav().querySelector('[data-set="general"]').hasAttribute("data-advanced"), true);
});

for (const focused of RAIL) {
  await t(`the focused tab (${focused}) never moves: what's around it does`, async () => {
    const P = await shapePage();
    const nav = P.nav(), tab = nav.querySelector(`[data-set="${focused}"]`);
    tab.focus();
    const moved = moves(nav);
    P.shape.list = (k) => (k === "settings" ? [{ id: "xo:settings/general", advanced: true }, { id: "xo:settings/shape", advanced: true }] : []);
    P.view.apply();
    assert.deepEqual(order(nav), ["routing", "rules", "shp-navh", "general", "shape"]);
    assert.ok(!moved.includes(focused), `${focused} moved: ${moved}`);
    assert.equal(document.activeElement, tab, "focus stays on it");
  });
}

await t("a rail already in order moves nothing", async () => {
  const P = await shapePage({ advanced: ["rules"] });
  const moved = moves(P.nav());
  P.view.apply();
  assert.deepEqual(moved, []);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
process.exit();
