// While a project is being created, what the dialog offers is what it does: Close, not Cancel, and ARIA states written as values.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { sourcePaths, readSource } from "../../../tests/lib/sources.mjs";

const create = readFileSync(new URL("../create.js", import.meta.url), "utf8");
const js = sourcePaths(".js").map((f) => [f, readSource(f)]);
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
  const app = js.find(([f]) => f === "js/app.js")[1];
  assert.match(app, /if \(b\.classList\.contains\("is-on"\)\) b\.setAttribute\("aria-current", "page"\); else b\.removeAttribute\("aria-current"\);/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
