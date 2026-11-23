// @ts-check

import { api } from "../../core/platform/api.js";
import { COPY_REFUSED } from "../../core/platform/index.js";
import * as K from "../../core/platform/keys.js";
import { mountShell } from "./term.js";
import { isRunning, runningOf, nameFor } from "./model.js";
import { createDockView } from "./dock-view.js";
import { createDockActions } from "./dock-actions.js";
import { bindDockInput } from "./dock-input.js";

const LIST = "list";
const OPEN_KEY = "xo-shells";       // sessionStorage: the tabs attached in this browser tab, so a reload reattaches
const SIZE_KEY = "xo-shells-dock";  // localStorage: the dock's height and whether it is minimised
const POLL_LIST = 15000;            // while the list is on screen
const POLL_IDLE = 60000;            // otherwise: the sidebar count and the badges stay roughly right

/** @template T @param {Storage} store @param {string} k @param {T} d @returns {T} */
const sget = (store, k, d) => { try { return JSON.parse(/** @type {string} */ (store.getItem(k))) ?? d; } catch { return d; } };
/** @param {Storage} store @param {string} k @param {unknown} v */
const sset = (store, k, v) => { try { store.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } };

/** @param {import('./dock-types.js').DockOptions} [options] */
export function createShells({ PROJ = (p) => p, notify = () => {}, onChange = () => {}, announce = () => {}, wanted = () => true } = {}) {
  const root = /** @type {HTMLElement} */ (document.getElementById("shd"));
  const side = /** @type {HTMLElement} */ (document.getElementById("nv-shells"));
  const saved = sget(localStorage, SIZE_KEY, /** @type {{min?: boolean, h?: number}} */ ({}));
  const was = sget(sessionStorage, OPEN_KEY, /** @type {import("./dock-types.js").DockSnapshot | null} */ (null)); // read before the first render writes it over
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
    sset(sessionStorage, OPEN_KEY, { tabs: R.order, active: R.active, open: R.open, filter: R.filter });
    sset(localStorage, SIZE_KEY, { h: R.h, min: R.min });
  }
  const changed = () => { render(); persist(); onChange(); };

  let pollT = 0;
  async function refresh({ status = false } = {}) {
    clearTimeout(pollT);
    try {
      if (status || !R.statusAt || Date.now() - R.statusAt > POLL_IDLE - 1000) {
        const s = await api.terminalStatus();
        R.statusAt = Date.now();
        const was = R.enabled;
        R.enabled = !!s.enabled; R.reason = s.reason || null;
        if (was && !R.enabled) offNow(R.reason);
      }
      if (R.enabled) {
        const d = await api.terminals();
        R.list = d.terminals || [];
        R.loaded = true; R.err = null;
      }
    } catch (err) {
      // a backend without /api/terminal (404) has no shells; anything else keeps what we had
      if ((/** @type {import("./dock-types.js").DockError} */ (err)).status === 404 && !R.loaded) R.enabled = false;
      else R.err = (/** @type {import("./dock-types.js").DockError} */ (err)).message;
    }
    changed();
    clearTimeout(pollT); // another refresh may have finished meanwhile: keep one timer
    pollT = setTimeout(refresh, listShown() ? POLL_LIST : POLL_IDLE);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden && R.enabled) refresh(); });

  /** Shells were turned off under us: every tab ends, and the UI goes away. @param {string | null} reason */
  function offNow(reason) {
    for (const id of [...R.order]) detach(id, { quiet: true });
    R.open = false;
    if (reason) notify({ kind: "stopped", text: "Shells are off", sub: reason });
  }

  /** @param {string} id @param {{ticket?: string | null, focus?: boolean}} [options] */
  function attach(id, { ticket = null, focus = true } = {}) {
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
    R.active = id; R.open = true; R.min = false;
    R.edit = null;
    render(); persist();
    const tab = R.tabs.get(id);
    if (tab) requestAnimationFrame(() => { tab.handle.refit(); if (focus) tab.handle.focus(); });
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
  let cdT = 0;
  function countdown() {
    if (cdT) return;
    cdT = setInterval(() => {
      let any = false;
      for (const tab of R.tabs.values()) {
        if (tab.state !== "retrying" || !tab.until) continue;
        any = true;
        const n = tab.pane.querySelector(".shd-note [data-left]");
        if (n) n.textContent = String(Math.max(1, Math.ceil((tab.until - Date.now()) / 1000)));
      }
      if (!any) { clearInterval(cdT); cdT = 0; }
    }, 250);
  }
  let soonT = 0;
  const refreshSoon = () => { clearTimeout(soonT); soonT = setTimeout(() => refresh(), 600); };

  /** @param {{project?: string, name: string | null, path?: string}} body @param {string} where */
  async function create(body, where) {
    if (!R.enabled || !wanted() || R.opening) return; // one shell per press: a second click while it opens opens nothing
    R.opening = true; render();
    try {
      const d = await api.openTerminal(body);
      R.opening = false;
      upsert(d.terminal);
      attach(d.terminal.id, { ticket: d.ticket });
      announce(`Shell open in ${where}`);
    } catch (err) {
      const had = root.contains(document.activeElement) || document.activeElement === document.body;
      R.opening = false; render();
      if (had && !root.contains(document.activeElement)) /** @type {HTMLButtonElement | null} */ (listEl.querySelector("[data-sh-new]"))?.focus(); // refused: back on New shell
      notify({ kind: "stopped", text: "Couldn't open a shell", sub: (/** @type {import("./dock-types.js").DockError} */ (err)).message });
      announce(`Couldn't open a shell: ${(/** @type {import("./dock-types.js").DockError} */ (err)).message}`);
      if ((/** @type {import("./dock-types.js").DockError} */ (err)).code === "terminal_disabled") refresh({ status: true });
    }
  }
  /** The project's Shell button: a new shell in its folder, or its list when it has some already. @param {string} pid */
  function openProject(pid, { fresh = false } = {}) {
    if (!fresh && runningOf(R.list, pid).length) return showList(pid);
    return create({ project: pid, name: nameFor(PROJ(pid)) }, PROJ(pid));
  }
  function openWorkspace({ fresh = false } = {}) {
    if (!fresh && R.list.some((t) => isRunning(t) && t.scope === "workspace")) return showList("workspace");
    return create({ name: "Workspace" }, "the workspace");
  }
  /** @param {{project: string, chatId: string, ts: string, title: string}} thread */
  async function openThread({ project, chatId, ts, title }) {
    if (!project || project === "workspace") return create({ name: nameFor(title) || "Workspace" }, "the workspace");
    let path = null;
    try {
      const d = await api.worktrees(chatId);
      const w = (d.worktrees || []).find((/** @type {{thread_ts: string, exists?: boolean, error?: string, path?: string}} */ x) => x.thread_ts === ts && x.exists !== false && !x.error);
      path = w ? w.path : null;
    } catch { /* no worktree list: the project folder it is */ }
    const there = path && R.list.find((t) => isRunning(t) && t.project === project && (t.path === path || t.cwd === path));
    if (there) return attach(there.id);
    return create({ project, ...(path ? { path } : {}), name: nameFor(title) || nameFor(PROJ(project)) }, path ? "the thread's worktree" : PROJ(project));
  }
  /** @param {string | null} [filter] */
  function showList(filter = null) {
    R.filter = filter;
    R.confirm = null;
    activate(LIST);
  }
  /** The toggle key: open (where you left off), minimise, or open again. */
  function toggle() {
    if (!R.enabled || !wanted()) return;
    if (!R.open) { activate(R.active); return; }
    // Keep focus on the minimize button when it was pressed.
    const onMin = !!document.activeElement?.closest?.("[data-sh-min]");
    R.min = !R.min;
    changed();
    if (!R.min) activate(R.active, { focus: !onMin });
    else if (!onMin && root.contains(document.activeElement)) away();
  }

  const { askClose, keepIt, closeShell, askCloseDetached, closeDetached, startRename, renameBack, saveRename } = createDockActions(R, {
    root, listEl, confirmEl, LIST, byId, upsert, nameOf, render, changed, detach, refreshSoon, notify, announce,
  });
  const { PHONE, refit } = bindDockInput(R, {
    root, side, listEl, tabsEl, grip, LIST, showList, toggle, activate, detach, attach, startRename, askClose,
    openProject, openWorkspace, askCloseDetached, changed, keepIt, closeShell, closeDetached, away, saveRename,
    render, renameBack, owns, persist,
  });

  /** Is this key event the shell's (inside a terminal), so the app's shortcuts must leave it alone? @param {Event} e */
  function owns(e) {
    const el = /** @type {Element | null} */ (e.target);
    return !!(el && el.closest && el.closest("#shd .xterm"));
  }

  (async () => {
    await refresh({ status: true });
    if (!R.enabled || !was) return;
    R.filter = was.filter ?? null;
    for (const id of was.tabs || []) if (isRunning(byId(id))) attach(id, { focus: false });
    const active = was.active === LIST || R.tabs.has(was.active) ? was.active : R.order[0] || LIST;
    R.open = !!was.open && (R.tabs.size > 0 || active === LIST);
    R.active = active;
    changed();
    R.tabs.get(R.active)?.handle.refit();
  })();

  return {
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
    hide() { if (!R.open) return; R.open = false; changed(); away(); },
    /** On a phone, is the shells sheet up over the page (so Back puts it away first)? */
    get raised() { return PHONE.matches && R.enabled && wanted() && R.open && !R.min; },
    /** Back on a phone: half height first, then away behind the sidebar's toggle. */
    lower() {
      if (!(PHONE.matches && R.open && !R.min)) return false;
      if (!R.half) { R.half = true; render(); refit(); return true; }
      R.min = true; R.half = false; changed();
      away();
      return true;
    },
  };
}
