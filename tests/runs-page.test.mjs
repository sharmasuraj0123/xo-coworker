import assert from "node:assert/strict";
import { deferred, dom, same } from "./lib/dom.mjs";
import { readFileSync } from "node:fs";
import { createRunsOpener } from "../modules/runs/controller.js";
import { createRunsPanel } from "../modules/runs/panel.js";

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), "utf8");
const app = read("js/app.js"), view = read("modules/runs/view.js"), html = read("index.html"), css = read("css/app.css");
const panelSource = read("modules/runs/panel.js");
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };
const fn = (src, name) => { const i = src.indexOf(name); assert.ok(i >= 0, name); return src.slice(i, src.indexOf("\n}\n", i)); };

{
  const { document, window } = await dom('<main id="main"><div id="conv"></div></main><div id="dock"></div><div id="side"></div><div id="side-scrim"></div><div id="settings"></div><div id="viewer"></div><div id="pn-stage"></div><div id="pn-foot"></div><div id="all-list"></div><div id="scroller"><div id="msgs"></div></div><div id="runs-card"></div>');
  globalThis.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
  globalThis.getSelection = () => null;
  globalThis.innerWidth = 400;
  const { wireGestures } = await import("../js/gestures.js");
  const conv = document.getElementById("conv"), runsCard = document.getElementById("runs-card");
  Object.defineProperty(runsCard, "offsetWidth", { value: 400 });
  const calls = [];
  let runsDeep = false;
  wireGestures({
    view: () => "t:thread", phone: () => true, overlay: () => false,
    back: () => calls.push("thread"), runsBack: () => calls.push("runs"),
    runsCard, runsDeep: () => runsDeep, sheets: [],
  });
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
}

t("no sheet: the page's content is built once and mounted in the panel's page box", () => {
  assert.doesNotMatch(html, /id="runs"|id="runs-card"/);
  assert.doesNotMatch(app, /runsEl\b/);
  assert.doesNotMatch(css, /\.runs-card\b|\.rn-h\b|\.rn-back\b|\.rn-foot\b/);
  assert.match(app, /STAGE\.page\("runs", \{\n\s*over: true,/);
  assert.match(app, /mount: \(box\) => box\.append\(runsCard\),/);
});
{
  const { document } = await dom('<section id="runs"></section>');
  const runsCard = document.getElementById("runs");
  const RS = { open: true, view: "run", runId: "agent", session: "team", gen: 1, tree: [{ id: "agent", kind: "subagent", state: "running", title: "Agent" }] };
  const calls = [];
  const STAGE = { pageShown: { name: "runs" }, repaint: () => calls.push("repaint"), close: (options) => calls.push(options) };
  const { runsEscape } = createRunsPanel({ RS, STAGE, runsCard, S: { tbOpen: {} }, world: { act: {} }, pendingStops: [], stopsOut: new Set() });
  t("Runs steps back to the focused agent, then to the thread", () => {
    runsEscape();
    assert.equal(RS.view, "list");
    same(document.activeElement, runsCard.querySelector('[data-run="agent"]'));
    runsEscape();
    assert.deepEqual(calls, ["repaint", { restore: false }]);
  });
}
t("from the main chat the panel opens for it and closes with it; from the panel it steps back to the thread page", () => {
  assert.match(panelSource, /if \(!RS\.panelWas && STAGE\.pageShown\?\.name === "runs"\) STAGE\.close\(\{ restore: false \}\); else STAGE\.closePage\("runs"\);/);
  assert.match(app, /backTo: \(\) => \(RS\.view === "run" \? "Sub-agents" : RS\.panelWas \|\| STAGE\.pageShown\?\.name !== "runs" \? "" : "the thread"\),/);
});
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
t("focus goes back to what opened it only when it was in the page; a page that moved focus keeps it there", () => {
  const g = panelSource.slice(panelSource.indexOf("function runsGone()"));
  assert.match(g, /const here = runsCard\.contains\(document\.activeElement\) \|\| STAGE\.owns\(document\.activeElement\);/);
  assert.match(g, /RS\.refocus = here \? to : null;\n\s*if \(here\) to\(\);/);
  assert.match(panelSource, /if \(!a \|\| a === document\.body\) RS\.refocus\?\.\(\);/, "a phone's panel gone, then focus");
});
t("agents first, live then newest; every command at any depth in one Commands group, 8 then Show more", () => {
  assert.match(view, /agents: \(nodes \|\| \[\]\)\.filter\(\(r\) => !isCmd\(r\)\)\.sort\(newest\), cmds: all\.filter\(isCmd\)\.sort\(newest\)/);
  assert.match(view, /const open = o\.cmdsOpen !== false, max = o\.cmdsAll \? cmds\.length : 8;/);
  assert.match(view, /data-runs-cmds aria-expanded="\$\{open\}"/);
  assert.match(app, /if \(e\.target\.closest\("\[data-runs-more\]"\)\) \{ RS\.cmdsAll = true;/);
});
t("a run's page: its kind and title, State Steps Tokens Time, its result, then its work; a lost record said quietly", () => {
  const r = fn(view, "export function runViewHtml(");
  assert.match(r, /\["State", /);
  assert.match(r, /!cmd && \["Steps", /);
  assert.match(r, /Its step-by-step record is no longer kept/);
  assert.doesNotMatch(r, /data-close|data-runs-back|rn-foot/);
});
console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
