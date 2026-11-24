import assert from "node:assert/strict";
import { same } from "./lib/dom.mjs";
import { threadStage } from "./lib/thread-stage.mjs";
import { sheet } from "./lib/cascade.mjs";
import { createThreadGroups } from "../modules/threads/groups.js";
import { threadsCtl } from "../modules/threads/header.js";

const needs = [{ t: { id: "a" }, admitted: true, group: "now" }];
const threads = [
  { id: "a", project: "p", state: "working", busy: true },
  { id: "b", project: "p", state: "done" },
  { id: "c", project: "p", state: "done" },
  { id: "d", project: "q", state: "working" },
  { id: "e", project: "p", state: "working" },
].map((thread, i) => ({ ...thread, title: thread.id, lastAt: Date.UTC(2026, 9, i + 1) }));
const { STATE_WORDS, threadState, threadCounts, panelThreads } = createThreadGroups({
  world: { state: { threads } }, D: { needItems: () => needs },
  MAP: { agents: () => [{ go: "p:p", doing: "Coordinating", since: null }] },
  convProject: () => "p", askShort: () => "Review", threadMark: () => '<i class="agm"></i>',
  isBusy: (thread) => !!thread.busy, isHeld: (thread) => !!thread.held,
});
assert.deepEqual(STATE_WORDS, { needs: "Needs you", working: "Working", waiting: "Waiting", done: "Done" });
assert.equal(threadState({ id: "a", state: "working", busy: true }, needs), "needs");
assert.equal(threadState({ id: "b", state: "working", busy: true }, needs), "working");
assert.equal(threadState({ id: "c", state: "working" }, needs), "waiting");
for (const state of ["done", "resolved", "failed", "stopped"]) assert.equal(threadState({ id: "d", state }, needs), "done", state);
assert.equal(threadState({ id: "e", state: "working", frozen: true }, needs), "done");
assert.deepEqual(threadCounts("p", []), { all: 4, needs: 0, working: 1, waiting: 1, done: 2 });
assert.deepEqual(panelThreads("p:p").map(({ k, rows }) => [k, rows.map(({ go }) => go)]), [
  ["needs", ["t:a"]], ["working", ["p:p"]], ["waiting", ["t:e"]], ["done", ["t:c", "t:b"]],
]);

let changes = [];
const { document, stage, panel } = await threadStage(panelThreads, () => changes);
assert.deepEqual([...stage.querySelectorAll("[data-fr]")].map((node) => node.dataset.fr), ["agents", "changes", "map"]);
assert.deepEqual([...stage.querySelectorAll("[data-gut]")].map((node) => node.dataset.gut), ["agents|changes", "changes|map"]);
assert.match(stage.querySelector("#fr-title-agents").textContent, /^Threads4$/);
assert.equal(stage.querySelector('[data-fr-fold="map"]').getAttribute("aria-expanded"), "false");
assert.equal(stage.querySelector('[data-tg-fold="done"]').getAttribute("aria-expanded"), "false");
assert.ok(!stage.querySelector('[data-go="t:c"]'));
assert.ok(stage.querySelector('[data-go="t:a"] .ag-tm .ag-mk .agm'));
assert.ok(!stage.querySelector('[data-go="t:a"] .ag-t .agm'));

const changeFold = stage.querySelector('[data-fr-fold="changes"]');
changeFold.click();
assert.equal(changeFold.getAttribute("aria-expanded"), "false");
changes = [{ path: "src/notes.md", rel: "src/notes.md", project: "p", who: "Agent", mark: "changed" }];
panel.repaint();
assert.equal(changeFold.getAttribute("aria-expanded"), "true");

const by = threadCounts("p", needs);
const header = document.createElement("header");
document.body.append(header);
header.innerHTML = threadsCtl(by.all, by);
const control = header.querySelector("button.tw-act.th-ctl[data-stage-open]");
assert.ok(control);
assert.equal(control.getAttribute("aria-controls"), "stage");
assert.equal(control.title, "4 threads, 1 needs you: open them in the panel");
assert.equal(control.getAttribute("aria-label"), "4 threads, 1 needs you. Open them in the panel");
assert.equal(control.querySelector(".th-w")?.textContent, "Threads");
assert.equal(control.querySelector(".th-n")?.textContent, "4");
assert.equal(control.querySelector(".is-need .pj-k")?.textContent, "1");
assert.ok(!control.querySelector(".is-work"));
const running = threadCounts("p", []);
header.innerHTML = threadsCtl(running.all, running);
assert.equal(header.querySelector(".is-work .pj-k")?.textContent, "1");
assert.ok(!header.querySelector(".is-need"));
assert.equal(threadsCtl(0, running), "");

panel.page("sample", { title: "Sample", mount() {} });
panel.show("sample");
stage.querySelector('[data-fr-fold="agents"]').click();
panel.threads();
assert.equal(stage.dataset.stgPage, undefined);
assert.equal(stage.querySelector('[data-fr-fold="agents"]').getAttribute("aria-expanded"), "true");
same(document.activeElement, stage.querySelector('[data-go="t:a"]'));

const panelCss = sheet(new URL("../css/panel.css", import.meta.url));
const appCss = sheet(new URL("../css/app.css", import.meta.url));
assert.match(panelCss, /\.stage \.ag-mk \.agm\{width:var\(--mark-sm\);height:var\(--mark-sm\)/);
assert.match(appCss, /\.ar\.has-mk\{grid-template-rows:var\(--lh-ui\) var\(--mark-sm\)\}/);
assert.doesNotMatch(appCss, /\.ar:has\(/);
