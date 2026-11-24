// @ts-check
import assert from "node:assert/strict";
import { mock } from "node:test";
import { context } from "./lib/cascade.mjs";
import { publishedRules, resolveValue } from "./lib/css-snapshot.mjs";
import { deferred, dom } from "./lib/dom.mjs";
import { createRunsPanel } from "../modules/runs/panel.js";
import { createRunsPage } from "../modules/runs/page.js";
import { createPendingRunStops } from "../core/services/run-stops.js";
import { createRunsStop } from "../modules/runs/stop.js";
import { createScope } from "../core/kernel/scope.js";

let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

function stopFixture() {
  const state = { open: true, session: "team", said: null };
  const pendingStops = createPendingRunStops(), stopsOut = new Set(), notices = [], reads = [];
  const stop = createRunsStop(state, {
    pendingStops, stopsOut, commitMs: 3000, scope: createScope(),
    heraldShow: (notice) => notices.push(notice),
    readRunsList: async (session) => { reads.push(session); return true; },
    stopsHerald() {}, runsRender() {}, announce() {},
  });
  return { state, pendingStops, stopsOut, notices, reads, stop };
}

mock.timers.enable({ apis: ["setTimeout"] });
try {
  const cases = [
    ["run:a", { stopping: true }, "Stopping"],
    ["run:a", { stopping: false }, "It had already finished"],
    ["run:a", { stopping: ["a"] }, "Not confirmed"],
    ["run:a", {}, "Not confirmed"],
    ["all:team", { stopping: ["a"] }, "Stopping"],
    ["all:team", { stopping: [] }, "No stop went out"],
    ["all:team", { stopping: false }, "Not confirmed"],
  ];
  for (const [key, reply, expected] of cases) {
    const { state, notices, reads, stop } = stopFixture();
    stop("Helper", async () => reply, key);
    mock.timers.tick(3000);
    await Promise.resolve();
    t(`stop receipt for ${key} and ${JSON.stringify(reply)}`, () => {
      assert.equal(state.said?.key, key);
      assert.equal(state.said?.text, expected);
      assert.equal(notices[0]?.text, expected);
      assert.deepEqual(reads, ["team"]);
    });
  }

  const { state, pendingStops, stopsOut, stop } = stopFixture();
  const response = deferred();
  let sends = 0;
  const request = () => { sends++; return response.promise; };
  stop("Helper", request, "run:a");
  stop("Helper", request, "run:a");
  mock.timers.tick(2999);
  t("a pending stop allows one Undo and sends nothing before it expires", () => {
    assert.equal(pendingStops.pending().length, 1);
    assert.equal(sends, 0);
  });
  mock.timers.tick(1);
  stop("Helper", request, "run:a");
  mock.timers.tick(3000);
  t("once sent, the stop stays busy and ignores repeats until its reply", () => {
    assert.equal(pendingStops.pending().length, 0);
    assert.equal(sends, 1);
    assert.equal(stopsOut.has("run:a"), true);
    assert.equal(state.said?.text, "Sending the stop…");
  });
  response.resolve({ stopping: true });
  await Promise.resolve();
  assert.equal(stopsOut.has("run:a"), false);

  stop("Another helper", request, "run:b");
  pendingStops.undo("run:b");
  mock.timers.tick(3000);
  t("an undone stop never sends its request", () => {
    assert.equal(pendingStops.pending().length, 0);
    assert.equal(sends, 1);
  });

  stop("Helper", request, "run:b");
  mock.timers.tick(1000);
  pendingStops.undo("run:b");
  stop("Helper", request, "run:b");
  mock.timers.tick(2000);
  t("the undone job's timer cannot claim its replacement", () => {
    assert.equal(pendingStops.pending().length, 1);
    assert.equal(sends, 1);
  });
  mock.timers.tick(1000);
  await Promise.resolve();
  assert.equal(sends, 2);
} finally {
  mock.timers.reset();
}

{
  const { document } = await dom('<section id="runs"></section>');
  const host = document.querySelector("#runs");
  const response = deferred();
  const notices = [];
  const pendingStops = createPendingRunStops();
  const run = { id: "agent", state: "running", kind: "subagent", title: "Read the list" };
  let posts = 0;
  let listReads = 0;
  let mountPage = () => {};
  const page = createRunsPage({
    stage: {
      isOpen: false,
      page(_name, surface) { mountPage = () => surface.mount(host); },
      show() { mountPage(); return true; },
    },
    world: {
      state: { runs: new Map([[run.id, run]]) },
      act: {
        feature: () => true,
        async listRuns() { listReads++; return { runs: [run] }; },
        stopRun() { posts++; return response.promise; },
      },
    },
    transcript: { open: () => ({}), toggle() {} },
    headFor: () => null,
    pendingStops,
    stopsHerald() {},
    announce() {},
    heraldShow: (notice) => notices.push(notice),
    commitMs: 3000,
  });
  await page.open({ sessionId: "team", title: "Team" });
  mock.timers.enable({ apis: ["setTimeout"] });
  try {
    host.querySelector("[data-run-stop]").click();
    mock.timers.tick(3000);
    assert.equal(posts, 1);
    page.dispose();
    response.resolve({ stopping: true });
    await Promise.resolve();
    t("a mounted Runs page ignores a Stop receipt after disposal", () => {
      assert.deepEqual(notices, []);
      assert.equal(listReads, 1);
      assert.equal(page.isOpen, false);
    });
  } finally {
    mock.timers.reset();
  }
}

t("the pending stop reserves the same inset above, below, and after Undo", () => {
  const styles = publishedRules().filter((rule) => context(rule, 1440).active);
  const values = (selector) => Object.fromEntries(styles.filter((rule) => rule.sel === selector)
    .flatMap(({ declarations }) => declarations).map(({ p, v }) => [p, resolveValue(v)]));
  assert.equal(values(".rn-stopping").padding, "2px 2px 2px 12px");
  assert.equal(values(".rn-stopping")["border-radius"], "8px");
  assert.equal(values(".rn-stopping>.t-undo").height, "36px");
});
{
  const { document } = await dom('<section id="runs"></section>');
  const panel = document.getElementById("runs");
  const key = "run:agent";
  const runs = [{ id: "agent", kind: "subagent", state: "running", title: "Read the list" }];
  const RS = { open: true, view: "list", session: "team", listState: "loading", tree: runs, said: null };
  const pendingStops = createPendingRunStops(), stopsOut = new Set();
  const { runsRender, runsLand } = createRunsPanel({ RS, transcriptOpen: () => ({}), world: { act: { feature: () => true } },
    runsCard: panel, pendingStops, stopsOut, STAGE: {}, placeRegion: () => panel, threadScroller: () => undefined });
  runsRender();
  assert.match(panel.querySelector("[role=status]").textContent, /Reading its sub-agents/);
  RS.listState = "ok";
  pendingStops.add({ key, what: "Read the list", session: "team", until: Date.now() });
  runsRender();
  const undo = panel.querySelector("[data-runs-undo]");
  assert.equal(undo.dataset.runsUndo, key);
  assert.equal(undo.textContent, "Undo");
  const stop = panel.querySelector("[data-run-stop]");
  stop.focus();
  pendingStops.undo(key);
  stopsOut.add(key);
  RS.said = { key, kind: "halt", text: "Sending the stop…" };
  runsRender();
  const run = panel.querySelector(".rn-row");
  assert.equal(run.querySelector("[data-run-stop]").getAttribute("aria-busy"), "true");
  assert.equal(run.querySelector("[data-run-stop]").getAttribute("aria-disabled"), "true");
  assert.equal(run.querySelector("[data-run-stop]").textContent.trim(), "Stopping…");
  assert.match(run.querySelector("[role=status]").textContent, /Sending the stop/);
  assert.ok(document.activeElement === run.querySelector("[data-run-stop]"), "a busy redraw keeps the Stop control in focus");
  stopsOut.clear();
  RS.said = { key, kind: "stopped", text: "Not confirmed", sub: "Stop again if it keeps working." };
  runsRender();
  assert.equal(panel.querySelector("[data-run-stop]").hasAttribute("aria-busy"), false);
  assert.match(panel.querySelector(".rn-row [role=alert]").textContent, /Not confirmed.*Stop again/);
  const all = "all:team";
  RS.tree = [...runs, { id: "other", kind: "subagent", state: "running", title: "Read another list" }];
  stopsOut.add(all);
  RS.said = { key: all, kind: "halt", text: "Sending the stop…" };
  runsRender();
  const stopAll = panel.querySelector("[data-runs-stop]");
  assert.equal(stopAll?.getAttribute("aria-busy"), "true");
  assert.equal(stopAll?.getAttribute("aria-disabled"), "true");
  assert.match(panel.querySelector("[role=status]")?.textContent ?? "", /Sending the stop/);
  assert.equal(panel.querySelector(".rn-row [role=status]") === null, true);
  stopsOut.clear();
  const opener = runsLand();
  const alternate = document.createElement("a");
  alternate.setAttribute("data-run", "agent");
  opener.replaceWith(alternate);
  alternate.focus();
  RS.said = null;
  runsRender();
  assert.ok(document.activeElement === runsLand(), "a replaced control is found by the same hook");
  RS.tree = [];
  runsRender();
  assert.ok(document.activeElement === panel, "focus returns to the page if the control is gone");
}

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
