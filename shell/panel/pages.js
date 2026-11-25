// @ts-check

import { esc, reportFailure } from "../../core/platform/index.js";
import { ICON } from "../../core/ui/icons/names.js";
import { RM } from "../../core/ui/motion.js";

/** @typedef {{ name: string, key: string }} Page */

/** @typedef {import("../../core/kernel/types").At} At */

/** @typedef {import("../../core/ui/a11y/focus.js").EntryInput} EntryInput */

/** @typedef {{ title?: string | ((key: string) => string), backTo?: (key: string) => string, lead?: (key: string) => string, act?: (name: string, el: Element) => void, mount?: (host: HTMLElement, at: At & { key: string }) => void | (() => void), onShow?: (key: string, opts: { focus: boolean }) => void, focusEntry?: (heading: HTMLElement | null, input: EntryInput) => void, onHide?: (key: string) => void, close?: (key: string) => void, canClose?: (key: string) => boolean | Promise<boolean>, up?: (key: string) => boolean, escape?: (key: string) => boolean, over?: boolean }} PageSpec */

/** @typedef {{ el: HTMLElement, S: { page: Page | null, under: Page | null, open: boolean }, places: import("../../core/kernel/types").Kernel["places"], at: () => At, view: () => string, threads: ((view: string) => { k: string, rows: unknown[] }[]) | null, shell: ((on: boolean, host?: HTMLElement, view?: string) => void) | null, nameOf: () => (view: string) => string, placeless: () => boolean, open: (opts?: { focus?: boolean }) => void, close: () => void, paint: () => void, onChange?: () => void }} PagesDeps */

/** @param {PagesDeps} deps */
export function createPages({ el, S, places, at, view, threads, shell, nameOf, placeless, open, close, paint, onChange }) {
  const PAGES = { get: (/** @type {string} */ name) => /** @type {PageSpec | undefined} */ (places.get("panel.page", name)) };
  /** @type {Map<string, HTMLElement>} */
  const boxes = new Map();
  /** @type {Map<string, (() => void) | undefined>} */
  const mounts = new Map();
  /** @type {Map<string, () => void>} */
  const registered = new Map();
  S.page = S.under = null;
  let replacing = false;

  /** @param {string} name @param {PageSpec} spec */
  function page(name, spec) {
    replacing = true;
    try { registered.get(name)?.(); } finally { replacing = false; }
    registered.set(name, places.contribute("panel.page", { ...spec, id: name }, "xo.shell"));
  }

  places.watch("panel.page", () => {
    if (replacing) return;
    for (const [name, box] of boxes) {
      if (PAGES.get(name)) continue;
      closePage(name);
      mounts.get(name)?.();
      mounts.delete(name);
      boxes.delete(name);
      box.remove();
    }
    reflect();
  });

  /** @param {string} name */
  function boxFor(name) {
    let box = boxes.get(name);
    if (!box) {
      box = document.createElement("div");
      box.className = "stg-pg";
      box.dataset.pg = name;
      box.hidden = true;
      el.querySelector(".stg-page")?.append(box);
      boxes.set(name, box);
    }
    return box;
  }

  /** @param {Page} entry */
  function pageTitle(entry) {
    const title = PAGES.get(entry.name)?.title;
    return (typeof title === "function" ? title(entry.key) : title) || entry.name;
  }

  /** @type {{ duration: number, easing: string, offset: string } | null} */
  let motion = null;
  /** @param {HTMLElement} box @param {"in" | "out"} direction @param {() => void} done */
  function slide(box, direction, done) {
    box.getAnimations().forEach((animation) => animation.cancel());
    if (!motion) {
      const css = getComputedStyle(document.documentElement);
      motion = { duration: parseFloat(css.getPropertyValue("--d-sheet")) || 240, easing: css.getPropertyValue("--ease").trim() || "ease", offset: css.getPropertyValue("--s-3").trim() };
    }
    const from = { opacity: 0, transform: `translateX(${motion.offset})` };
    const to = { opacity: 1, transform: "none" };
    const animation = box.animate(direction === "in" ? [from, to] : [to, from], motion);
    animation.finished.then(done, () => {});
  }

  function reflect() {
    if (S.page) el.dataset.stgPage = S.page.name; else delete el.dataset.stgPage;
    const filesButton = reflectButton("[data-open-files]", S.page?.name === "files");
    if (filesButton) {
      filesButton.hidden = !PAGES.get("files");
      if (filesButton.hidden && document.activeElement === filesButton) el.focus({ preventScroll: true });
    }
    const shellButton = reflectButton("[data-stg-shell]", S.page?.name === "shell");
    if (shellButton) shellButton.title = S.page?.name === "shell" ? (S.under ? `Back to ${pageTitle(S.under)}` : "Back to Threads, Changes and Map") : S.page?.name === "thread" ? "A shell in this thread's worktree" : "A shell here, in the panel";
  }
  function pageChanged() { paint(); onChange?.(); }

  /** @param {string} selector @param {boolean} on */
  function reflectButton(selector, on) {
    const button = /** @type {HTMLElement | null} */ (el.querySelector(selector));
    if (button) { button.setAttribute("aria-pressed", String(on)); button.classList.toggle("is-on", on); }
    return button;
  }

  /** @param {Page} entry @param {boolean} shown */
  function shut(entry, shown) {
    const spec = PAGES.get(entry.name);
    if (shown) spec?.onHide?.(entry.key);
    spec?.close?.(entry.key);
  }

  /** @param {PageSpec | undefined} spec @param {EntryInput} input */
  function focusPage(spec, input) {
    spec?.focusEntry?.(el.querySelector("[data-page-heading]"), input);
  }

  /** @param {string} name @param {string} [key] @param {{ focus?: boolean, at?: At, input?: EntryInput }} [options] */
  function show(name, key = name, { focus = false, at: from = {}, input = "keyboard" } = {}) {
    const spec = PAGES.get(name);
    if (!spec || placeless()) return false;
    const next = { name, key: String(key) };
    const fresh = !S.open;
    if (fresh) open({ focus: false });
    if (S.page?.name === name) {
      S.page = next;
      spec.onShow?.(next.key, { focus });
      pageChanged();
      if (focus && S.page === next) focusPage(spec, input);
      return true;
    }
    const prev = S.page;
    const keep = (name === "shell" || spec.over) && prev && !S.under ? prev : null;
    for (const entry of [prev, S.under]) if (entry && entry !== keep) shut(entry, entry === prev);
    if (keep) PAGES.get(keep.name)?.onHide?.(keep.key);
    S.under = keep;
    S.page = next;
    const box = boxFor(name);
    const old = prev ? boxes.get(prev.name) : null;
    box.hidden = false;
    if (!mounts.has(name)) {
      const undo = spec.mount?.(box, { ...at(), ...from, key: next.key });
      mounts.set(name, typeof undo === "function" ? undo : undefined);
    }
    spec.onShow?.(next.key, { focus });
    const settle = () => {
      box.style.zIndex = "";
      if (S.page?.name !== name) return;
      if (old && old !== box) old.hidden = true;
      el.classList.add("is-covered");
    };
    if (fresh || RM.matches) settle();
    else { box.style.zIndex = "1"; slide(box, "in", settle); }
    pageChanged();
    if (focus && S.page === next) focusPage(spec, input);
    return true;
  }

  /** @param {EntryInput} [input] */
  function back(input = "keyboard") {
    if (!S.page) return;
    const entry = S.page, under = S.under, box = boxFor(entry.name);
    const from = document.activeElement, had = el.contains(from);
    if (under) boxFor(under.name).hidden = false;
    shut(entry, true);
    const keepFocus = had && document.activeElement === from;
    S.page = under;
    S.under = null;
    if (under) PAGES.get(under.name)?.onShow?.(under.key, { focus: keepFocus });
    else el.classList.remove("is-covered");
    box.style.zIndex = "1";
    const gone = () => { box.style.zIndex = ""; if (S.page?.name !== entry.name) box.hidden = true; };
    if (RM.matches) gone(); else slide(box, "out", gone);
    pageChanged();
    if (keepFocus && under && S.page === under) focusPage(PAGES.get(under.name), input);
    if (keepFocus && !under && S.open) el.focus({ preventScroll: true });
  }

  function dropPages() {
    if (!S.page) return;
    shut(S.page, true);
    if (S.under) shut(S.under, false);
    for (const box of boxes.values()) {
      box.getAnimations().forEach((animation) => animation.cancel());
      box.hidden = true;
      box.style.zIndex = "";
    }
    S.page = S.under = null;
    el.classList.remove("is-covered");
    pageChanged();
  }

  /** @param {string} name */
  function closePage(name) {
    if (S.page?.name === name) back();
    else if (S.under?.name === name) {
      shut(S.under, false);
      boxFor(name).hidden = true;
      S.under = null;
      pageChanged();
    }
  }

  async function requestClose() {
    for (const entry of [S.page, S.under]) {
      if (!entry) continue;
      try { if ((await PAGES.get(entry.name)?.canClose?.(entry.key)) === false) return false; }
      catch (error) { reportFailure(error); return false; }
    }
    close();
    return true;
  }

  if (shell) page("shell", {
    title: (key) => `Shell · ${S.under ? pageTitle(S.under) : nameOf()(key || view())}`,
    mount: () => {},
    onShow: (key) => shell(true, boxFor("shell"), key),
    onHide: () => shell(false),
  });

  /** @param {boolean} on */
  function setShell(on) {
    if (!shell || (S.page?.name === "shell") === on) return;
    if (on) show("shell", S.page?.name === "thread" ? `t:${S.page.key}` : view());
    else back();
  }

  function titleHtml() {
    if (!S.page) return "";
    const spec = PAGES.get(S.page.name);
    const title = pageTitle(S.page);
    const to = spec?.backTo?.(S.page.key) || (S.under ? pageTitle(S.under) : "Threads, Changes and Map");
    const need = !S.under && threads?.(view()).some((group) => group.k === "needs" && group.rows.length);
    const back = `<button type="button" class="stg-ic pg-back" data-stg-sections title="Back to ${esc(to)} (Esc)" aria-label="Back to ${esc(to)}${need ? ", something needs you" : ""}">${ICON.back}${need ? '<i class="pg-dot" aria-hidden="true"></i>' : ""}</button>`;
    const lead = spec?.lead?.(S.page.key) || "";
    const heading = spec?.focusEntry ? ' data-page-heading role="heading" aria-level="2" tabindex="-1"' : "";
    return `${back}${lead}<b class="stg-name"${heading} title="${esc(title)}">${esc(title)}</b>`;
  }

  return { PAGES, page, show, back, closePage, dropPages, requestClose, setShell, reflect, titleHtml };
}
