// While a project is being created, what the dialog offers is what it does (the create-project grader on c8f4c45,
// create-actions run-v2 busy-close, all four cells):
// - C018: an empty project's create can't be called back once it's sent, yet its button said Cancel; it only closed
//   the dialog and the project was made anyway. While any create is on its way the button says Close (a clone also
//   offers Stop, which does stop it).
// - C019: the busy Create had aria-disabled="" (toggleAttribute), which ARIA reads as not disabled. ARIA states are
//   written as values, never as bare attributes: the busy Create says "true"; the sidebar's current place says
//   aria-current="page" (an empty aria-current is read as false).
//   node tests/create-busy-honest.test.mjs
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const create = readFileSync(new URL("../js/create.js", import.meta.url), "utf8");
const js = readdirSync(new URL("../js/", import.meta.url), { recursive: true }).filter((f) => String(f).endsWith(".js") && !String(f).startsWith("vendor")).map((f) => [f, readFileSync(new URL(`../js/${f}`, import.meta.url), "utf8")]);
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const busy = (() => { const i = create.indexOf("function setBusy(on, repoOf) {"); assert.ok(i > 0); return create.slice(i, create.indexOf("\n  }\n", i)); })();

t("while a create is on its way, its dismiss button says Close, for every kind of create", () => {
  assert.match(busy, /cancel\.textContent = on \? "Close" : "Cancel";/);
});
t("the busy Create is aria-disabled=\"true\", and taken away after", () => {
  assert.match(busy, /if \(on\) \{ submit\.setAttribute\("aria-disabled", "true"\); submit\.setAttribute\("aria-busy", "true"\); \} else \{ submit\.removeAttribute\("aria-disabled"\); submit\.removeAttribute\("aria-busy"\); \}/);
});
t("no ARIA state is written as a bare attribute anywhere", () => {
  const bare = js.flatMap(([f, s]) => [...s.matchAll(/toggleAttribute\(\s*["']aria-[\w-]+["']/g)].map((m) => `${f}: ${m[0]}`));
  assert.deepEqual(bare, [], "toggleAttribute leaves an ARIA state empty");
});
t("the sidebar's current place says aria-current=\"page\"", () => {
  const app = js.find(([f]) => f === "app.js")[1];
  assert.match(app, /if \(b\.classList\.contains\("is-on"\)\) b\.setAttribute\("aria-current", "page"\); else b\.removeAttribute\("aria-current"\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
