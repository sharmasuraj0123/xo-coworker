// @ts-check

// Keys for choices drawn as buttons (WAI-ARIA APG), a radio group and a menu: one delegated keydown listener each, no state.

const OPTION = '[role="radio"]';
const ITEM = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';
/** @param {KeyboardEvent} e */
const plain = (e) => !e.altKey && !e.ctrlKey && !e.metaKey;

/** Can it take focus and a choice: not disabled (either way) and drawn. @param {any} el @returns {boolean} */
export const usable = (el) => !!el && !el.disabled && el.getAttribute("aria-disabled") !== "true" && el.getClientRects().length > 0;

/** From index i (or -1, or n), the first index dir (±1) steps away, wrapping round n items, that ok() accepts; -1 if none. @param {number} n @param {number} i @param {number} dir @param {(j: number) => boolean} ok */
export function step(n, i, dir, ok) {
  for (let k = 1; k <= n; k++) {
    const j = (((i + dir * k) % n) + n) % n;
    if (ok(j)) return j;
  }
  return -1;
}

/** Only the chosen option, else the first, is in the Tab order. @param {unknown} on */
export const rovingTab = (on, first = false) => (on || first ? "" : ' tabindex="-1"');

/** Arrows move through any radiogroup inside root, choosing as they go unless follow is false; Space or Enter choose. @param {Element} root */
export function radioKeys(root, { follow = true } = {}) {
  root.addEventListener("keydown", (ev) => {
    const e = /** @type {KeyboardEvent} */ (ev);
    if (!plain(e) || e.isComposing) return;
    const r = /** @type {any} */ (e.target).closest?.(OPTION);
    const group = r && r.closest('[role="radiogroup"]');
    if (!group || !root.contains(group)) return;
    const choose = e.key === " " ? r.tagName !== "BUTTON" : e.key === "Enter" ? !follow && r.tagName !== "BUTTON" : false;
    if (choose) { e.preventDefault(); if (usable(r) && r.getAttribute("aria-checked") !== "true") r.click(); return; }
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    /** @type {HTMLElement[]} */
    const all = [...group.querySelectorAll(OPTION)];
    const j = step(all.length, all.indexOf(r), dir, (k) => usable(all[k]));
    if (j < 0 || all[j] === r) return;
    const to = all[j];
    to.focus();
    if (follow && to.getAttribute("aria-checked") !== "true") to.click();
  });
}

/** A mouse moving onto a usable menu item focuses it while focus is in that menu, on its open button, or nowhere. @param {Element} root */
export function pointerFollows(root, sel = ITEM) {
  root.addEventListener("pointermove", (ev) => {
    const e = /** @type {PointerEvent} */ (ev), tg = /** @type {any} */ (e.target);
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const it = tg && tg.closest ? tg.closest(sel) : null, menu = it && it.closest('[role="menu"]');
    if (!it || !menu || !root.contains(it) || !usable(it)) return;
    const a = typeof document !== "undefined" ? document.activeElement : null;
    if (a === it) return;
    const opener = !!a && a.getAttribute && a.getAttribute("aria-haspopup") === "menu" && a.getAttribute("aria-expanded") === "true";
    if (a && a.tagName !== "BODY" && !menu.contains(a) && !opener) return;
    it.focus({ preventScroll: true });
  });
}

/** Arrows, Home, End and a letter move through any menu inside root; Escape and Tab call close(menu, key), which puts focus back on the menu's button (Tab then goes on from there). @param {Element} root @param {{ close?: (menu: Element, key: string) => void }} [opts] */
export function menuKeys(root, { close } = {}) {
  pointerFollows(root);
  root.addEventListener("keydown", (ev) => {
    const e = /** @type {KeyboardEvent} */ (ev), tg = /** @type {any} */ (e.target);
    if (!plain(e) || e.isComposing) return;
    const menu = tg.closest?.('[role="menu"]');
    if (!menu || !root.contains(menu)) return;
    if (e.key === "Escape" || e.key === "Tab") {
      if (!close) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); }
      close(menu, e.key);
      return;
    }
    /** @type {HTMLElement[]} */
    const items = [...menu.querySelectorAll(ITEM)];
    const n = items.length;
    const ok = (/** @type {number} */ k) => usable(items[k]);
    const i = items.indexOf(tg.closest(ITEM));
    let j;
    if (e.key === "ArrowDown") j = step(n, i, 1, ok);
    else if (e.key === "ArrowUp") j = step(n, i < 0 ? n : i, -1, ok);
    else if (e.key === "Home") j = step(n, -1, 1, ok);
    else if (e.key === "End") j = step(n, n, -1, ok);
    else if (e.key.length === 1 && e.key !== " ") {
      const c = e.key.toLowerCase();
      j = step(n, i, 1, (k) => ok(k) && (items[k].textContent || "").trim().toLowerCase().startsWith(c));
      if (j < 0) return;
    } else return;
    e.preventDefault();
    if (j >= 0) items[j].focus();
  });
}
