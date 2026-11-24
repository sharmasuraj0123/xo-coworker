import assert from "node:assert/strict";
import { deferred, dom, same } from "./lib/dom.mjs";
import { createRunsOpener } from "../modules/runs/controller.js";
import { createRunsPanel } from "../modules/runs/panel.js";
import { createRunsEscape } from "../modules/runs/escape.js";
import { createPendingRunStops } from "../core/services/run-stops.js";
import { createScope } from "../core/kernel/scope.js";
import { runsListHtml, runViewHtml } from "../modules/runs/view.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

{
  const { document, window } = await dom('<main id="main"><div id="conv"></div></main><div id="dock"></div><div id="side"></div><div id="side-scrim"></div><div id="settings"></div><div id="viewer"></div><div id="pn-stage"></div><div id="pn-foot"></div><div id="all-list"></div><div id="scroller"><div id="msgs"></div></div><div id="runs-card"></div>');
  globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  globalThis.getSelection = () => null;
  globalThis.innerWidth = 400;
  const { wireGestures } = await import("../shell/gestures.js");
  const { wordsOf } = await import("../modules/conversation/words.js");
  const conv = document.getElementById("conv"), runsCard = document.getElementById("runs-card");
  Object.defineProperty(runsCard, "offsetWidth", { value: 400 });
  const calls = [];
  const scope = createScope();
  let runsDeep = false;
  wireGestures({
    view: () => "t:thread", phone: () => true, overlay: () => false,
    back: () => calls.push("thread"), runsBack: () => calls.push("runs"),
    runsCard, runsDeep: () => runsDeep, sheets: [],
  }, wordsOf, scope);
  const swipe = async (target, distance) => {
    const send = (type, clientX, timeStamp) => {
      const event = new window.Event(type, { bubbles: true, cancelable: true });
      const touch = { identifier: 1, clientX, clientY: 30 };
      Object.defineProperties(event, {
        touches: { value: type === "touchend" ? [] : [touch] },
        changedTouches: { value: [touch] },
        timeStamp: { value: timeStamp },
      });
      target.dispatchEvent(event);
    };
    const settled = new Promise((resolve) => document.addEventListener("xo:gesture", resolve, { once: true }));
    send("touchstart", 40, 0);
    send("touchmove", 40 + distance, 100);
    send("touchend", 40 + distance, 200);
    await settled;
  };
  await swipe(conv, 60);
  assert.deepEqual(calls, []);
  await swipe(conv, 180);
  assert.deepEqual(calls, ["thread"]);
  runsDeep = true;
  await swipe(runsCard, 180);
  assert.deepEqual(calls, ["thread", "runs"]);
  assert.equal(conv.classList.contains("is-swiped"), false);
  scope.dispose();
}

{
  const { document } = await dom('<section id="runs"></section>');
  const runsCard = document.getElementById("runs");
  const RS = { open: true, view: "run", runId: "agent", session: "team", gen: 1, tree: [{ id: "agent", kind: "subagent", state: "running", title: "Agent" }] };
  const calls = [];
  const STAGE = { pageShown: { name: "runs" }, repaint: () => calls.push("repaint"), close: (options) => calls.push(options) };
  const actions = createRunsPanel({ RS, STAGE, runsCard, transcriptOpen: () => ({}), world: { act: {} },
    pendingStops: createPendingRunStops(), stopsOut: new Set() });
  const runsEscape = createRunsEscape({ RS, ...actions, repaint: () => STAGE.repaint() });
  t("Runs steps back to the focused agent, then to the thread", () => {
    runsEscape();
    assert.equal(RS.view, "list");
    same(document.activeElement, runsCard.querySelector('[data-run="agent"]'));
    runsEscape();
    assert.deepEqual(calls, ["repaint", { restore: false }]);
  });
}
{
  const { document } = await dom('<header><button id="open">Sub-agents</button></header><div id="runs" hidden><button id="row">Run</button></div>');
  const opener = document.getElementById("open"), panel = document.getElementById("runs"), row = document.getElementById("row");
  opener.focus();
  const state = { open: false, opening: 0, session: "previous", tree: [{ id: "old" }], counts: { running: 1 }, said: { key: "old" }, returnTo: null };
  const first = deferred(), second = deferred(), reads = [], opened = [], shown = [];
  const answers = [first.promise, second.promise];
  let acceptsPage = false, stageWasOpen = true, nextRead = 0;
  const openRuns = createRunsOpener(state, {
    STAGE: { get isOpen() { return stageWasOpen; }, show(name, key) { shown.push([name, key]); return acceptsPage; } },
    headFor: (el) => el.closest("header"),
    readRunsList: (key, opening) => {
      reads.push([key, opening]);
      return acceptsPage ? answers[nextRead++] : Promise.resolve(false);
    },
    openRun: async (id) => { opened.push(id); },
    runsRender: () => { panel.hidden = false; },
    runsLand: () => row,
  });
  const thread = { sessionId: "session", title: "Team" };
  await openRuns(thread);
  t("a refused Runs page does not start a read", () => {
    assert.equal(state.open, false);
    assert.deepEqual(reads, []);
    same(document.activeElement, opener);
  });
  acceptsPage = true;
  const former = openRuns(thread, "old");
  stageWasOpen = false;
  const current = openRuns(thread);
  first.resolve(true);
  await former;
  t("a superseded opening cannot show its run or move focus", () => {
    assert.deepEqual(opened, []);
    assert.equal(panel.hidden, true);
    same(document.activeElement, opener);
  });
  second.resolve(true);
  await current;
  t("the current opening focuses its Runs row and remembers the panel under it", () => {
    assert.deepEqual(shown, Array(3).fill(["runs", "session"]));
    assert.deepEqual(reads, [["session", 2], ["session", 3]]);
    assert.equal(state.panelWas, true);
    assert.deepEqual(state.tree, []);
    assert.equal(state.counts, null);
    assert.equal(state.said, null);
    same(state.returnTo, opener);
    same(state.head, opener.closest("header"));
    same(document.activeElement, row);
  });
}
{
  const { document } = await dom('<header id="head"><button data-runs>Sub-agents</button></header>'
    + '<section id="runs"><button>Run</button></section><button id="outside">Outside</button>');
  const runsCard = document.querySelector("#runs");
  const opener = document.querySelector("[data-runs]");
  const outside = document.querySelector("#outside");
  const RS = { open: true, gen: 0, head: opener.parentElement, returnTo: opener };
  const closed = [];
  const STAGE = {
    pageShown: { name: "runs" },
    owns: (node) => runsCard.contains(node),
    close(options) {
      closed.push(options);
      actions.runsGone();
      document.activeElement.blur();
    },
    closePage(name) { closed.push(name); actions.runsGone(); },
  };
  const actions = createRunsPanel({
    RS, STAGE, runsCard, transcriptOpen: () => ({}), world: { act: {} }, pendingStops: createPendingRunStops(),
    stopsOut: new Set(), placeRegion: () => outside, threadScroller: () => undefined,
  });
  t("closing a Runs page restores focus after its covering panel closes", () => {
    runsCard.querySelector("button").focus();
    actions.closeRuns();
    assert.deepEqual(closed, [{ restore: false }]);
    same(document.activeElement, opener);
  });
  t("closing nested Runs preserves focus when it already moved to another part of the UI", () => {
    Object.assign(RS, { open: true, panelWas: true, returnTo: opener });
    outside.focus();
    actions.closeRuns();
    assert.deepEqual(closed, [{ restore: false }, "runs"]);
    same(document.activeElement, outside);
  });
}
{
  const { document } = await dom('<div id="view"></div>');
  const box = document.querySelector("#view");
  const command = { id: "nested", title: "Run checks", kind: "background_command", state: "running" };
  const worker = { id: "worker", title: "Read the patch", kind: "subagent", state: "running", children: [command] };
  const finished = { id: "finished", title: "Summarize", kind: "subagent", state: "finished", started_at: "2026-01-02" };
  const newest = { ...finished, id: "newest", started_at: "2026-01-03" };
  t("Runs orders live agents first and flattens commands from inside agents", () => {
    box.innerHTML = runsListHtml([finished, newest, worker], null, { canStop: false });
    assert.deepEqual([...box.querySelectorAll(".rn-list [data-run]")].map(({ dataset }) => dataset.run), ["worker", "newest", "finished"]);
    assert.deepEqual([...box.querySelectorAll(".rn-cmds [data-run]")].map(({ dataset }) => dataset.run), ["nested"]);
    assert.equal(box.querySelector("[data-runs-cmds]").getAttribute("aria-expanded"), "true");
  });
  t("run detail shows its result and the reason its transcript is unavailable", () => {
    box.innerHTML = runViewHtml({ ...finished, summary: "Prepared a checklist" }, { items: [], canStop: false, gone: "Pruned" });
    assert.equal(box.querySelector(".rn-hero h3").textContent, "Summarize");
    assert.deepEqual([...box.querySelectorAll(".rn-tiles dt")].map(({ textContent }) => textContent), ["State", "Steps", "Tokens", "Time"]);
    assert.equal(box.querySelector(".rn-result p").textContent, "Prepared a checklist");
    assert.match(box.querySelector(".rn-work > .rn-note").textContent, /step-by-step record is no longer kept/);
    assert.equal(box.querySelector("[data-close], [data-runs-back], .rn-foot") === null, true);
    box.innerHTML = runViewHtml(command, { items: [], canStop: false });
    assert.deepEqual([...box.querySelectorAll(".rn-tiles dt")].map(({ textContent }) => textContent), ["State", "Time"]);
  });
}
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
