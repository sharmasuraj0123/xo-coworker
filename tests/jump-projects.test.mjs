// @ts-check
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createJumpItems } from "../modules/search/jump-items.js";
import { stateMark } from "../core/ui/icons/icon.js";
const ROOT = new URL("../", import.meta.url);
const src = readFileSync(new URL("js/app.js", ROOT), "utf8"), html = readFileSync(new URL("index.html", ROOT), "utf8");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const run = (q, needs) => {
  const places = createJumpItems({
    D: { needItems: () => needs },
    projects: () => ["alpha", "beta", "gamma"].map((id) => ({ id, name: id })),
    threadsOf: (project) => [{ id: "t-" + project, title: "Review " + project }],
    projectIcon: () => "", glyphOf: () => "working", wordOf: () => "Working",
  });
  return places(q);
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
t("a thread keeps its project, state and decision mark in Jump", () => {
  const rows = run("", [need("gamma")]);
  const working = rows.find((row) => row.v === "t:t-alpha");
  const waiting = rows.find((row) => row.v === "t:t-gamma");
  assert.equal(working?.sub, "alpha · working");
  assert.equal(working?.icon, `<span class="j-th">${stateMark("working")}</span>`);
  assert.equal(waiting?.icon, `<span class="j-th">${stateMark("needs_reply")}</span>`);
});
t("the sidebar has no find box, and nothing is left of it", () => {
  assert.ok(!/side-find|pf-in|Find a project/.test(html), "index.html");
  assert.ok(!/pfind|pfCur|#pf-in|#sf-ic|FIND_AT|pf-none/.test(src), "js/app.js");
  assert.ok(/id="side-jump"/.test(html), "the top search stays");
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
