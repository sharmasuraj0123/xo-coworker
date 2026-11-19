// @ts-check

// Settings pages from the settings.section place: a tab and a page each; the entry draws its own .set-live under the title when it opens.

/** @param {import("./types").SectionsDeps} deps */
export function createSettingsSections({ places, nav, pages, at, pick, isOpen, onTabs = () => {} }) {
  /** @type {Map<string, { tab: HTMLButtonElement, page: HTMLElement, live: HTMLElement, entry: import("./types").SectionEntry, undo?: () => void }>} */
  const shown = new Map();
  const refused = new Set();
  /** @param {string} id */
  function leave(id) {
    const s = shown.get(id);
    const undo = s && s.undo;
    if (!s || !undo) return;
    s.undo = undefined;
    try { undo(); } catch (e) { console.error(`settings.section "${id}": its undo threw`, e); }
  }
  /** @param {import("./types").SectionEntry} e */
  function add(e) {
    const tab = document.createElement("button");
    Object.assign(tab, { type: "button", id: `set-t-${e.id}`, tabIndex: -1 });
    tab.setAttribute("role", "tab");
    tab.dataset.set = e.id;
    tab.setAttribute("aria-selected", "false");
    tab.setAttribute("aria-controls", `set-p-${e.id}`);
    const page = document.createElement("div");
    Object.assign(page, { className: "set-page", id: `set-p-${e.id}`, hidden: true });
    page.setAttribute("role", "tabpanel");
    page.setAttribute("aria-labelledby", `set-t-${e.id}`);
    page.dataset.page = e.id;
    const head = document.createElement("header"), h = document.createElement("h2"), live = document.createElement("div");
    head.className = "set-ph"; live.dataset.section = e.id;
    head.append(h); page.append(head, live);
    nav.append(tab); pages.append(page);
    return { tab, page, live, entry: e, undo: /** @type {(() => void) | undefined} */ (undefined) };
  }
  function sync() {
    const entries = /** @type {import("./types").SectionEntry[]} */ (places.entries("settings.section", at()));
    const tabsNow = () => [...nav.children].filter((el) => [...shown.values()].some((s) => s.tab === el));
    const was = tabsNow();
    const ids = new Set(entries.map((e) => e.id));
    for (const [id, s] of shown) {
      if (ids.has(id)) continue;
      const open = !s.page.hidden, a = document.activeElement, had = !!a && (s.tab.contains(a) || s.page.contains(a));
      leave(id); s.tab.remove(); s.page.remove(); shown.delete(id);
      if (open) pick(/** @type {HTMLElement} */ (nav.querySelector("[data-set]")).dataset.set || "general");
      if (had) /** @type {HTMLElement | null} */ (nav.querySelector('[aria-selected="true"]'))?.focus({ preventScroll: true });
    }
    const seen = new Set();
    for (const e of entries) {
      const taken = seen.has(e.id) || (!shown.has(e.id) && nav.querySelector(`[data-set="${CSS.escape(e.id)}"]`));
      seen.add(e.id);
      if (taken) { if (!refused.has(e.id)) console.error(`settings.section "${e.id}": a Settings page already has that id`); refused.add(e.id); continue; }
      const s = shown.get(e.id) || add(e);
      s.entry = e;
      s.tab.textContent = e.label;
      /** @type {HTMLElement} */ (s.page.querySelector("h2")).textContent = e.label;
      shown.set(e.id, s);
      if (!s.page.hidden && !s.undo && isOpen()) show(e.id);
    }
    const mine = tabsNow();
    const want = [...new Set(entries.map((e) => shown.get(e.id)?.tab).filter((x) => !!x))];
    if (want.some((el, i) => mine[i] !== el)) for (const el of want) nav.append(/** @type {HTMLElement} */ (el));
    if (want.length !== was.length || want.some((el, i) => was[i] !== el)) onTabs();
  }
  /** A Settings page was opened: a section's entry draws it now; any other section that was drawn lets go. @param {string} id */
  function show(id) {
    for (const other of shown.keys()) if (other !== id) leave(other);
    const s = shown.get(id);
    if (!s) return;
    leave(id);
    let r;
    try { r = s.entry.render(s.live, at()); } catch (e) { console.error(`settings.section "${id}": its render threw`, e); }
    s.undo = typeof r === "function" ? r : undefined;
  }
  const unwatch = places.watch("settings.section", sync);
  sync();
  return {
    show,
    hide() { for (const id of shown.keys()) leave(id); },
    resume() { for (const [id, s] of shown) if (!s.page.hidden) show(id); },
    destroy() { unwatch(); for (const [id, s] of shown) { leave(id); s.tab.remove(); s.page.remove(); } shown.clear(); },
  };
}
