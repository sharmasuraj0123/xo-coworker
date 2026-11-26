// @ts-check

import { $$, findHtml, isHtml, requireHtml } from "../../core/platform/dom.js";
import { focusOpened, pointerFollows } from "../../core/ui/a11y/keynav.js";

/** @import { Side, SideDeps } from "./side-types.d.ts" */

/** @param {EventTarget | null} target @param {string} selector */
function control(target, selector) {
  const node = target instanceof Element ? target.closest(selector) : null;
  return node instanceof HTMLElement ? node : null;
}

/** @typedef {{ scope: NonNullable<SideDeps["scope"]>, side: Side } & Pick<SideDeps, "announce" | "toggleJump">} Events */

/** @param {Events} deps */
export function listenSide({ scope, side, announce, toggleJump }) {
  const pop = requireHtml("#side-more");
  scope.listen(requireHtml("#side-fold", "button"), "click", () => side.fold(!side.folded));
  scope.listen(requireHtml("#side-jump", "button"), "click", toggleJump);
  scope.listen(requireHtml("#nv-more", "button"), "click", (event) => {
    if (pop.hidden) side.openMore(/** @type {MouseEvent} */ (event));
    else side.closeMore({ focus: true });
  });
  scope.effect(() => pointerFollows(pop));
  scope.listen(pop, "click", (event) => {
    const { target } = event;
    const pin = control(target, "[data-side-pin]")?.dataset.sidePin;
    if (pin) {
      side.pin(pin, true);
      announce(`${side.byId(pin).name} is in the sidebar`);
      focusOpened(pop, /** @type {MouseEvent} */ (event));
      return;
    }
    if (control(target, "[data-side-edit]")) { side.edit(true); return; }
    const button = control(target, "[data-se-sw]");
    const id = button?.dataset.seSw;
    if (id) {
      const on = button?.getAttribute("aria-checked") !== "true";
      side.pin(id, on);
      announce(`${side.byId(id).name}: ${on ? "in the sidebar" : "in More"}`);
      findHtml(`[data-se-sw="${id}"]`, undefined, pop)?.focus({ preventScroll: true });
      return;
    }
    if (control(target, "[data-se-reset]")) {
      side.reset();
      announce("The sidebar is back to its default");
      findHtml("[data-se-done]", undefined, pop)?.focus({ preventScroll: true });
      return;
    }
    if (control(target, "[data-se-done]")) { side.edit(false); return; }
    if (control(target, "[data-set-open],[data-go]")) side.closeMore();
  });
  scope.listen(pop, "keydown", (event) => {
    const e = /** @type {KeyboardEvent} */ (event);
    const id = control(e.target, "[data-se-grip]")?.dataset.seGrip;
    const arrow = e.key === "ArrowDown" ? 1 : e.key === "ArrowUp" ? -1 : 0;
    if (id && arrow && !e.metaKey && !e.ctrlKey) {
      e.preventDefault();
      side.move(id, arrow);
      const { order } = side.bar();
      announce(`${side.byId(id).name}: ${order.indexOf(id) + 1} of ${order.length}`);
      findHtml(`[data-se-grip="${id}"]`, undefined, pop)?.focus({ preventScroll: true });
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      if (side.editing) side.edit(false);
      else side.closeMore({ focus: true });
      return;
    }
    if (!side.editing && arrow) {
      e.preventDefault();
      const items = $$('[role="menuitem"]', pop).filter(isHtml);
      const i = items.findIndex(item => item === document.activeElement);
      const j = i < 0 ? (arrow === 1 ? 0 : items.length - 1) : (i + arrow + items.length) % items.length;
      items[j]?.focus({ preventScroll: true });
    }
  });
  listenDrag(scope, pop, side);
  scope.listen(document, "pointerdown", ({ target }) => {
    if (!pop.hidden && !(target instanceof Element && target.closest("#side-more,#nv-more"))) side.closeMore();
  });
}

/** @param {NonNullable<SideDeps["scope"]>} scope @param {HTMLElement} pop @param {Side} side */
function listenDrag(scope, pop, side) {
  const mime = "text/x-xo-place";
  /** @param {DragEvent} event @param {HTMLElement} row */
  const isAfter = (event, row) => event.clientY > row.getBoundingClientRect().top + row.offsetHeight / 2;
  /** @param {HTMLElement | null} [except] */
  const clearDrop = (except = null) => {
    for (const row of pop.querySelectorAll(".se-row.is-over")) {
      if (row !== except) row.classList.remove("is-over", "is-after");
    }
  };
  scope.listen(pop, "dragstart", (event) => {
    const e = /** @type {DragEvent} */ (event), row = control(e.target, ".se-row");
    if (!row?.dataset.se || !e.dataTransfer) return;
    e.dataTransfer.setData(mime, row.dataset.se);
    e.dataTransfer.effectAllowed = "move";
    row.classList.add("is-drag");
  });
  scope.listen(pop, "dragend", ({ target }) => {
    control(target, ".se-row")?.classList.remove("is-drag");
    clearDrop();
  });
  scope.listen(pop, "dragover", (event) => {
    const e = /** @type {DragEvent} */ (event), row = control(e.target, ".se-row");
    if (!row || !e.dataTransfer) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    clearDrop(row);
    row.classList.add("is-over");
    row.classList.toggle("is-after", isAfter(e, row));
  });
  scope.listen(pop, "drop", (event) => {
    const e = /** @type {DragEvent} */ (event), row = control(e.target, ".se-row"), id = e.dataTransfer?.getData(mime);
    if (!row || !id || row.dataset.se === id || !side.all().some((place) => place.id === id)) return;
    e.preventDefault();
    const next = isAfter(e, row) ? row.nextElementSibling?.getAttribute("data-se") ?? "" : row.dataset.se;
    if (next !== id) side.move(id, 0, next);
  });
}
