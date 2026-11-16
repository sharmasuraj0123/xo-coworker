// The picker's writes to one conversation land in the order they were asked (C059, C060, S076: D884-SAVE-1/2,
// and the grader's 453de55 note "setRuntime is another unserialized path"). A Done still out for a project, then a
// runtime change: the runtime change used to go at once, beside the Done. If the Done landed second, it pinned the
// old runtime's model onto the new runtime. Every write now goes through one per-conversation order.
//   node tests/lp-intel-order.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// intel.js reads a few browser globals when it loads; nothing here draws
const el = () => ({ hidden: true, dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener() {}, removeEventListener() {}, setAttribute() {}, getAttribute: () => null, removeAttribute() {}, hasAttribute: () => false, querySelector: () => null, querySelectorAll: () => [], contains: () => false, focus() {} });
const byId = {};
Object.assign(globalThis, {
  document: { getElementById: (id) => (byId[id] ||= el()), createElement: () => el(), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, body: el(), documentElement: el(), activeElement: null },
  location: new URL("http://127.0.0.1/"), localStorage: { getItem: () => null, setItem() {}, removeItem() {} },
  matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }), addEventListener() {}, CSS: { escape: String },
});
globalThis.window = globalThis;
globalThis.sessionStorage = globalThis.localStorage;
const intel = await import("../js/intel.js");
const src = readFileSync(new URL("../js/intel.js", import.meta.url), "utf8");

let passed = 0;
const tests = [];
const t = (name, fn) => tests.push([name, fn]);
const gate = () => { let open; const p = new Promise((ok) => (open = ok)); return { p, open }; };
const tick = () => new Promise((r) => setTimeout(r, 0));

t("intel.js has one per-conversation order for its writes (sessionOrder)", () => {
  assert.equal(typeof intel.sessionOrder, "function", "sessionOrder is exported");
});

t("a later write to the same conversation starts only once the earlier one has settled, and lands after it", async () => {
  const order = intel.sessionOrder(), log = [], held = gate();
  const a = order("p:demo", async () => { log.push("Done B: sent"); await held.p; log.push("Done B: landed"); return true; });
  const b = order("p:demo", async () => { log.push("runtime: sent"); log.push("runtime: landed"); return true; });
  await tick(); await tick();
  assert.deepEqual(log, ["Done B: sent"], "the runtime change waits while the Done is out");
  held.open();
  await Promise.all([a, b]);
  assert.deepEqual(log, ["Done B: sent", "Done B: landed", "runtime: sent", "runtime: landed"]);
});

t("a refused write doesn't stop the next one; each caller still gets its own answer", async () => {
  const order = intel.sessionOrder(), log = [];
  const a = order("ws", async () => { log.push("a"); throw new Error("refused"); });
  const b = order("ws", async () => { log.push("b"); return "ok"; });
  await assert.rejects(a, /refused/);
  assert.equal(await b, "ok");
  assert.deepEqual(log, ["a", "b"]);
});

t("two conversations don't wait for each other", async () => {
  const order = intel.sessionOrder(), log = [], held = gate();
  const a = order("p:one", async () => { await held.p; log.push("one"); });
  const b = order("p:two", async () => { log.push("two"); });
  await b;
  assert.deepEqual(log, ["two"], "p:two went while p:one was still out");
  held.open(); await a;
});

const body = (name) => { const i = src.indexOf(`function ${name}(`); assert.ok(i > 0, `${name} found`); const j = src.indexOf("\n  }\n", i); return src.slice(i, j); };
t("a model or depth (save) and a runtime change (setRuntime) both write through that order", () => {
  assert.match(body("save"), /order\(s, \(\) => \(d\.auto \? toAuto\(s\) : pin\(s, d\.model, d\.effort\)\)\)/, "save writes through order");
  const rt = body("setRuntime");
  const inOrder = /await order\(s, async \(\) => \{\s*await api\.patchChat\(c\.chatId, \{ agent, model: null, effort: null \}\);\s*if \(pol0\) await world\.act\.setPolicy/.test(rt);
  assert.ok(inOrder, "setRuntime's patch (and the project's policy) go through order, not beside it");
  assert.equal((rt.match(/api\.patchChat\(/g) || []).length, 2, "the runtime patch, and Undo's (a later, separate act)");
});

for (const [name, fn] of tests) {
  try { await fn(); passed++; console.log("  ok  " + name); }
  catch (e) { console.error("  FAIL " + name + "\n" + (e.stack || e.message)); process.exitCode = 1; }
}
console.log(`${passed} passed${process.exitCode ? ", some failed" : ""}`);
