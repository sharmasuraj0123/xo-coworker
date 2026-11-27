// @ts-check

import { once } from "../../core/platform/pending.js";
import { redraw } from "../../core/ui/redraw.js";
import { menuKeys, focusOpened, radioKeys } from "../../core/ui/a11y/keynav.js";
import { detailHtml } from "./detail.js";
import { bodyOf, formHtml, problemOf, readForm, valuesOf } from "./form.js";

/** @import { Automation, SideControl, SideDeps, SideState } from "./types" */

/** @param {ParentNode | null} root @param {string} selector */
const focusIn = (root, selector) => {
  const el = root?.querySelector(selector);
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
};

/** @param {string} key @param {() => Promise<unknown>} work @param {SideControl} x @param {string} words */
const act = (key, work, x, words) => once(key, async () => {
  x.paint();
  try { await work(); } catch (error) { x.deps.failed(error, words); }
  x.paint();
});

/** What a button on one automation does. @param {string} what @param {Automation} a @param {SideControl} x */
function actOn(what, a, x) {
  const { st, deps } = x;
  if (what === "edit") x.show(a.id, true);
  else if (what === "duplicate") x.duplicate(a.id);
  else if (what === "delete") { st.confirm = true; x.paint(); focusIn(st.host, "[data-au-act=keep]"); }
  else if (what === "keep") { st.confirm = false; x.paint(); }
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

/** One automation, or the form that makes or edits one, in a host the page or the panel gives it. @param {SideDeps} deps */
export function createSide(deps) {
  const now = deps.now ?? Date.now;
  /** @type {SideState} */
  const st = { host: null, id: null, editing: false, menu: false, confirm: false, problem: "", values: null,
    runs: { id: "", rows: null, failed: false } };
  let reading = /** @type {AbortController | null} */ (null);
  const unwatch = deps.store.watch(() => paint());
  const current = () => st.id ? deps.store.find(st.id) : null;

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
    if (st.editing && st.values) {
      const busy = `au-save:${st.id ?? "new"}`;
      redraw(host, formHtml(st.values, a, { projects: deps.projects(), problem: st.problem, busy }));
      return;
    }
    if (!a) { redraw(host, ""); return; }
    const mine = runs.id === a.id;
    redraw(host, detailHtml(a, { runs: mine ? runs.rows : null, runsFailed: mine && runs.failed, menu: st.menu, confirm: st.confirm,
      projectName: deps.projectName(a.project), where: deps.where }));
    const opened = st.menu ? host.querySelector(".au-menu") : null;
    if (opened instanceof HTMLElement && !opened.contains(document.activeElement)) focusOpened(opened);
  }

  /** @param {string | null} next @param {boolean} edit */
  function show(next, edit) {
    Object.assign(st, { id: next, editing: edit, menu: false, confirm: false, problem: "" });
    const a = current();
    st.values = edit ? valuesOf(a, a?.project ?? deps.projects()[0]?.chat ?? "", now()) : null;
    if (a && !edit && st.runs.id !== a.id) void readRuns(a.id);
    deps.shown(st.id ?? (edit ? "" : null));
    paint();
    focusIn(st.host, edit ? "input[name=name]" : "#au-det-h");
  }

  /** A new automation, filled in from one that exists. @param {string} from */
  function duplicate(from) {
    const a = deps.store.find(from);
    if (!a) return;
    show(null, true);
    st.values = { ...valuesOf(a, a.project, now()), name: `${a.name} (copy)` };
    paint();
  }

  function close() {
    Object.assign(st, { id: null, editing: false, values: null, menu: false, confirm: false });
    reading?.abort();
    deps.shown(null);
    if (st.host) redraw(st.host, "");
  }

  async function save() {
    const form = st.host?.querySelector("form[data-au-form]");
    if (!st.values) return;
    if (form instanceof HTMLElement) st.values = readForm(form, st.values);
    st.problem = problemOf(st.values, now());
    if (st.problem) { paint(); return; }
    const a = current(), body = bodyOf(st.values, a, now());
    await once(`au-save:${st.id ?? "new"}`, async () => {
      paint();
      try {
        const saved = await deps.store.save(a ? a.id : null, body);
        deps.announce(a ? `${body.name} saved` : `${body.name} is on`);
        st.runs = { id: "", rows: null, failed: false };
        show(saved, false);
      } catch (error) {
        st.problem = error instanceof Error ? error.message : "Couldn't save it.";
        deps.failed(error, "");
        paint();
      }
    });
  }

  /** @param {Event} e */
  function onClick(e) {
    const target = e.target instanceof Element ? e.target.closest("[data-au-act], [data-au-day]") : null;
    if (!target || !st.host?.contains(target)) { if (st.menu) { st.menu = false; paint(); } return; }
    const day = target.getAttribute("data-au-day"), what = target.getAttribute("data-au-act") ?? "";
    if (day !== null && st.values) { st.values = { ...st.values, weekday: Number(day) }; paint(); return; }
    if (what === "detail-menu") { st.menu = !st.menu; paint(); return; }
    st.menu = false;
    if (what === "cancel") { if (st.id) show(st.id, false); else close(); }
    else if (what === "thread") deps.openThread(target.getAttribute("data-chat") ?? "", target.getAttribute("data-ts") ?? "");
    else if (what === "all") deps.showAll?.();
    else if (what === "close") close();
    else { const a = current(); if (a) actOn(what, a, { st, deps, show, duplicate, close, paint, readRuns }); }
  }

  /** @param {Event} e */
  function onInput(e) {
    const form = st.host?.querySelector("form[data-au-form]");
    if (!st.values || !(e.target instanceof Element) || e.target.getAttribute("name") !== "repeat") return;
    if (form instanceof HTMLElement) { st.values = readForm(form, st.values); paint(); }
  }

  /** @param {Event} e */
  const onSubmit = (e) => { e.preventDefault(); void save(); };
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
    create(chat) { show(null, true); if (st.values && chat) { st.values = { ...st.values, chat }; paint(); } },
    close,
    get id() { return st.id; },
    get editing() { return st.editing; },
    /** Esc: a menu, then a confirm, then the form; true when it closed one. */
    escape() {
      if (st.menu || st.confirm) { st.menu = false; st.confirm = false; paint(); return true; }
      if (st.editing) { if (st.id) show(st.id, false); else close(); return true; }
      return false;
    },
    paint,
    dispose() { unwatch(); reading?.abort(); for (const off of undo.splice(0)) off(); },
  };
}
