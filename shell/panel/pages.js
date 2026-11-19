// @ts-check

// The panel's pages: it shows its sections, or one page in their place (Shell, Files, Thread).

import { ICON } from "../../js/ui.js";
import { esc } from "../../core/platform/index.js";

/** @typedef {{ name: string, key: string }} Tab */

/** @typedef {import("../../core/kernel/types").At} At */

/** @typedef {{ title?: string | ((key: string) => string), icon?: string | ((key: string) => string), width?: number | ((o: { room: number }) => number), single?: boolean, lead?: (key: string) => string, act?: (name: string, el: Element) => void, mount: (host: HTMLElement, at: At & { key: string }) => void | (() => void), onShow?: (key: string, o: { focus: boolean }) => void, onHide?: (key: string) => void, unmount?: (key: string) => void, canClose?: (key: string) => boolean | Promise<boolean>, escape?: (key: string) => boolean }} PageSpec */

/** @typedef {{ el: any, S: any, places: import("../../core/kernel/types").Kernel["places"], at: () => At, icon: (name: string) => string, view: () => string, threads: ((v: string) => Array<{ k: string, rows: any[] }>) | null, shell: any, nameOf: () => (v: string) => string, open: (o?: { focus?: boolean }) => void, close: () => void, setFull: (on: boolean) => void, apply: () => void, paint: () => void, onChange: any }} PagesDeps */

/** A title or an icon, given as it is or worked out from the tab's key. @param {string | ((key: string) => string) | undefined} v @param {string} key */
const said = (v, key) => (typeof v === "function" ? v(key) : v || "");

const TAB_MAX = 5;

/** @param {PagesDeps} P */
export function createPages({ el, S, places, at, icon, view, threads, shell, nameOf, open, close, setFull, apply, paint, onChange }) {
  // the pages are the kernel's panel.page entries; registering a kind again replaces it
  const PAGES = { get: (/** @type {string} */ name) => /** @type {PageSpec} */ (/** @type {unknown} */ (places.get("panel.page", name))) };
  /** @type {Map<string, () => void>} */
  const mine = new Map();
  /** @type {Map<string, any>} */
  const BOXES = new Map();
  Object.assign(S, { page: null, tabs: [] });
  /** @param {Tab | null | undefined} a @param {Tab | null | undefined} b */
  const sameTab = (a, b) => !!a && !!b && a.name === b.name && a.key === b.key;
  /** @param {string} name @param {unknown} key @returns {Tab} */
  const tabOf = (name, key) => { const sp = PAGES.get(name); return { name, key: sp && sp.single ? name : String(key) }; };
  /** @param {string} name @param {PageSpec} spec */
  function page(name, spec) { replacing = true; try { mine.get(name)?.(); } finally { replacing = false; } mine.set(name, places.contribute("panel.page", { ...spec, id: name }, "xo.shell")); }
  let replacing = false;
  // a page whose entry is withdrawn (an app turned off or removed) goes with its tab and its own undo; there's nothing left to ask
  places.watch("panel.page", () => { if (!replacing) for (const t of S.tabs.filter((/** @type {Tab} */ x) => !PAGES.get(x.name))) withdrawn(t); });
  /** @param {Tab} t */
  function withdrawn(t) {
    const id = `${t.name}\u0000${t.key}`, was = sameTab(S.page, t);
    BOXES.get(id)?._off?.(); BOXES.get(id)?.remove(); BOXES.delete(id);
    S.tabs = S.tabs.filter((/** @type {Tab} */ x) => x !== t);
    if (!was) { pageChanged(); return; }
    S.page = null;
    const prev = S.tabs[S.tabs.length - 1];
    if (prev) show(prev.name, prev.key); else { delete el.dataset.page; el.classList.remove("is-shell"); if (S.full) setFull(false); apply(); pageChanged(); }
  }
  /** A page kind's own box in the host: made on its first show, hidden while another shows, gone with its tab. @param {Tab} t */
  function boxFor(t) {
    const id = `${t.name}\u0000${t.key}`;
    let b = BOXES.get(id);
    if (!b) { b = document.createElement("div"); b.className = "stg-pg"; b.dataset.pg = t.name; el.querySelector(".stg-page").append(b); BOXES.set(id, b); b._new = true; }
    return b;
  }
  /** @param {Tab} t */
  const ask = async (t) => { const sp = PAGES.get(t.name); try { return !sp.canClose || (await sp.canClose(t.key)) !== false; } catch { return false; } };
  /** @param {string} name @param {{ focus?: boolean, at?: At }} [opts] */
  function show(name, key = name, opts = {}) {
    const { focus = false, at: from = {} } = opts;
    const sp = PAGES.get(name);
    if (!sp) return false;
    const next = tabOf(name, key), shownKey = String(key);
    if (!S.tabs.some((/** @type {Tab} */ t) => sameTab(t, next))) { S.tabs.push(next); evict(next); }
    if (sp.single) S.single = { ...(S.single || {}), [name]: shownKey }; // what the one tab shows now (its title)
    if (!S.open) open({ focus: false });
    const was = S.page;
    if (!sameTab(was, next)) {
      if (was) { PAGES.get(was.name).onHide?.(was.key); boxFor(was).hidden = true; }
      // one write: the switch and the width, nothing measured between
      S.page = next;
      el.dataset.page = name;
      el.classList.toggle("is-shell", name === "shell");
      if (S.full !== !!S.fullOf?.[name]) setFull(!!S.fullOf?.[name]); // full size belongs to the page
      apply();
      const box = boxFor(next);
      box.hidden = false;
      if (box._new) { box._new = false; const off = sp.mount(box, { ...at(), ...from, key: next.key }); if (typeof off === "function") box._off = off; }
    }
    if (from.full && !S.full) setFull(true);
    sp.onShow?.(shownKey, { focus });
    pageChanged();
    return true;
  }
  /** Over TAB_MAX: the oldest tab that isn't showing goes if it lets itself; one that refuses is skipped. @param {Tab} keep */
  async function evict(keep) {
    let n = S.tabs.length - TAB_MAX;
    for (const t of [...S.tabs]) {
      if (n <= 0) break;
      if (sameTab(t, S.page) || sameTab(t, keep)) continue;
      if (await ask(t)) { drop(t); n--; }
    }
    if (n < S.tabs.length - TAB_MAX + 1) pageChanged();
  }
  function sections({ paint: draw = true } = {}) {
    if (!S.page) return;
    const t = S.page;
    // focus in the page or on its head goes to that page's tab, else the panel
    const had = el.contains(document.activeElement);
    PAGES.get(t.name).onHide?.(t.key);
    boxFor(t).hidden = true;
    S.fullOf = { ...(S.fullOf || {}), [t.name]: S.full };
    S.page = null;
    delete el.dataset.page;
    el.classList.remove("is-shell");
    if (S.full) setFull(false); // the sections come back at their own width
    apply();
    if (draw) pageChanged();
    if (had && S.open) (el.querySelector(`[data-stg-tab="${CSS.escape(t.name)}"], [data-stg-page="${CSS.escape(t.name)}"]`) || el).focus({ preventScroll: true });
  }
  /** A tab goes: its page's own ×, or more than TAB_MAX. Asked first (canClose); refused, it stays. @param {string} name */
  async function closeTab(name, key = name) {
    const t = S.tabs.find((/** @type {Tab} */ x) => sameTab(x, tabOf(name, key)));
    if (!t) return true;
    if (!(await ask(t))) return false;
    const was = sameTab(S.page, t);
    drop(t);
    if (was) { const prev = S.tabs[S.tabs.length - 1]; if (prev) show(prev.name, prev.key); else { delete el.dataset.page; el.classList.remove("is-shell"); if (S.full) setFull(false); apply(); pageChanged(); } }
    else pageChanged();
    return true;
  }
  /** @param {Tab} t */
  function drop(t) {
    const sp = PAGES.get(t.name), id = `${t.name}\u0000${t.key}`;
    if (sameTab(S.page, t)) { sp.onHide?.(t.key); S.page = null; }
    sp.unmount?.(t.key);
    BOXES.get(id)?._off?.();
    BOXES.get(id)?.remove(); BOXES.delete(id);
    S.tabs = S.tabs.filter((/** @type {Tab} */ x) => x !== t);
  }
  /** The panel's × and Esc closing it: every open page is asked first (an unsaved file), then it closes. */
  async function requestClose() {
    for (const t of [...S.tabs]) if (!(await ask(t))) { if (!sameTab(S.page, t)) show(t.name, t.key, { focus: true }); return false; }
    close();
    return true;
  }
  /** Something in the sections needs you while a page is up: ‹ Sections says so. */
  const sectionsNeed = () => { const tg = threads ? threads(view()) : null; return !!tg && tg.some((g) => g.k === "needs" && g.rows.length); };
  function pageChanged() {
    const b = el.querySelector("[data-stg-shell]");
    if (b) { const on = S.page?.name === "shell"; b.setAttribute("aria-pressed", String(on)); b.classList.toggle("is-on", on); b.title = on ? "Back to Threads, Changes and Map" : "A shell here, in the panel"; }
    S.h.head = ""; paint();
    onChange && onChange();
  }
  // Shell mode is the page "shell": the shells' own dock moved into the panel in place of its frames (shell(on, host))
  if (shell) page("shell", { title: () => "Shell", mount: () => {}, onShow: () => shell(true, boxFor(S.page)), onHide: () => shell(false), unmount: () => {} });
  /** @param {boolean} on */
  function setShell(on) {
    if (!shell || (S.page?.name === "shell") === !!on) return;
    if (on) show("shell"); else closeTab("shell");
  }

  /** The panel's name, the place it's beside; with a page, ‹ Sections, the page's lead control and its tabs. */
  function titleHtml() {
    const place = nameOf()(view());
    const cur = S.page && PAGES.get(S.page.name);
    const titleOf = (/** @type {Tab} */ t) => { const sp = PAGES.get(t.name), k = sp.single ? (S.single?.[t.name] ?? t.key) : t.key; return sp.title ? said(sp.title, k) : t.name; };
    // ‹ Sections leads any page but the shell, with a dot when the sections need you
    const back = S.page && S.page.name !== "shell" ? `<button type="button" class="stg-ic pg-back" data-stg-sections title="Back to Threads, Changes and Map (Esc)" aria-label="Sections${sectionsNeed() ? ", something needs you" : ""}">${ICON.back}${sectionsNeed() ? '<i class="pg-dot" aria-hidden="true"></i>' : ""}</button>` : "";
    const lead = cur && cur.lead ? cur.lead(S.page.key) || "" : "";
    // on the sections, what the pages keep stays one click away as its tab, beside the place
    if (S.tabs.length > 1 || (!S.page && S.tabs.length)) return `${S.page ? (back || `<button type="button" class="stg-ic pg-back" data-stg-sections title="Back to Threads, Changes and Map (Esc)" aria-label="Sections">${ICON.back}</button>`) + lead : `<b class="stg-name" title="${esc(place || "")}">${esc(place || "Panel")}</b>`}<span class="pg-tabs" role="tablist" aria-label="Open in the panel">${S.tabs.map((/** @type {Tab} */ t) => {
      const on = sameTab(t, S.page), sp = PAGES.get(t.name), tt = titleOf(t);
      return `<button type="button" class="pg-tab${on ? " is-on" : ""}" role="tab" aria-selected="${on}" data-stg-tab="${esc(t.name)}" data-stg-key="${esc(t.key)}" title="${esc(tt)}">${typeof sp.icon === "function" ? sp.icon(t.key) : sp.icon ? icon(sp.icon) : ""}<span>${esc(tt)}</span></button>`; }).join("")}</span>`;
    if (cur && back) return `${back}${lead}<b class="stg-name" title="${esc(titleOf(S.page))}">${esc(titleOf(S.page))}</b>`;
    return `<b class="stg-name" title="${esc(place || "")}">${esc(place || "Panel")}</b>${cur ? `<span class="stg-sub">${esc(titleOf(S.page))}</span>` : ""}`;
  }

  const pages = () => S.tabs.map((/** @type {Tab} */ t) => ({ ...t, title: said(PAGES.get(t.name).title, t.key) || t.name, on: sameTab(t, S.page) }));
  return { PAGES, page, show, sections, closeTab, requestClose, setShell, titleHtml, pages };
}
