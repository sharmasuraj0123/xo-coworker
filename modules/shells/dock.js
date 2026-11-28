// @ts-check

import { COPY_REFUSED } from "../../core/platform/index.js";
import { createScope } from "../../core/kernel/scope.js";
import { read, write } from "../../core/platform/storage.js";
import { createDockRefresh } from "./dock-refresh.js";
import { createDockRequests } from "./dock-requests.js";
import { createShellOpeners } from "./dock-open.js";
import * as K from "../../core/platform/keys.js";
import { mountShell } from "./term.js";
import { isRunning, runningOf } from "./model.js";
import { createDockView } from "./dock-view.js";
import { createDockActions } from "./dock-actions.js";
import { bindDockInput } from "./dock-input.js";

const LIST = "list";
const OPEN_KEY = "xo-shells";       // sessionStorage: the tabs attached in this browser tab, so a reload reattaches
const SIZE_KEY = "xo-shells-dock";  // localStorage: the dock's height and whether it is minimised

/** @param {import('./dock-types.js').DockOptions} [options] */
export function createShells({ PROJ = (p) => p, notify = () => {}, onChange = () => {}, announce = () => {}, wanted = () => true } = {}) {
  const scope = createScope();
  const requests = createDockRequests(scope.signal);
  const root = /** @type {HTMLElement} */ (document.getElementById("shd"));
  const side = /** @type {HTMLElement} */ (document.getElementById("nv-shells"));
  const saved = /** @type {{min?: boolean, h?: number}} */ (read(SIZE_KEY, JSON.parse, {}) ?? {});
  let savedTabs = /** @type {import("./dock-types.js").DockSnapshot | null} */ (read(OPEN_KEY, JSON.parse, null, "session"));
  /** @type {import("./dock-types.js").DockState} */
  const R = {
    enabled: false, reason: null, statusAt: 0,
    list: [], loaded: false, err: null,
    tabs: new Map(),      // id → {handle, pane, state, detail, title, exit}
    order: [],
    active: LIST,
    filter: null,         // a project's folder, "workspace", or null for every shell
    open: false, min: !!saved.min, h: saved.h || 320,
    half: false,          // on a phone: the sheet rests at half height, the conversation showing above it
    edit: null,           // the shell being renamed
    confirm: null,        // {kind: "close", id, fg, row} | {kind: "detached", ids}: row, asked from the list's row (it answers there)
    busy: new Set(),      // shells with a write on its way
    opening: false,       // New shell, waiting for the backend
  };

  root.innerHTML =
    `<div class="shd-grip" role="separator" aria-orientation="horizontal" aria-label="Resize the shells panel" tabindex="0" title="Drag to resize"></div>` +
    `<header class="shd-bar"><div class="shd-tabs" role="tablist" aria-label="Shells"></div><div class="shd-acts"></div></header>` +
    `<div class="shd-body"><div class="shd-confirm" role="alertdialog" hidden></div><div class="shd-list" role="tabpanel" aria-label="Every shell"></div></div>`;
  const tabsEl = /** @type {import('./dock-types.js').DockElement} */ (root.querySelector(".shd-tabs"));
  const actsEl = /** @type {import('./dock-types.js').DockElement} */ (root.querySelector(".shd-acts"));
  const bodyEl = /** @type {HTMLElement} */ (root.querySelector(".shd-body"));
  const listEl = /** @type {import('./dock-types.js').DockElement} */ (root.querySelector(".shd-list"));
  const confirmEl = /** @type {import('./dock-types.js').DockElement} */ (root.querySelector(".shd-confirm"));
  const grip = /** @type {HTMLElement} */ (root.querySelector(".shd-grip"));

  /** @param {string} id */
  const byId = (id) => R.list.find((t) => t.id === id) || null;
  /** @param {HTMLElement | null} el */
  const shown = (el) => !!(el && el.getClientRects().length && !el.closest("[inert]"));
  function away() {
    const to = ["scroller", "home", "nv-shells", "pb-menu", "top-menu"].map((id) => document.getElementById(id)).find(shown);
    to?.focus({ preventScroll: true });
  }
  /** @param {string} id */
  const nameOf = (id) => byId(id)?.name || R.tabs.get(id)?.name || "Shell";
  const { render, renderTabs } = createDockView(R, { root, side, tabsEl, actsEl, listEl, confirmEl, byId, nameOf, PROJ, wanted, LIST });
  const listShown = () => R.open && !R.min && R.active === LIST && !document.hidden;

  /** @param {import('./model.js').Shell | null} t */
  function upsert(t) {
    if (!t || !t.id) return;
    const i = R.list.findIndex((x) => x.id === t.id);
    if (i >= 0) R.list[i] = t; else R.list.push(t);
  }
  function persist() {
    if (!savedTabs) write(OPEN_KEY, JSON.stringify({ tabs: R.order, active: R.active, open: R.open, filter: R.filter }), "session");
    write(SIZE_KEY, JSON.stringify({ h: R.h, min: R.min }));
  }
  function claimView() {
    if (!savedTabs) return;
    savedTabs = null;
    persist();
  }
  const changed = () => { render(); persist(); onChange(); };

  const { refresh, refreshSoon } = createDockRefresh(R, { scope, offNow, changed: refreshed, listShown });

  /** Shells were turned off under us: every tab ends, and the UI goes away. @param {string | null} reason */
  function offNow(reason) {
    for (const id of [...R.order]) detach(id, { quiet: true });
    R.open = false;
    if (reason) notify({ kind: "stopped", text: "Shells are off", sub: reason });
  }

  /** @param {string} id @param {{ticket?: string | null, focus?: boolean}} [options] */
  function attach(id, { ticket = null, focus = true } = {}) {
    if (scope.signal.aborted) return;
    claimView();
    if (R.tabs.has(id)) { activate(id, { focus }); return; }
    const pane = document.createElement("div");
    pane.className = "shd-term";
    pane.setAttribute("role", "tabpanel");
    pane.dataset.pane = id;
    pane.innerHTML = `<div class="shd-x"></div><div class="shd-note" hidden></div>`;
    bodyEl.append(pane);
    const tab = /** @type {import("./dock-types.js").DockTab} */ (/** @type {Omit<import("./dock-types.js").DockTab, "handle">} */ ({ pane, state: "connecting", detail: null, title: "", exit: null, name: byId(id)?.name || "Shell" }));
    R.tabs.set(id, tab);
    R.order.push(id);
    R.open = true; R.min = false;
    R.active = id;
    render();
    tab.handle = mountShell(/** @type {HTMLElement} */ (pane.querySelector(".shd-x")), {
      id, ticket,
      keys: (e) => !(e.type === "keydown" && K.is(e, "shells")),
      on: {
        state: (s, detail) => { tab.state = s; tab.detail = detail || null; tab.until = s === "retrying" && detail?.wait ? Date.now() + detail.wait : 0; if (s === "ended" || s === "off") refreshSoon(); render(); if (tab.until) countdown(); },
        ready: (t) => { upsert(t); tab.name = t.name; tab.exit = null; render(); onChange(); },
        exit: (x) => { tab.exit = x; },
        title: (t) => { tab.title = String(t || "").slice(0, 200); renderTabs(); },
        error: (m) => notify({ kind: "stopped", text: nameOf(id), sub: m.message || m.code }),
        // Ctrl+Shift+C: said only once it's on the clipboard; refused, why (focus stays in the shell)
        copy: (ok) => { if (ok) announce("Copied the selection."); else { announce(COPY_REFUSED); notify({ kind: "stopped", text: "Couldn't copy", sub: COPY_REFUSED }); } },
      },
    });
    if (focus) tab.handle.focus(); // at once: the list (and the Open pressed in it) is hidden in this same render
    persist(); onChange();
  }
  /** @param {string} id */
  function activate(id, { focus = true } = {}) {
    if (scope.signal.aborted) return;
    claimView();
    R.active = id; R.open = true; R.min = false;
    R.edit = null;
    render(); persist();
    const tab = R.tabs.get(id);
    if (tab) scope.frame(() => { tab.handle.refit(); if (focus) tab.handle.focus(); });
    else if (id === LIST) { refresh(); if (focus) (/** @type {HTMLButtonElement | null} */ (tabsEl.querySelector(`[data-sh-tab="${LIST}"]`)))?.focus(); }
  }
  /** Stop watching: the socket closes, the shell keeps running. @param {string} id */
  function detach(id, { quiet = false } = {}) {
    const tab = R.tabs.get(id);
    if (!tab) return;
    tab.handle.dispose();
    tab.pane.remove();
    R.tabs.delete(id);
    const i = R.order.indexOf(id);
    R.order.splice(i, 1);
    if (R.active === id) R.active = R.order[Math.min(i, R.order.length - 1)] || LIST;
    // Stop watching / Close tab: the tab now in front takes focus, else the Shells tab (its list), in the same breath
    if (!quiet) {
      const here = root.contains(document.activeElement) || document.activeElement === document.body;
      changed(); refreshSoon();
      if (here) { const t = R.tabs.get(R.active); if (t) t.handle.focus(); else (/** @type {HTMLButtonElement | null} */ (tabsEl.querySelector(`[data-sh-tab="${LIST}"]`)))?.focus(); }
    }
  }
  /** A tab waiting to reconnect counts its seconds down (a number written once and never moved was a lie a second later). */
  let cdT = /** @type {(() => void) | undefined} */ (undefined);
  function countdown() {
    if (cdT) return;
    cdT = scope.interval(() => {
      let any = false;
      for (const tab of R.tabs.values()) {
        if (tab.state !== "retrying" || !tab.until) continue;
        any = true;
        const n = tab.pane.querySelector(".shd-note [data-left]");
        if (n) n.textContent = String(Math.max(1, Math.ceil((tab.until - Date.now()) / 1000)));
      }
      if (!any) { cdT?.(); cdT = undefined; }
    }, 250);
  }

  const { openProject, openWorkspace, openThread } = createShellOpeners(R, {
    requests, wanted, render, attach, upsert, showList, projectName: PROJ, refresh, notify, announce, claimView,
    focusNew() {
      const had = root.contains(document.activeElement) || document.activeElement === document.body;
      render();
      const next = listEl.querySelector("[data-sh-new]");
      if (had && !root.contains(document.activeElement) && next instanceof HTMLElement) next.focus();
    },
  });
  /** @param {string | null} [filter] */
  function showList(filter = null) {
    if (scope.signal.aborted) return;
    R.filter = filter;
    R.confirm = null;
    activate(LIST);
  }
  /** The toggle key: open (where you left off), minimise, or open again. */
  function toggle() {
    if (scope.signal.aborted || !R.enabled || !wanted()) return;
    if (!R.open) { activate(R.active); return; }
    // Keep focus on the minimize button when it was pressed.
    const onMin = !!document.activeElement?.closest?.("[data-sh-min]");
    R.min = !R.min;
    changed();
    if (!R.min) activate(R.active, { focus: !onMin });
    else if (!onMin && root.contains(document.activeElement)) away();
  }

  const { askClose, keepIt, closeShell, askCloseDetached, closeDetached, startRename, renameBack, saveRename } = createDockActions(R, {
    root, listEl, confirmEl, LIST, byId, upsert, nameOf, render, changed, detach, refreshSoon, notify, announce, requests,
  });
  const { PHONE, refit } = bindDockInput(R, {
    root, side, listEl, tabsEl, grip, LIST, showList, toggle, activate, detach, attach, startRename, askClose,
    openProject, openWorkspace, askCloseDetached, changed, keepIt, closeShell, closeDetached, away, saveRename,
    render, renameBack, owns, persist, scope,
  });

  /** Is this key event the shell's (inside a terminal), so the app's shortcuts must leave it alone? @param {Event} e */
  function owns(e) {
    const el = /** @type {Element | null} */ (e.target);
    return !!(el && el.closest && el.closest("#shd .xterm"));
  }

  function refreshed() {
    if (!savedTabs || !R.enabled || !R.loaded) { changed(); return; }
    const snapshot = savedTabs;
    savedTabs = null;
    R.filter = snapshot.filter ?? null;
    for (const id of snapshot.tabs || []) if (isRunning(byId(id))) attach(id, { focus: false });
    R.active = snapshot.active === LIST || R.tabs.has(snapshot.active) ? snapshot.active : R.order[0] || LIST;
    R.open = !!snapshot.open && (R.tabs.size > 0 || R.active === LIST);
    changed();
    R.tabs.get(R.active)?.handle.refit();
  }
  void refresh({ status: true });

  return {
    dispose() { scope.dispose(); for (const id of [...R.order]) detach(id, { quiet: true }); },
    /** On, and wanted: the thread menu's "Open a shell" and ⌘` follow this. */
    get enabled() { return R.enabled && wanted(); },
    /** On at the backend, whatever the shape says (the shape's capability check). */
    get available() { return R.enabled; },
    /** Draw again after the shape changed. */
    redraw: () => render(),
    /** Running shells: a project's (its folder name), the workspace's ("workspace"), or every one (null). */
    countFor: (/** @type {string | null} */ p = null) => (p === "workspace" ? R.list.filter((t) => isRunning(t) && t.scope === "workspace").length : runningOf(R.list, p).length),
    openProject, openWorkspace, openThread, showList, toggle, owns,
    /** Shown and not minimised (the panel's Shell mode leaves when the dock is put away from inside it). */
    get shown() { return R.enabled && wanted() && R.open && !R.min; },
    /** Put away, as its own ↓ does: shells keep running. */
    hide() { if (scope.signal.aborted || !R.open) return; R.open = false; changed(); away(); },
    /** On a phone, is the shells sheet up over the page (so Back puts it away first)? */
    get raised() { return !!PHONE?.matches && R.enabled && wanted() && R.open && !R.min; },
    /** Back on a phone: half height first, then away behind the sidebar's toggle. */
    lower() {
      if (scope.signal.aborted || !(PHONE?.matches && R.open && !R.min)) return false;
      if (!R.half) { R.half = true; render(); refit(); return true; }
      R.min = true; R.half = false; changed();
      away();
      return true;
    },
  };
}
