// @ts-check

import { once } from "../../core/platform/pending.js";
import { redraw } from "../../core/ui/redraw.js";
import { drawLeaving } from "../../core/ui/motion.js";
import { menuKeys, focusOpened, radioKeys } from "../../core/ui/a11y/keynav.js";
import { detailHtml, reportHtml } from "./detail.js";
import { createDraft, optionsOf, redraws } from "./draft.js";
import { createReport } from "./report.js";
import { bodyOf, copyName, formHtml, problemOf, readForm, valuesOf, withDay } from "./form.js";

/** @import { Automation, FormValues, SideControl, SideDeps, SideState } from "./types" */

/** @param {ParentNode | null} root @param {string} selector */
const focusIn = (root, selector) => {
  const el = root?.querySelector(selector);
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
};

/** @param {string} key @param {() => Promise<unknown>} work @param {SideControl} x @param {string} words */
const act = (key, work, x, words) => once(key, async () => {
  x.paint();
  try { await work(); } catch (error) { x.deps.failed(error, words); }
}).finally(() => x.paint());

/** What a button on one automation does. @param {string} what @param {Automation} a @param {SideControl} x */
function actOn(what, a, x) {
  const { st, deps } = x;
  if (what === "edit") x.show(a.id, true);
  else if (what === "duplicate") x.duplicate(a.id);
  else if (what === "delete") { st.confirm = true; x.paint(); focusIn(st.host, "[data-au-act=keep]"); }
  else if (what === "keep") { st.confirm = false; x.paint(); }
  else if (what === "project") deps.openProject?.(a.project);
  else if (what === "agent" && a.persona) deps.openAgent?.(a.persona, a.project);
  else if (what === "delete-now") {
    deps.store.removeLater(a.id);
    deps.announce(`${a.name} deleted. Undo is in the list for 10 seconds.`);
    x.close();
  } else if (what === "run" && !a.running) {
    void act(`au-run:${a.id}`, () => deps.store.runNow(a).then(() => x.readRuns(a.id)), x, "Couldn't start it.");
  } else if (what === "toggle") {
    void act(`au-on:${a.id}`, () => deps.store.setOn(a, !a.on), x, a.on ? "Couldn't turn it off." : "Couldn't turn it on.");
  }
}

const noRuns = () => ({ id: "", rows: /** @type {null} */ (null), failed: false });

/** Saves an edit, then shows it. @param {SideControl} x @param {number} now */
async function saveEdit(x, now) {
  const { st, deps } = x, a = st.id ? deps.store.find(st.id) : null;
  if (!st.values || !a) return;
  const v = st.values = typedIn(st.host, st.values);
  st.problem = problemOf(v, now);
  if (st.problem) { x.paint(); return; }
  const body = bodyOf(v, a, now);
  await once(`au-save:${a.id}`, async () => {
    x.paint();
    try {
      await deps.store.save(a.id, body);
      deps.announce(`${body.name} saved`);
      st.runs = noRuns();
      x.show(a.id, false);
    } catch (error) {
      st.problem = error instanceof Error ? error.message : "Couldn't save it.";
      deps.failed(error, "");
      x.paint();
    }
  });
}

/** The values as typed so far. @param {HTMLElement | null} host @param {FormValues} v */
function typedIn(host, v) {
  const form = host?.querySelector("form[data-au-form]");
  return form instanceof HTMLElement ? readForm(form, v) : v;
}

/** One automation, or the form that makes or edits one, in a host the page or the panel gives it. @param {SideDeps} deps */
export function createSide(deps) {
  const now = deps.now ?? Date.now;
  /** @type {SideState} */
  const st = { host: null, id: null, editing: false, menu: false, confirm: false, problem: "", values: null,
    runs: noRuns() };
  let reading = /** @type {AbortController | null} */ (null);
  const unwatch = deps.store.watch(() => paint());
  const draft = createDraft(deps, (id) => { st.runs = noRuns(); if (deps.made) deps.made(id); else show(id, false); });
  const unwatchAgents = deps.watchAgents?.(() => { if (st.editing) paint(); draft.repaint(); });
  const current = () => st.id ? deps.store.find(st.id) : null;
  const report = createReport(deps, () => paint());
  /** @param {FormValues} v */
  const typed = (v) => typedIn(st.host, v);

  /** @param {string} which */
  async function readRuns(which) {
    reading?.abort();
    const mine = reading = new AbortController();
    st.runs = { id: which, rows: null, failed: false };
    try {
      st.runs = { id: which, rows: await deps.store.runs(which, mine.signal), failed: false };
    } catch (error) {
      if (mine.signal.aborted) return;
      st.runs = { id: which, rows: [], failed: true };
      deps.failed(error, "");
    }
    paint();
  }

  function paint() {
    const { host, runs } = st, a = current();
    if (!host) return;
    if (st.id && (!a || deps.store.state.deleting.has(st.id))) { close(); return; }
    if (st.editing && st.values && a) {
      redraw(host, formHtml(st.values, a, optionsOf(deps, st.values, st.problem, `au-save:${a.id}`, paint), deps.projectName(a.project)));
      return;
    }
    if (!a) { redraw(host, ""); return; }
    if (report.run) { redraw(host, reportHtml(a, report.run, report)); return; }
    const mine = runs.id === a.id;
    const s = { runs: mine ? runs.rows : null, runsFailed: mine && runs.failed, menu: st.menu, confirm: st.confirm,
      projectName: deps.projectName(a.project), where: deps.where, turning: deps.store.state.turning };
    drawLeaving(host, ".au-menu", () => redraw(host, detailHtml(a, s)));
    const opened = st.menu ? host.querySelector(".au-menu:not([data-own])") : null;
    if (opened instanceof HTMLElement && !opened.contains(document.activeElement)) focusOpened(opened);
  }

  /** A run's report, or back to its automation. @param {string | null} key */
  const openReport = (key) => {
    const r = st.runs.rows?.find((x) => x.key === key);
    if (r) report.open(r); else { report.close(); paint(); }
    focusIn(st.host, "#au-det-h");
  };

  /** @param {string | null} next @param {boolean} edit */
  function show(next, edit) {
    report.close();
    Object.assign(st, { id: next, editing: edit, menu: false, confirm: false, problem: "" });
    const a = current();
    st.values = edit ? valuesOf(a, a?.project ?? deps.here()?.chat ?? "", now()) : null;
    if (a && !edit && st.runs.id !== a.id) void readRuns(a.id);
    deps.shown(st.id ?? (edit ? "" : null));
    paint();
    focusIn(st.host, edit ? "input[name=name]" : "#au-det-h");
  }

  /** A new automation, filled in from one that exists. @param {string} from */
  function duplicate(from) {
    const a = deps.store.find(from);
    if (a) draft.open({ ...valuesOf(a, a.project, now()), name: copyName(a.name) });
  }

  function close() {
    Object.assign(st, { id: null, editing: false, values: null, menu: false, confirm: false });
    reading?.abort();
    deps.shown(null);
    if (st.host) redraw(st.host, "");
  }

  /** @param {Event} e */
  function onClick(e) {
    const target = e.target instanceof Element ? e.target.closest("[data-au-act], [data-au-day]") : null;
    if (!target || !st.host?.contains(target)) { if (st.menu) { st.menu = false; paint(); } return; }
    const day = target.getAttribute("data-au-day"), what = target.getAttribute("data-au-act") ?? "";
    if (day !== null && st.values) { st.values = withDay(typed(st.values), Number(day)); paint(); return; }
    if (what === "detail-menu") { st.menu = !st.menu; paint(); return; }
    st.menu = false;
    if (what === "cancel") { if (st.id) show(st.id, false); else close(); }
    else if (what === "report" || what === "report-back") openReport(target.getAttribute("data-au-key"));
    else if (what === "thread") deps.openThread(target.getAttribute("data-chat") ?? "", target.getAttribute("data-ts") ?? "");
    else if (what === "all") deps.showAll?.();
    else if (what === "close") close();
    else { const a = current(); if (a) actOn(what, a, { st, deps, show, duplicate, close, paint, readRuns }); }
  }

  /** @param {Event} e */
  function onInput(e) {
    if (!st.values || !redraws(e.target)) return;
    st.values = typed(st.values);
    paint();
  }

  /** @param {Event} e */
  const onSubmit = (e) => { e.preventDefault(); void saveEdit({ st, deps, show, duplicate, close, paint, readRuns }, now()); };
  /** @type {(() => void)[]} */
  const undo = [];
  return {
    /** @param {HTMLElement} el */
    mount(el) {
      st.host = el;
      for (const [type, fn] of /** @type {const} */ ([["click", onClick], ["input", onInput], ["submit", onSubmit]])) {
        el.addEventListener(type, fn);
        undo.push(() => el.removeEventListener(type, fn));
      }
      undo.push(menuKeys(el, { close: () => { st.menu = false; paint(); focusIn(el, "[data-au-act=detail-menu]"); } }), radioKeys(el));
      paint();
    },
    /** @param {string} next */
    open: (next) => show(next, false),
    /** @param {string} next */
    edit: (next) => show(next, true),
    duplicate,
    /** @param {string} chat */
    create(chat) {
      const told = deps.store.state.list.some((x) => x.notify !== null), v = valuesOf(null, chat || deps.here()?.chat || "", now());
      draft.open(told ? { ...v, notify: "found", onFailure: "tell" } : v);
    },
    close,
    get id() { return st.id; },
    get editing() { return st.editing; },
    /** Esc: a menu, then a confirm, then the form; true when it closed one. */
    escape() {
      if (draft.escape()) return true;
      if (report.close()) { paint(); return true; }
      if (st.menu || st.confirm) { st.menu = false; st.confirm = false; paint(); return true; }
      if (st.editing) { if (st.id) show(st.id, false); else close(); return true; }
      return false;
    },
    paint,
    dispose() { draft.dispose(); unwatch(); unwatchAgents?.(); reading?.abort(); for (const off of undo.splice(0)) off(); },
  };
}
