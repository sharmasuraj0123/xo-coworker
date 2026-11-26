// @ts-check
import assert from "node:assert/strict";
import test from "node:test";
import { declarationsFor, publishedRules } from "./lib/css-snapshot.mjs";
import { bootPage } from "./lib/page.mjs";

test("legacy surfaces use a translucent hover fill", () => {
  const invalid = publishedRules().filter(({ f, sel, declarations }) => f.startsWith("/css/") && sel.includes(":hover")
    && declarations.some(({ p, v }) => ["background", "background-color"].includes(p) && /^var\(--fill-[12]\)$/.test(v)));
  assert.deepEqual(invalid, []);
});

test("Launchpad rows use the hover veil and share their action column", () => {
  const raw = (selector, property) => declarationsFor(selector, property).map(({ value }) => value);
  assert.deepEqual(raw("button.lqp-app:hover", "background-image"), ["linear-gradient(var(--hover-fill),var(--hover-fill))"]);
  assert.deepEqual(raw(".lqp-off", "grid-template-columns"), ["var(--tile-xl) minmax(0,1fr) auto"]);
  assert.deepEqual(raw(".lqp-off .lqp-app", "grid-template-columns"), ["subgrid"]);
  assert.deepEqual(raw(".lqp-off .lqp-app", "grid-column"), ["1/-1"]);
});

test("More has a label and decorative chevron", async () => {
  const { document } = await bootPage();
  assert.equal(document.querySelector("#nv-more .nr-name").textContent, "More");
  assert.ok(document.querySelector('#nv-more .nr-chev[aria-hidden="true"]'));
});
