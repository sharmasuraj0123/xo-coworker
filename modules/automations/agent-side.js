// @ts-check

import { once } from "../../core/platform/pending.js";
import { redraw } from "../../core/ui/redraw.js";
import { focusOpened, menuKeys } from "../../core/ui/a11y/keynav.js";
import { instructionsOf, keyOf, titleOf } from "./agent-file.js";
import { agentProblem, agentText, agentValues, readAgentForm } from "./agent-form.js";
import { agentDetailHtml, agentFormHtml } from "./agent-views.js";

/** @import { Agent, AgentSideDeps, AgentSideState, RuntimeChange } from "./types" */

/** @typedef {{ st: AgentSideState, deps: AgentSideDeps, show: (key: string | null, edit: boolean) => void, close: () => void }} Calls */


/** @param {HTMLElement | null} root @param {string} selector */
const focusIn = (root, selector) => {
  const el = root?.querySelector(selector);
  if (el instanceof HTMLElement) el.focus({ preventScroll: true });
};

/** @param {unknown} error @param {string} words */
const wordsOf = (error, words) => error instanceof Error && error.message ? error.message : words;

/** Read once per version. @param {AgentSideState} st @param {AgentSideDeps} deps @param {Agent} a @param {() => void} paint */
async function readBody(st, deps, a, paint) {
  const key = keyOf(a);
  if (st.read === `${key}@${a.version}`) return;
  st.read = `${key}@${a.version}`;
  st.body = null;
  try {
    const got = await deps.personas.file(a);
    if (st.key !== key) return;
    st.body = instructionsOf(got.text);
    st.version = got.version;
  } catch (error) {
    if (st.key === key) st.body = "";
    deps.failed(error, "Couldn't read its file.");
  }
  paint();
}

/** A button on an agent. @param {string} what @param {Element} target @param {Agent} a @param {Calls & { paint: () => void }} c */
function act(what, target, a, { st, deps, show, close, paint }) {
  if (what === "edit") { if (st.body !== null) show(st.key, true); return; }
  const project = deps.project() || a.project || deps.projects()[0]?.id || "";
  if (what === "try") st.trying = { task: "", project, busy: `ag-try:${st.key}` };
  else if (what === "try-cancel") st.trying = null;
  else if (what === "ag-file") deps.openFile(a.owner, a.path, target);
  else if (what === "ag-delete") { st.confirm = true; paint(); focusIn(st.host, "[data-ag-act=keep]"); return; }
  else if (what === "keep") st.confirm = false;
  else if (what === "delete-now") {
    void once(`ag-del:${st.key}`, async () => {
      try { await deps.personas.remove(a); deps.announce(`${titleOf(a.name)} deleted`); close(); }
      catch (error) { deps.failed(error, wordsOf(error, "Couldn't delete it.")); }
    });
    return;
  } else if (what === "job") deps.openJob(target.getAttribute("data-au-id") ?? "");
  paint();
  if (what === "try") focusIn(st.host, "textarea[name=task]");
}

/** The models of the form's runtime or the main one. @param {AgentSideState} st @param {AgentSideDeps} deps @param {() => void} paint */
const modelsFor = (st, deps, paint) => {
  const rt = st.values?.draft.runtime || deps.mainRuntime();
  return rt ? deps.models(rt, paint) : [];
};

/** A new runtime brings its own models; a model it doesn't have goes back to Default. @param {Event} e @param {RuntimeChange} c */
function newRuntime(e, { st, deps, may, paint }) {
  const form = st.host?.querySelector("form[data-ag-form]");
  if (!(e.target instanceof Element) || e.target.getAttribute("name") !== "runtime" || !(form instanceof HTMLElement) || !st.values) return;
  const v = st.values = readAgentForm(form, st.values, may), list = modelsFor(st, deps, paint);
  if (list && !list.some((m) => m.id === v.draft.model)) st.values = { ...v, draft: { ...v.draft, model: null } };
  paint();
}

/** One agent, or the form that makes or edits one, in a host the page or the panel gives it. @param {AgentSideDeps} deps */
export function createAgentSide(deps) {
  /** @type {AgentSideState} */
  const st = { host: null, key: null, editing: false, menu: false, confirm: false, trying: null, body: null, version: null, values: null,
    read: "" };
  const unwatch = deps.personas.watch(() => paint());
  const current = () => st.key ? deps.find(st.key) : null;
  const may = () => deps.personas.seen(deps.project() || "")?.may ?? {};

  function paint() {
    if (!st.host) return;
    const a = current();
    if (st.editing && st.values) {
      const places = /** @type {[string, string][]} */ (deps.project()
        ? [[deps.project(), `${deps.projectName(deps.project())} only`], ["space", "Every project"]]
        : [["space", "Every project"], ...deps.projects().map((p) => [p.id, `${p.name} only`])]);
      const models = modelsFor(st, deps, paint), busy = `ag-save:${st.key ?? "new"}`;
      redraw(st.host, agentFormHtml({ ...st.values, runtimes: deps.runtimes(), models, busy, isNew: !a, places }));
      return;
    }
    if (!a) { redraw(st.host, st.key ? `<p class="au-none">This agent is gone.</p>` : ""); return; }
    void readBody(st, deps, a, paint);
    redraw(st.host, agentDetailHtml(a, { where: deps.where, body: st.body, menu: st.menu, confirm: st.confirm, trying: st.trying,
      may: may(), projects: deps.projects(), project: deps.project(), projectName: deps.projectName }));
    const opened = st.menu ? st.host.querySelector(".au-menu") : null;
    if (opened instanceof HTMLElement && !opened.contains(document.activeElement)) focusOpened(opened);
  }

  /** @param {string | null} key @param {boolean} edit */
  function show(key, edit) {
    Object.assign(st, { key, editing: edit, menu: false, confirm: false, trying: null });
    const a = current();
    st.values = edit ? agentValues(a, a ? st.body ?? "" : "", a ? a.project : deps.project(), may()) : null;
    deps.shown(key ?? (edit ? "" : null));
    paint();
    focusIn(st.host, edit ? "input[name=title]" : "#ag-det-h");
  }

  function close() {
    Object.assign(st, { key: null, editing: false, values: null, menu: false, confirm: false, trying: null });
    deps.shown(null);
    if (st.host) redraw(st.host, "");
  }

  /** @param {{ persona?: { name: string, level: Agent["level"] }, text?: string }} what @param {string} project @param {string} task */
  async function tryOnce(what, project, task) {
    await once(`ag-try:${st.key ?? "new"}`, async () => {
      paint();
      try {
        const got = await deps.personas.tryOnce({ ...what, project, ...(task.trim() ? { task: task.trim() } : {}) });
        st.trying = null;
        deps.announce("Trying it once, in a new thread");
        deps.openThread(got.chat_id, got.ts);
      } catch (error) {
        deps.failed(error, wordsOf(error, "Couldn't start the try."));
      }
      paint();
    });
  }

  async function save() {
    const form = st.host?.querySelector("form[data-ag-form]"), was = current();
    if (!st.values) return;
    const v = st.values = form instanceof HTMLElement ? readAgentForm(form, st.values, may()) : st.values;
    v.problem = agentProblem(v);
    if (v.problem) { paint(); return; }
    await once(`ag-save:${st.key ?? "new"}`, async () => {
      paint();
      try {
        const { level, project, name } = v.draft;
        await deps.personas.save({ level, project, name, text: agentText(v), base: was ? st.version : null, was });
        deps.announce(`${titleOf(name)} saved`);
        st.read = "";
        show(`${level}:${level === "space" ? "" : project}:${name}`, false);
      } catch (error) {
        v.problem = wordsOf(error, "Couldn't save it.");
        deps.failed(error, "");
        paint();
      }
    });
  }

  /** @param {Event} e */
  function onClick(e) {
    const target = e.target instanceof Element ? e.target.closest("[data-ag-act]") : null;
    if (!target || !st.host?.contains(target)) { if (st.menu) { st.menu = false; paint(); } return; }
    const what = target.getAttribute("data-ag-act") ?? "";
    if (what === "menu") { st.menu = !st.menu; paint(); return; }
    st.menu = false;
    if (what === "cancel") { if (st.key) show(st.key, false); else close(); return; }
    if (what === "close") { close(); return; }
    if (what === "try-form" && st.values) {
      const form = st.host.querySelector("form[data-ag-form]");
      const v = st.values = form instanceof HTMLElement ? readAgentForm(form, st.values, may()) : st.values;
      void tryOnce({ text: agentText(v) }, v.draft.project || deps.project() || deps.projects()[0]?.id || "", "");
      return;
    }
    const a = current();
    if (a) act(what, target, a, { st, deps, show, close, paint });
  }

  /** @param {Event} e */
  function onSubmit(e) {
    e.preventDefault();
    const form = e.target instanceof Element ? e.target.closest("form") : null, a = current();
    if (form?.hasAttribute("data-ag-try") && a && st.trying) {
      const read = (/** @type {string} */ n) => {
        const el = form.querySelector(`[name="${n}"]`);
        return el && "value" in el ? String(el.value) : "";
      };
      void tryOnce({ persona: { name: a.name, level: a.level } }, read("try-project") || st.trying.project, read("task"));
    } else void save();
  }

  /** @type {(() => void)[]} */
  const undo = [];
  return {
    /** @param {HTMLElement} el */
    mount(el) {
      st.host = el;
      /** @param {Event} e */
      const onChange = (e) => newRuntime(e, { st, deps, may: may(), paint });
      for (const [type, fn] of /** @type {const} */ ([["click", onClick], ["submit", onSubmit], ["change", onChange]])) {
        el.addEventListener(type, fn);
        undo.push(() => el.removeEventListener(type, fn));
      }
      undo.push(menuKeys(el, { close: () => { st.menu = false; paint(); focusIn(el, "[data-ag-act=menu]"); } }));
      paint();
    },
    /** @param {string} key */
    open: (key) => show(key, false),
    create: () => show(null, true),
    close,
    get key() { return st.key; },
    get editing() { return st.editing; },
    /** Esc: a menu, a confirm or a try, then the form; true when it closed one. */
    escape() {
      if (st.menu || st.confirm || st.trying) { Object.assign(st, { menu: false, confirm: false, trying: null }); paint(); return true; }
      if (st.editing) { if (st.key) show(st.key, false); else close(); return true; }
      return false;
    },
    paint,
    dispose() { unwatch(); for (const off of undo.splice(0)) off(); },
  };
}

/** @typedef {ReturnType<typeof createAgentSide>} AgentSide */
