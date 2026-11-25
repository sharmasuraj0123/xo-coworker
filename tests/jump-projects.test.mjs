// @ts-check
import assert from "node:assert/strict";
import { bootPage } from "./lib/page.mjs";
import { dom } from "./lib/dom.mjs";
import { createPlaces } from "../core/kernel/places.js";
import { createScope } from "../core/kernel/scope.js";
import { createWorkspaceJump } from "../modules/search/jump-items.js";
import { stateMark } from "../core/ui/icons/icon.js";
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

const { document, window } = await dom("<main></main>");
const noop = () => {};
const run = (q, needs) => {
  const host = document.createElement("section");
  host.innerHTML = "<input><ul></ul>";
  host.hidden = true;
  document.body.append(host);
  const field = host.querySelector("input");
  const places = createPlaces();
  places.define({ id: "search.provider", kind: "list", scope: "app", description: "Jump results." });
  const scope = createScope();
  const chosen = [];
  const jump = createWorkspaceJump({
    host, sources: places, go: (view) => chosen.push(view), announce: noop, focusIn: noop, onHidden: noop,
    items: {
      D: { needItems: () => needs },
      projects: () => ["alpha", "beta", "gamma"].map((id) => ({ id, name: id })),
      threadsOf: (project) => [{ id: "t-" + project, title: "Review " + project, state: "working" }],
      projectIcon: () => "", glyphOf: () => "working", wordOf: () => "Working",
    },
    actions: {
      create: noop, settings: noop, keys: noop, theme: noop, intelligence: () => false,
      openIntelligence: noop, stage: () => false, toggleStage: noop,
    },
  }, scope);
  jump.open();
  field.value = q;
  field.dispatchEvent(new window.Event("input"));
  const rows = [...host.querySelectorAll('[role="option"]')].map((option) => {
    option.dispatchEvent(new window.Event("click", { bubbles: true }));
    return { v: chosen.at(-1), sub: option.querySelector(".j-s").textContent, icon: option.querySelector(".j-ic").innerHTML };
  });
  scope.dispose();
  host.remove();
  return rows;
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
  const icon = document.createElement("div");
  icon.innerHTML = `<span class="j-th">${stateMark("working")}</span>`;
  assert.equal(working?.icon, icon.innerHTML);
  icon.innerHTML = `<span class="j-th">${stateMark("needs_reply")}</span>`;
  assert.equal(waiting?.icon, icon.innerHTML);
});
const { document: page } = await bootPage();
t("the sidebar offers Jump without a separate project search field", () => {
  const sidebar = page.getElementById("side");
  assert.equal(sidebar.querySelector("#side-jump")?.tagName, "BUTTON");
  assert.equal(sidebar.querySelectorAll('input:not([type="file"]), [role="searchbox"]').length, 0);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
