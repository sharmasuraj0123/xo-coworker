// The top search (⌘K) is how you find a project: typed for, the ones that need you come first and say so; the sidebar
// has no find box of its own.
//   node tests/jump-projects.test.mjs
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
const ROOT = new URL("../", import.meta.url);
const src = readFileSync(new URL("js/app.js", ROOT), "utf8"), html = readFileSync(new URL("index.html", ROOT), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const i = src.indexOf("function jumpRender() {");
const body = src.slice(i, src.indexOf("\n}\n", i) + 2);
const run = (q, needs) => {
  const env = {
    jq: { value: q, setAttribute() {} }, jl: { set innerHTML(v) {}, querySelector: () => null },
    ICON: new Proxy({}, { get: () => "" }), XO: "", D: { needItems: () => needs },
    projects: () => ["alpha", "beta", "gamma"].map((id) => ({ id, name: id })), threadsOf: () => [],
    projectIcon: () => "", threadIc: () => "", wordOf: () => "", esc: (s) => s,
    document: { documentElement: { dataset: {} } }, IQ: { kindOf: () => null }, sessionOf: () => null, S: { view: "home" },
    REC: { jumpItems: () => [] }, CREATE: {}, STAGE: {}, openSettings() {}, openKeys() {}, $: () => ({}),
  };
  const fn = new Function(...Object.keys(env), `let jsel = 0, jitems = [];\n${body}\njumpRender();\nreturn jitems;`);
  return fn(...Object.values(env));
};
const need = (project, more = {}) => ({ admitted: true, t: { id: "t-" + project, project }, ...more });

t("typed for, a project that needs you comes before the others, and says how many need you", () => {
  const rows = run("a", [need("gamma"), need("gamma")]).filter((x) => x.v?.startsWith("p:"));
  assert.deepEqual(rows.map((x) => x.v), ["p:gamma", "p:alpha", "p:beta"]);
  assert.equal(rows[0].sub, "Project · 2 need you");
  assert.equal(rows[1].sub, "Project");
});
t("one that needs you later, or isn't admitted yet, ranks as the rest", () => {
  const rows = run("a", [need("gamma", { later: true }), need("beta", { admitted: false })]).filter((x) => x.v?.startsWith("p:"));
  assert.deepEqual(rows.map((x) => x.v), ["p:alpha", "p:beta", "p:gamma"]);
});
t("nothing typed, the projects keep their order", () => {
  const rows = run("", [need("gamma")]).filter((x) => x.v?.startsWith("p:"));
  assert.deepEqual(rows.map((x) => x.v), ["p:alpha", "p:beta", "p:gamma"]);
  assert.equal(rows[2].sub, "Project · 1 needs you");
});
t("the sidebar has no find box, and nothing is left of it", () => {
  assert.ok(!/side-find|pf-in|Find a project/.test(html), "index.html");
  assert.ok(!/pfind|pfCur|#pf-in|#sf-ic|FIND_AT|pf-none/.test(src), "js/app.js");
  assert.ok(/id="side-jump"/.test(html), "the top search stays");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
