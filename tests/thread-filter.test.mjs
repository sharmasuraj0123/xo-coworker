import assert from "node:assert/strict";
import { createThreadGroups } from "../modules/threads/groups.js";
import { same } from "./lib/dom.mjs";
import { declarationsFor, valuesFor } from "./lib/css-snapshot.mjs";
import { threadStage } from "./lib/thread-stage.mjs";

const stopped = { id: "stopped", project: "p", state: "done", title: "Former design", summary: "kept a record", lastAt: 0 };
const row = { id: "thread", project: "p", state: "working", title: "Design proposal", summary: "the panel and rail", branch: "xo/thread-305201", lastAt: 1 };
const threads = [row, stopped];
const { panelThreads } = createThreadGroups({
  world: { state: { threads } }, D: { needItems: () => [] }, MAP: { agents: () => [{ go: "t:thread", doing: "Running checks", since: null }] },
  convProject: () => "p", askShort: () => "", threadMark: () => "Runtime mark", isBusy: (t) => t.id === "thread", isHeld: () => false,
});
const panel = await threadStage(panelThreads);
const { stage, press } = panel;
const search = stage.querySelector("[data-tg-q]"), toggle = stage.querySelector("[data-tg-find]");
const rows = () => [...stage.querySelectorAll(".tg-box [data-go]")].map((button) => button.dataset.go);
function type(value) {
  search.value = value;
  search.dispatchEvent(new panel.window.Event("input", { bubbles: true }));
}
assert.equal(search.parentElement.parentElement.hidden, true);
toggle.click();
same(panel.document.activeElement, search);
assert.equal(toggle.getAttribute("aria-keyshortcuts"), "/");
for (const q of ["design checks", "305201", "rail panel"]) { type(q); assert.deepEqual(rows(), ["t:thread"], q); }
type("record");
assert.deepEqual(rows(), ["t:stopped"], "search includes folded rows");
type("no such thread");
assert.deepEqual(rows(), []);
stage.querySelector("[data-tg-clear]").click();
assert.equal(search.value, "");
type("checks");
assert.equal(press(search, "ArrowDown"), true);
same(panel.document.activeElement, stage.querySelector('[data-go="t:thread"]'));
assert.equal(press(panel.document.activeElement, "/"), true);
assert.equal(press(search, "Escape"), true);
assert.equal(search.value, "");
assert.equal(press(search, "Escape"), true);
same(panel.document.activeElement, toggle);
assert.equal(search.parentElement.parentElement.hidden, true);
threads.push(...Array.from({ length: 11 }, (_, i) => ({ ...stopped, id: `extra-${i}` })));
panel.panel.repaint();
assert.equal(search.parentElement.parentElement.hidden, false, "long lists expose the filter immediately");

const agentList = '.stage .fr[data-fr="agents"] .fr-b';
assert.ok(valuesFor(agentList, "scroll-snap-type").includes("y mandatory"));
assert.ok(valuesFor(".stage .tg-q", "scroll-snap-align").includes("start"));
const searchPadding = declarationsFor(agentList + ":has(>.tg-q:not([hidden]))", "scroll-padding-top");
assert.ok(searchPadding.some(({ value }) => value === "calc(var(--h-ctl) + var(--s-2))"));
