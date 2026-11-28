// @ts-check

import { createScope } from "../../core/kernel/scope.js";
import { createDialog } from "../../core/ui/components/dialog.js";
import { redraw } from "../../core/ui/redraw.js";
import { ICON } from "../../core/ui/icons/names.js";
import { xi } from "../../core/ui/icons/icon.js";
import { EFFORT_WORD } from "./effort.js";
import { coordinatorHtml, threadsHtml } from "./project-settings-view.js";
import { psModels, BLANK } from "./project-settings-models.js";

/** @import { ProjectSettingsOptions, PsActions, PsPage, PsPolicy, PsState } from "./project-settings-types.js" */

const SAVED_MS = 1600;
const PAGES = [["coord", "Coordinator", "agent"], ["threads", "New threads", "threads"]];

const FRAME = `<nav class="ps-side nav" aria-label="Project settings"><div class="nrow ps-me"><span class="nr-ic"></span>` +
  `<span><b></b><small>Project settings</small></span></div>` +
  PAGES.map(([id, label, icon]) => `<button type="button" class="nrow" data-ps-page="${id}"><span class="nr-ic">${xi(icon)}</span>` +
    `<span>${label}</span></button>`).join("") +
  `</nav><div class="ps-main"><div class="ps-body" tabindex="-1"></div>` +
  `<button type="button" class="ps-x" data-ps-close aria-label="Close" title="Close (Esc)">${ICON.close}</button></div>`;

/** A project's settings, in a window beside its Deploy: its coordinator, and its new threads. @param {ProjectSettingsOptions} options */
export function createProjectSettings({ world, writes, PROJ, iconOf }) {
  const scope = createScope();
  const cat = writes.catalog;
  const d = createDialog();
  d.classList.add("ps");
  d.setAttribute("aria-labelledby", "ps-title");
  d.innerHTML = FRAME;
  document.body.appendChild(d);
  const S = /** @type {PsState} */ ({ project: null, page: "coord", busy: false, models: null, dms: [], notes: {}, pref: null,
    back: null });
  let reads = createScope();
  const body = /** @type {HTMLElement} */ (d.querySelector(".ps-body"));
  scope.effect(() => () => { reads.dispose(); if (d.open) d.close(); d.remove(); });
  const M = psModels({ world, cat, PROJ, state: S });

  function draw() {
    if (!d.open || !S.project) return;
    for (const b of d.querySelectorAll("[data-ps-page]")) {
      b.classList.toggle("is-on", b.getAttribute("data-ps-page") === S.page);
      if (b.getAttribute("data-ps-page") !== S.page) b.removeAttribute("aria-current");
      else b.setAttribute("aria-current", "page");
    }
    const html = S.page === "coord" ? coordinatorHtml(M.coordinator()) : threadsHtml(M.threads());
    redraw(body, `<div class="set-page ps-page" data-key="${S.page}">${html}</div>`);
  }

  /** One write at a time: its row says Saving…, then Saved, or why not. @param {string} key @param {() => Promise<unknown>} write */
  async function saving(key, write) {
    if (S.busy) return;
    S.busy = true; S.notes[key] = { saving: true }; draw();
    try {
      const ok = (await write()) !== false;
      S.notes[key] = ok ? {} : { err: "That didn't save, so nothing changed." };
      if (ok) scope.timeout(() => { if (!S.notes[key]?.err) delete S.notes[key]; draw(); }, SAVED_MS);
    } catch (err) {
      S.notes[key] = { err: `Nothing changed: ${err instanceof Error ? err.message : String(err)}` };
    }
    S.busy = false;
    draw();
  }

  function readModels() {
    reads.dispose(); reads = createScope();
    const { signal } = reads, runtime = cat.runtimeOf(M.session());
    S.models = cat.catalogs.get(runtime) || null;
    cat.catalog(runtime, { fresh: true, signal })
      .then((list) => list || [], () => S.models || [])
      .then((list) => { if (!signal.aborted) { S.models = list; draw(); } });
    writes.routerModels(signal).then((list) => { if (!signal.aborted) { S.dms = list; draw(); } }, () => {});
  }

  /** @param {Partial<PsPolicy>} patch @param {string} key */
  function putPolicy(patch, key) {
    const c = cat.chatOfSession(M.session()), pol = c ? cat.chatPolicy(c) : null;
    if (!c || !pol) return;
    const next = { ...BLANK, ...(pol.project || {}), ...patch };
    if (next.default && Array.isArray(next.allowed) && !next.allowed.includes(next.default)) next.default = null;
    void saving(key, () => /** @type {Promise<unknown>} */ (world.act.setPolicy(c.chatId, next)));
  }

  /** @param {string} id */
  function setModel(id) {
    const s = M.session(), list = S.models || [], c = cat.current(s);
    if (!id) { void saving("model", () => writes.setModel(s, { auto: true }, list)); return; }
    const m = list.find((x) => x.id === id), efs = m ? cat.effortsOf(m, s).filter((e) => EFFORT_WORD[e]) : [];
    const effort = !efs.length ? null : c.effort && efs.includes(c.effort) ? c.effort
      : m?.default_effort && efs.includes(m.default_effort) ? m.default_effort : efs[Math.floor((efs.length - 1) / 2)];
    void saving("model", () => writes.setModel(s, { auto: false, model: id, effort }, list));
  }
  /** @param {string} effort */
  function setEffort(effort) {
    const s = M.session(), c = cat.current(s);
    if (c.model) void saving("think", () => writes.setModel(s, { auto: false, model: c.model, effort }, S.models || []));
  }
  /** @param {string} n */
  function toggleAllowed(n) {
    const now = M.threads().allowed, next = now.includes(n) ? now.filter((x) => x !== n) : [...now, n];
    if (!next.length) { S.notes.allowed = { err: "Leave at least one runtime on." }; draw(); return; }
    putPolicy({ allowed: next }, "allowed");
  }
  /** @param {string} value */
  function setPref(value) {
    const text = value.trim() || null;
    S.pref = null;
    if (text !== (M.threads().own.preferences ?? null)) putPolicy({ preferences: text }, "preferences");
  }
  /** @param {PsPage} page */
  function go(page) {
    S.page = page; draw();
    const h = d.querySelector("#ps-title");
    if (h instanceof HTMLElement) h.focus({ preventScroll: true });
  }

  bindProjectSettings(scope, d, S, {
    go, close: () => close(), setModel, setEffort, toggleAllowed, setPref,
    route: (id) => void saving("route", () => writes.route(M.session(), id)),
    runtime: (id) => void saving("rt", async () => { await writes.setRuntime(M.session(), id); readModels(); }),
    policy: putPolicy,
  });

  /** @param {string} project @param {PsPage} [page] */
  function open(project, page = "coord", from = document.activeElement) {
    if (scope.signal.aborted) return;
    if (S.project !== project) { S.notes = {}; S.pref = null; }
    S.project = project; S.page = page;
    S.back = from && from !== document.body ? from : null;
    const icon = d.querySelector(".ps-me .nr-ic"), name = d.querySelector(".ps-me b");
    if (icon) icon.innerHTML = iconOf(project) || "";
    if (name) name.textContent = PROJ(project);
    if (!d.open) d.showModal();
    readModels();
    draw();
    body.focus({ preventScroll: true });
  }
  const close = () => { if (d.open) d.close(); };
  scope.listen(d, "close", () => {
    reads.dispose();
    const back = S.back?.isConnected ? S.back : null;
    S.back = null;
    if (back instanceof HTMLElement) back.focus({ preventScroll: true });
  });

  return {
    open, close, dispose: scope.dispose,
    get isOpen() { return d.open; },
    /** Every render: the open window draws what changed. */
    sync: draw,
  };
}


/** @typedef {ReturnType<typeof createScope>} Scope */

/** Clicks, choices and keys in the window. @param {Scope} scope @param {HTMLDialogElement} d @param {PsState} state @param {PsActions} A */
function bindProjectSettings(scope, d, state, A) {
  scope.listen(d, "click", (e) => {
    const t = e.target;
    if (t === d) { A.close(); return; }
    if (!(t instanceof Element) || t.closest('[aria-disabled="true"]')) return;
    const pick = (/** @type {string} */ a) => t.closest(`[${a}]`)?.getAttribute(a) ?? null;
    const page = pick("data-ps-page");
    if (page === "coord" || page === "threads") { A.go(page); return; }
    if (t.closest("[data-ps-close]")) { A.close(); return; }
    const effort = pick("data-ps-effort"), route = pick("data-ps-route"), def = pick("data-ps-default"), fb = pick("data-ps-fallback");
    if (effort != null) A.setEffort(effort);
    else if (route != null) A.route(route);
    else if (def != null) A.policy({ default: def || null }, "default");
    else if (fb != null) A.policy({ fallback: fb === "" ? null : fb === "on" }, "fallback");
    else if (t.closest("[data-ps-allowed-space]")) A.policy({ allowed: null }, "allowed");
  });
  scope.listen(d, "change", (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const value = "value" in t ? String(t.value) : "";
    if (t.matches("[data-ps-rt]")) A.runtime(value);
    else if (t.matches("[data-ps-model]")) A.setModel(value);
    else if (t.matches("[data-ps-allowed]")) A.toggleAllowed(t.getAttribute("data-ps-allowed") || "");
    else if (t.matches("[data-ps-pref]")) A.setPref(value);
  });
  scope.listen(d, "input", (e) => {
    if (e.target instanceof HTMLTextAreaElement && e.target.matches("[data-ps-pref]")) state.pref = e.target.value;
  });
  scope.listen(d, "keydown", (e) => {
    const t = e.target;
    if (!(e instanceof KeyboardEvent) || !(t instanceof HTMLElement) || !t.matches(".rt-seg [role=radio]")) return;
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const all = [...(t.parentElement?.querySelectorAll("[role=radio]") || [])], i = all.indexOf(t);
    const next = all[(i + (e.key === "ArrowRight" ? 1 : all.length - 1)) % all.length];
    e.preventDefault();
    if (next instanceof HTMLElement) { next.focus(); next.click(); }
  });
}
