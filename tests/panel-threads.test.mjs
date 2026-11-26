// @ts-check

import assert from "node:assert/strict";
import { test } from "node:test";
import { createKernel } from "../core/kernel/index.js";
import { createScope } from "../core/kernel/scope.js";
import { createConversationHeader } from "../modules/conversation/header.js";
import { createThreadGroups } from "../modules/threads/groups.js";
import { createThreadControls } from "../modules/threads/controls.js";
import { threadsCtl } from "../modules/threads/header.js";
import { createTopHeader } from "../shell/top-header.js";
import { definePlaces } from "../shell/places.js";
import { stylesheetRows, tokenValuesFor, valuesFor } from "./lib/css-snapshot.mjs";
import { stageFixture } from "./lib/stage-fixture.mjs";

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
  convProject: () => "p",
  askShort: () => "Review",
  threadMark: () => '<span class="agm"></span>',
  isBusy: (thread) => !!thread.busy,
  isHeld: (thread) => !!thread.held,
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

test("on the Workspace, Threads is every project's live work, each row naming its project", () => {
  const live = [
    { id: "a", project: "p", state: "working", busy: true },
    { id: "w", project: "q", state: "working", busy: true },
    { id: "i", project: "q", state: "working" },
    { id: "z", project: "p", state: "done" },
  ].map((thread, i) => ({ ...thread, title: thread.id, lastAt: Date.UTC(2026, 9, i + 1) }));
  const ws = createThreadGroups({
    world: { state: { threads: live } }, D: { needItems: () => needs },
    MAP: { agents: () => [{ go: "p:q", doing: "Coordinating", since: null }, { go: "t:w", doing: "editing a.js", since: 1 }] },
    convProject: (v) => (v === "ws" ? "workspace" : "p"), PROJ: (p) => p.toUpperCase(),
    askShort: () => "Review", threadMark: () => "", isBusy: (thread) => !!thread.busy, isHeld: () => false,
  });
  const groups = ws.panelThreads("ws");
  assert.deepEqual(groups.map(({ k, rows }) => [k, rows.map(({ go }) => go)]), [["needs", ["t:a"]], ["working", ["p:q", "t:w"]]], "no idle or finished threads");
  const rows = groups.flatMap((g) => g.rows);
  assert.deepEqual(rows.map(({ title, sub }) => [title, sub]), [["a", "P · Review"], ["Q coordinator", "Coordinating"], ["w", "Q · editing a.js"]]);
});


test("the project header counts all thread states and places Threads before Deploy and the panel toggle", async (t) => {
  const { panel, document } = await stageFixture();
  const head = document.createElement("header");
  head.innerHTML = '<div id="top"><button id="top-back"></button><div id="top-who"></div><div id="top-end"></div></div>';
  document.body.append(head);
  const PROJ = () => "Project";
  const kernel = createKernel(), scope = createScope();
  definePlaces(kernel);
  t.after(scope.dispose);
  const conversationHeaderHtml = createConversationHeader({
    threadControls: createThreadControls(), description: () => undefined,
    PICK: {}, threadCounts, PROJ, projectIcon: () => "", threadsCtl, convHost: () => null,
  });
  const ws = conversationHeaderHtml("ws", null, needs).who ?? "";
  assert.match(ws, /<span class="tw-t is-one"><h1 id="conv-title">Workspace<\/h1><\/span>$/, "the Workspace's bar is a project's: its name, no count line");
  const render = createTopHeader({
    location: { view: () => "p:p", parentOf: () => undefined },
    PROJ, conversationHeaderHtml, places: kernel.places, emit: kernel.bus.emit, convThread: () => null,
    CH: { isChats: () => false }, STAGE: panel, atOf: () => ({}),
    LP: { button: () => '<button id="deploy">Deploy</button>', ensure() {} }, LW: { isOpen: false },
    checklistRender() {}, tdelRender() {},
  }, scope, () => {});
  render(needs);
  assert.equal(document.querySelector(".tw-t.is-one #conv-title").textContent, "Project");
  assert.deepEqual(Array.from(document.querySelector("#top-end").children, (button) =>
    button.hasAttribute("data-stage-open") ? "threads" : button.id || "panel"), ["threads", "deploy", "panel"]);
  assert.ok(!document.querySelector(".all-btn.th-btn"), "the legacy header control is absent");
  const control = document.querySelector("button.tw-act.th-ctl[data-stage-open]");
  assert.ok(control);
  assert.equal(control.getAttribute("aria-controls"), "stage");
  assert.equal(control.title, "4 threads, 1 needs you: open them in the panel");
  assert.equal(control.getAttribute("aria-label"), "4 threads, 1 needs you. Open them in the panel");
  assert.equal(control.querySelector(".th-w")?.textContent, "Threads");
  assert.equal(control.querySelector(".th-n")?.textContent, "4");
  assert.equal(control.querySelector(".is-need .pj-k")?.textContent, "1");
  assert.ok(control.querySelector(".is-work") === null, "no working marker");
  const running = threadCounts("p", []);
  render([]);
  assert.equal(document.querySelector(".is-work .pj-k")?.textContent, "1");
  assert.ok(document.querySelector(".is-need") === null, "no needs-you marker");
  assert.equal(threadsCtl(0, running), "", "a project without threads has no control");
});

test("Threads starts grouped, filters in place and returns from a page to its first row", async () => {
  const { panel, stage, document, window } = await stageFixture({ threads: () => panelThreads("p:p") });
  panel.page("files", { title: "Files", mount() {} });
  panel.open();
  const query = (selector) => stage.querySelector(selector);
  assert.match(query("#fr-title-agents").textContent, /^Threads4$/);
  assert.doesNotMatch(stage.textContent, /Agentic Control Pane/);
  const filter = query("[data-tg-find]");
  assert.equal(filter.getAttribute("aria-controls"), "fr-body-agents");
  assert.equal(filter.title, "Filter threads (/)");
  assert.ok(!query("[data-switch], [data-fr=launchpad]"), "the panel omits unrelated controls");
  assert.deepEqual(Array.from(stage.querySelectorAll(".fr[data-fr]"), (frame) => frame.dataset.fr),
    ["agents", "changes", "map"]);
  assert.deepEqual(Array.from(stage.querySelectorAll("[data-gut]"), (handle) => handle.dataset.gut),
    ["agents|changes", "changes|map"]);
  assert.equal(query("[data-fr-fold=map]").getAttribute("aria-expanded"), "false");
  assert.equal(query("[data-map-mode=graph]").getAttribute("aria-selected"), "true");
  assert.equal(query("[data-tg-fold=done]").getAttribute("aria-expanded"), "false");

  const count = query("[data-fr-n=agents]");
  assert.equal(count.textContent, String(threadCounts("p", needs).all));
  const mutations = new window.MutationObserver(() => {});
  mutations.observe(count, { childList: true, characterData: true, subtree: true });
  panel.sync();
  assert.equal(mutations.takeRecords().length, 0, "an unchanged count does not rewrite the DOM");
  mutations.disconnect();
  assert.deepEqual(panelThreads("p:p").map(({ k, rows }) => [k, rows.map(({ go }) => go)]), [
    ["needs", ["t:a"]], ["working", ["p:p"]], ["waiting", ["t:e"]], ["done", ["t:c", "t:b"]],
  ]);

  assert.ok(!query('[data-go="t:c"]'), "finished threads stay folded initially");
  const row = query('.tg-box [data-go="t:a"]');
  assert.ok(row.querySelector(".ag-tm .ag-when + .ag-mk .agm"));
  assert.ok(!row.querySelector(".ag-t .agm"), "the agent mark does not occupy the title column");
  filter.click();
  const field = query("[data-tg-q]");
  assert.ok(document.activeElement === field, "opening the thread filter focuses its field");
  field.value = "e";
  field.dispatchEvent(new window.Event("input", { bubbles: true }));
  assert.ok(query('.tg-box [data-go="t:e"]'));
  field.value = "";
  field.dispatchEvent(new window.Event("input", { bubbles: true }));

  query("[data-fr-fold=agents]").click();
  panel.show("files");
  panel.threads();
  assert.equal(stage.dataset.stgPage, undefined);
  assert.equal(query("[data-fr-fold=agents]").getAttribute("aria-expanded"), "true");
  assert.ok(document.activeElement === query(".tg-box [data-go]"), "opening Threads focuses the first thread row");
  assert.ok(query("[data-fr=agents]").classList.contains("is-flash"));
});

test("a first change reopens a folded Changes frame", async () => {
  const { panel, stage, change } = await stageFixture();
  panel.open();
  const fold = stage.querySelector("[data-fr-fold=changes]");
  fold.click();
  assert.equal(fold.getAttribute("aria-expanded"), "false");
  change([{ path: "src/file.js", rel: "file.js", project: "p", who: "Agent", mark: "edit" }]);
  assert.equal(fold.getAttribute("aria-expanded"), "true");
});

test("waiting and done show the first five while active groups show all entries", async () => {
  const { threadsHtml } = await import("../shell/panel/lists.js");
  const { document } = await stageFixture();
  const host = document.createElement("div");
  for (const key of ["needs", "working", "waiting", "done"]) {
    const rows = Array.from({ length: 7 }, (_, i) => ({ go: "t:" + i, title: "Thread " + i, state: key, word: key }));
    host.innerHTML = threadsHtml([{ k: key, word: key, rows }], "", { folds: {}, more: {} });
    const limited = key === "waiting" || key === "done";
    assert.equal(host.querySelectorAll("[data-go]").length, limited ? 5 : 7);
    assert.equal(Boolean(host.querySelector("[data-tg-more]")), limited);
  }
});

test("thread marks and controls use shared size tokens", () => {
  const selector = (row) => row.context.at(-1)?.selector ?? "";
  const sizes = stylesheetRows.filter((row) =>
    /(?:\.th-ctl\b|\.stage \.tg-)/.test(selector(row)) && row.property);
  assert.ok(sizes.length > 20);
  assert.deepEqual(sizes.filter((row) => /\b\d+(?:\.\d+)?(?:px|rem|ms)\b/.test(row.value.replace(/\b1px solid\b/g, ""))), []);
  assert.equal(tokenValuesFor().get("--mark-sm"), "var(--s-3)");
  assert.deepEqual(valuesFor(".stage .ag-mk .agm", "width"), ["12px"]);
  assert.deepEqual(valuesFor(".stage .ag-mk .agm", "height"), ["12px"]);
});

test("on Chats the panel lists your chats in place of Threads, with no Changes, Map, files or shell", async () => {
  const rows = [{ go: "c:one", title: "Plan the trip", state: "recent", word: "Idle", sub: "Opus", at: "9:00", icon: '<span class="agm"></span>' }];
  const chats = { is: (/** @type {string} */ v) => v === "chats" || v.startsWith("c:"), groups: () => [{ k: "recent", word: "Recent", rows }], note: () => "" };
  const { panel, stage, visit } = await stageFixture({ place: (v) => /^(?:ws$|chats$|[pc]:)/.test(v), threads: () => panelThreads("p:p"), chats });
  const query = (/** @type {string} */ selector) => /** @type {HTMLElement} */ (stage.querySelector(selector));
  const shown = () => Array.from(stage.querySelectorAll(".fr[data-fr]")).filter((frame) => !frame.hasAttribute("hidden")).map((frame) => frame.getAttribute("data-fr"));
  visit("chats");
  panel.open();
  assert.match(query("#fr-title-agents").textContent, /^Chats1$/);
  assert.deepEqual(shown(), ["agents"]);
  assert.equal(query("[data-tg-find]").title, "Filter chats (/)");
  assert.equal(query("[data-tg-q]").getAttribute("placeholder"), "Filter chats");
  assert.equal(query("[data-open-files]").hidden, true);
  assert.equal(query("[data-stg-shell]").hidden, true);
  assert.ok(query('.tg-box [data-go="c:one"] .agm'), "a chat's row carries its agent's mark");
  visit("p:p");
  assert.match(query("#fr-title-agents").textContent, /^Threads4$/);
  assert.deepEqual(shown(), ["agents", "changes", "map"]);
  assert.equal(query("[data-open-files]").hidden, false);
  visit("c:one");
  assert.match(query("#fr-title-agents").textContent, /^Chats1$/);
  visit("ws");
  assert.match(query("#fr-title-agents").textContent, /^Threads/, "the Workspace's panel lists threads, not your chats");
  assert.ok(!query('.tg-box [data-go="c:one"]'));
});
