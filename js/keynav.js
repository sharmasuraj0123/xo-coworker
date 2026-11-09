// Keys for the two kinds of choice drawn as buttons (WAI-ARIA APG): a radio group and a menu.
// Each is one delegated keydown listener on an element that stays, so what's inside can be drawn and redrawn
// freely. Neither draws anything or keeps any state: what a choice does, and where focus goes when a menu
// closes, stay the caller's.
//
//   radioKeys(root, { follow })  any [role=radiogroup] inside root: ↓ → the next option, ↑ ← the previous,
//                                wrapping, skipping what's disabled or hidden. With follow (the default) the
//                                option reached is also chosen, by its own click, as a radio group does; where
//                                choosing costs something (a request), follow: false moves only, and Space or
//                                Enter chooses. Space chooses an option that isn't a <button> (a button does
//                                it natively).
//   rovingTab(on, first)         the attribute for an option's markup: only the chosen option (or, when none
//                                is, the first) is in the Tab order, so Tab enters and leaves the group in one
//                                step and lands on the choice.
//   menuKeys(root, { close })    any [role=menu] inside root: ↓ ↑ the next or previous item, wrapping; Home and
//                                End the first and last; a letter the next item starting with it. Escape and
//                                Tab call close(menu, key): the caller closes the menu and puts focus back on
//                                its button. Tab then goes on from that button, as a native menu's does; Escape
//                                ends there (it was the menu's, not the page's).

const OPTION = '[role="radio"]';
const ITEM = '[role="menuitem"], [role="menuitemradio"], [role="menuitemcheckbox"]';
const plain = (e) => !e.altKey && !e.ctrlKey && !e.metaKey;

/** Can it take focus and a choice: not disabled (either way) and drawn. */
export const usable = (el) => !!el && !el.disabled && el.getAttribute("aria-disabled") !== "true" && el.getClientRects().length > 0;

/** From index i, the first index dir (±1) steps away, wrapping round n items, that ok() accepts; -1 if none.
 *  i may be -1 (before the first) or n (after the last). */
export function step(n, i, dir, ok) {
  for (let k = 1; k <= n; k++) {
    const j = (((i + dir * k) % n) + n) % n;
    if (ok(j)) return j;
  }
  return -1;
}

export const rovingTab = (on, first = false) => (on || first ? "" : ' tabindex="-1"');

export function radioKeys(root, { follow = true } = {}) {
  root.addEventListener("keydown", (e) => {
    if (!plain(e) || e.isComposing) return;
    const r = e.target.closest?.(OPTION);
    const group = r && r.closest('[role="radiogroup"]');
    if (!group || !root.contains(group)) return;
    const choose = e.key === " " ? r.tagName !== "BUTTON" : e.key === "Enter" ? !follow && r.tagName !== "BUTTON" : false;
    if (choose) { e.preventDefault(); if (usable(r) && r.getAttribute("aria-checked") !== "true") r.click(); return; }
    const dir = e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : e.key === "ArrowUp" || e.key === "ArrowLeft" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const all = [...group.querySelectorAll(OPTION)];
    const j = step(all.length, all.indexOf(r), dir, (k) => usable(all[k]));
    if (j < 0 || all[j] === r) return;
    const to = all[j];
    to.focus();
    if (follow && to.getAttribute("aria-checked") !== "true") to.click();
  });
}

/** The pointer and the keyboard share one active item, as a macOS menu does: a mouse moving onto a menu's usable
 *  item, while focus is in that menu, focuses it, so hover never paints a second item Enter won't choose, and the
 *  arrows carry on from it. A touch moving, or focus elsewhere, moves nothing (Astra C058 on 517af1c: two items
 *  looked active). menuKeys brings it; a menu with keys of its own calls it. */
export function pointerFollows(root, sel = ITEM) {
  root.addEventListener("pointermove", (e) => {
    if (e.pointerType && e.pointerType !== "mouse" && e.pointerType !== "pen") return;
    const it = e.target && e.target.closest ? e.target.closest(sel) : null, menu = it && it.closest('[role="menu"]');
    if (!it || !menu || !root.contains(it) || !usable(it)) return;
    const a = typeof document !== "undefined" ? document.activeElement : null;
    if (a === it || !a || !menu.contains(a)) return;
    it.focus({ preventScroll: true });
  });
}

export function menuKeys(root, { close } = {}) {
  pointerFollows(root);
  root.addEventListener("keydown", (e) => {
    if (!plain(e) || e.isComposing) return;
    const menu = e.target.closest?.('[role="menu"]');
    if (!menu || !root.contains(menu)) return;
    if (e.key === "Escape" || e.key === "Tab") {
      if (!close) return;
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); }
      close(menu, e.key);
      return;
    }
    const items = [...menu.querySelectorAll(ITEM)];
    const n = items.length;
    const ok = (k) => usable(items[k]);
    const i = items.indexOf(e.target.closest(ITEM));
    let j;
    if (e.key === "ArrowDown") j = step(n, i, 1, ok);
    else if (e.key === "ArrowUp") j = step(n, i < 0 ? n : i, -1, ok);
    else if (e.key === "Home") j = step(n, -1, 1, ok);
    else if (e.key === "End") j = step(n, n, -1, ok);
    else if (e.key.length === 1 && e.key !== " ") {
      const c = e.key.toLowerCase();
      j = step(n, i, 1, (k) => ok(k) && items[k].textContent.trim().toLowerCase().startsWith(c));
      if (j < 0) return;
    } else return;
    e.preventDefault();
    if (j >= 0) items[j].focus();
  });
}
