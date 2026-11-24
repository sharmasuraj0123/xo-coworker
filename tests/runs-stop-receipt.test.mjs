// What a sub-agent Stop's answer says is only what it confirms, said in the Runs sheet where you acted as well as in
// the notice, with focus kept on the Stop (the create-project grader on 2a8d278, S100/S101/S239, runs-stop):
// - an answer that confirms no stop ({}, {ok:false}, {stopping:null}) said "Stopping";
// - Stop all's [] said "already finished", but stop_all also answers [] when no live process runs them;
// - a refusal (503) was said only in #herald, behind the open sheet;
// - after the answer focus went to the sheet, though its Stop was still there;
// - the Undo inside its line: 6 px corners in a 6 px line, insets 3 and 4 (never concentric).
//   node tests/runs-stop-receipt.test.mjs
import assert from "node:assert/strict";
import { mock } from "node:test";
import { resolveTokens } from "./lib/tokens.mjs";
import { readFileSync } from "node:fs";
import { deferred, dom } from "./lib/dom.mjs";
import { createRunsPanel } from "../modules/runs/panel.js";
import { createRunsStop } from "../modules/runs/stop.js";

const view = readFileSync(new URL("../modules/runs/view.js", import.meta.url), "utf8");
const css = resolveTokens(readFileSync(new URL("../css/app.css", import.meta.url), "utf8"));
let passed = 0;
const t = (name, fn) => { try { fn(); passed++; console.log("  ok  " + name); } catch (e) { console.error("  FAIL " + name + "\n" + e.message); process.exitCode = 1; } };

function stopFixture() {
  const state = { open: true, session: "team", said: null };
  const pendingStops = [], stopsOut = new Set(), notices = [], reads = [];
  const stop = createRunsStop(state, {
    pendingStops, stopsOut, commitMs: 3000,
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
    assert.equal(pendingStops.length, 1);
    assert.equal(sends, 0);
  });
  mock.timers.tick(1);
  stop("Helper", request, "run:a");
  mock.timers.tick(3000);
  t("once sent, the stop stays busy and ignores repeats until its reply", () => {
    assert.equal(pendingStops.length, 0);
    assert.equal(sends, 1);
    assert.equal(stopsOut.has("run:a"), true);
    assert.equal(state.said?.text, "Sending the stop…");
  });
  response.resolve({ stopping: true });
  await Promise.resolve();
  assert.equal(stopsOut.has("run:a"), false);

  stop("Another helper", request, "run:b");
  pendingStops[0].cancelled = true;
  mock.timers.tick(3000);
  t("an undone stop never sends its request", () => {
    assert.equal(pendingStops.length, 0);
    assert.equal(sends, 1);
  });
} finally {
  mock.timers.reset();
}

t("it's said in the page, where you acted, as well as in the notice", () => {
  assert.match(view, /export function saidHtml\(said, key\)/);
  assert.match(view, /role="\$\{said\.kind === "halt" \? "status" : "alert"\}"/);
  assert.match(view, /saidHtml\(o\.saidFor, `run:\$\{r\.id\}`\)/, "a run's own Stop: under its row");
  assert.match(view, /saidHtml\(saidFor, `all:/, "Stop all: at the top of the list");
});
t("the Undo in its line: an even 2 px inset, and the line's corners its own plus the inset (6 + 2 = 8)", () => {
  assert.match(css, /\.rn-stopping\{[^}]*padding:2px 2px 2px 12px;[^}]*border-radius:var\(--r\);/);
  assert.match(css, /\.rn-stopping>\.t-undo\{height:36px\}/);
});
t("a stop on its way: the sheet renders its busy state", () => {
  assert.match(view, /const busy = out\.includes\(`run:\$\{r\.id\}`\);/);
  assert.match(view, /\$\{busy \? ' aria-busy="true" aria-disabled="true"' : ""\}>\$\{ICON\.stop\}<span>\$\{busy \? "Stopping…" : "Stop"\}<\/span>/);
  assert.match(view, /out\.includes\(`all:\$\{session\}`\)/, "Stop all too");
});
{
  const { document } = await dom('<section id="runs"></section>');
  const panel = document.getElementById("runs");
  const key = "run:agent";
  const runs = [{ id: "agent", kind: "subagent", state: "running", title: "Read the list" }];
  const RS = { open: true, view: "list", session: "team", listState: "loading", tree: runs, said: null };
  const pendingStops = [], stopsOut = new Set();
  const { runsRender, runsLand } = createRunsPanel({ RS, S: { tbOpen: {} }, world: { act: { feature: () => true } },
    runsCard: panel, pendingStops, stopsOut, STAGE: {}, placeRegion: () => panel, threadScroller: () => undefined });
  runsRender();
  assert.match(panel.querySelector("[role=status]").textContent, /Reading its sub-agents/);
  RS.listState = "ok";
  pendingStops.push({ key, what: "Read the list", session: "team" });
  runsRender();
  const undo = panel.querySelector("[data-runs-undo]");
  assert.equal(undo.dataset.runsUndo, key);
  assert.equal(undo.textContent, "Undo");
  const stop = panel.querySelector("[data-run-stop]");
  stop.focus();
  pendingStops.length = 0;
  stopsOut.add(key);
  RS.said = { key, kind: "halt", text: "Sending the stop…" };
  runsRender();
  const run = panel.querySelector(".rn-row");
  assert.equal(run.querySelector("[data-run-stop]").getAttribute("aria-busy"), "true");
  assert.match(run.querySelector("[role=status]").textContent, /Sending the stop/);
  assert.ok(document.activeElement === run.querySelector("[data-run-stop]"), "a busy redraw keeps the Stop control in focus");
  stopsOut.clear();
  RS.said = { key, kind: "stopped", text: "Not confirmed", sub: "Stop again if it keeps working." };
  runsRender();
  assert.equal(panel.querySelector("[data-run-stop]").hasAttribute("aria-busy"), false);
  assert.match(panel.querySelector(".rn-row [role=alert]").textContent, /Not confirmed.*Stop again/);
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
