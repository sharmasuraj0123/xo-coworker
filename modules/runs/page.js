// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { createRunsOpener } from "./controller.js";
import { createRunsEscape } from "./escape.js";
import { createRunsPanel } from "./panel.js";
import { createRunsReads } from "./read.js";
import { createRunsStop } from "./stop.js";
import { RUN_COMMAND_LIMIT, isCommandRun } from "./view.js";

/** @import {RunsPageDeps} from "./page-types.d.ts" */

/** @param {RunsPageDeps} options */
export function createRunsPage({
  stage, world, headFor, placeRegion, threadScroller, transcript, pendingStops, stopsHerald, announce, heraldShow, commitMs,
}) {
  const scope = createScope();
  const runsCard = document.createElement("div");
  Object.assign(runsCard, { id: "runs-card", className: "runs-pg", tabIndex: -1 });
  runsCard.setAttribute("role", "region");
  runsCard.setAttribute("aria-label", "Sub-agents");
  /** @type {import("./panel-types.d.ts").RunsPanelDeps["RS"]} */
  const RS = {
    cmdsOpen: true, cmdsAll: false, said: null, gen: 0, opening: 0, open: false, session: null,
    title: "", view: "list", tree: [], counts: null, runId: null, run: null, anc: null, items: [],
    cursor: null, children: [], loading: false, error: null, gone: null, returnTo: null,
  };
  const stopsOut = new Set();
  const { runsRender, runsLand, closeRuns, runsGone } = createRunsPanel({
    RS, transcriptOpen: transcript.open, world, STAGE: stage, runsCard, pendingStops, stopsOut, placeRegion, threadScroller,
  });
  const { readRunsList, openRun, cancelDetail, cancelList } = createRunsReads({
    RS, world, STAGE: stage, runsRender, scope,
  });
  const runsEscape = createRunsEscape({ RS, closeRuns, runsRender, repaint: () => stage.repaint(), runsLand, cancelDetail });
  const open = createRunsOpener(RS, { STAGE: stage, headFor, readRunsList, openRun, runsRender, runsLand });
  const stop = createRunsStop(RS, {
    pendingStops, stopsOut, stopsHerald, runsRender, announce, heraldShow, commitMs,
    readRunsList: (session) => session ? readRunsList(session) : Promise.resolve(false), scope,
  });

  stage.page("runs", {
    over: true,
    title: () => RS.view === "list" ? "Sub-agents" : RS.run && isCommandRun(RS.run) ? "Command" : "Sub-agent",
    backTo: () => RS.view === "run" ? "Sub-agents" : RS.panelWas || stage.pageShown?.name !== "runs" ? "" : "the thread",
    mount: (box) => box.append(runsCard),
    onShow: (_key, { focus }) => { runsRender(); if (focus) runsCard.focus({ preventScroll: true }); },
    close() { cancelList(); cancelDetail(); runsGone(); },
    up: () => { runsEscape(); return true; },
    escape: () => { runsEscape(); return true; },
  });

  async function retry() {
    if (!RS.session) return;
    const opening = ++RS.opening;
    RS.listState = "loading";
    runsRender();
    if (!await readRunsList(RS.session, opening)) return;
    runsRender();
    runsLand()?.focus({ preventScroll: true });
  }

  /** @param {string} key */
  function undo(key) {
    const job = pendingStops.undo(key);
    if (job) {
      stopsHerald();
      announce(`Not stopped. ${job.what} keeps working.`);
    }
    const back = job?.key.startsWith("run:") ? `[data-run-stop="${CSS.escape(job.key.slice(4))}"]` : "[data-runs-stop]";
    runsRender();
    runsLand(back)?.focus({ preventScroll: true });
  }

  scope.listen(runsCard, "click", ({ target }) => {
    if (!(target instanceof Element)) return;
    if (target.closest("[data-runs-cmds]")) {
      if (RS.view === "run") RS.runCmds = !RS.runCmds;
      else RS.cmdsOpen = !RS.cmdsOpen;
      RS.keepScroll = true;
      runsRender();
      return;
    }
    if (target.closest("[data-runs-more]")) {
      RS.cmdsAll = true;
      RS.keepScroll = true;
      runsRender();
      const first = runsCard.querySelector(`.rn-cmds li:nth-child(${RUN_COMMAND_LIMIT + 1}) button`);
      if (first instanceof HTMLElement) first.focus({ preventScroll: true });
      return;
    }
    const block = target.closest("[data-tb]")?.getAttribute("data-tb");
    if (block) {
      transcript.toggle(block);
      RS.keepScroll = true;
      runsRender();
      return;
    }
    const stopping = target.closest("[data-run-stop]")?.getAttribute("data-run-stop");
    if (stopping) {
      const what = world.state.runs.get(stopping)?.title || "this sub-agent";
      stop(what, () => world.act.stopRun(stopping), `run:${stopping}`);
      return;
    }
    const session = RS.session;
    if (session && target.closest("[data-runs-stop]")) {
      stop("every sub-agent of this thread", () => world.act.stopRuns(session), `all:${session}`);
      return;
    }
    const undone = target.closest("[data-runs-undo]")?.getAttribute("data-runs-undo");
    if (undone) { undo(undone); return; }
    if (target.closest("[data-runs-retry]")) { void retry(); return; }
    const run = target.closest("[data-run]")?.getAttribute("data-run");
    if (run) void openRun(run);
  });

  return {
    card: runsCard, open, back: runsEscape,
    get isOpen() { return RS.open; },
    get isDetail() { return RS.open && RS.view === "run"; },
    dispose() {
      scope.dispose();
      cancelDetail();
      RS.gen++;
      RS.open = false;
    },
  };
}
