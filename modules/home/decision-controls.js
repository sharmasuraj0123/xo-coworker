// @ts-check

import { is } from "../../core/platform/keys.js";
import { morph } from "../../core/ui/motion.js";

/** @import { DecisionControls } from "./decision-control-types.d.ts" */

/** @typedef {Pick<ReturnType<typeof import("../../core/kernel/scope.js").createScope>, "listen">} ListenerScope */

/** @param {HTMLElement} home @param {DecisionControls} actions @param {ListenerScope} scope */
export function bindHomeDecisionControls(home, { next, isBinary, decide, details }, scope) {
  scope.listen(home, "click", ({ target }) => {
    if (!(target instanceof Element)) return;
    const card = target.closest("#hm-next .next");
    if (!(card instanceof HTMLElement)) return;
    const answer = target.closest("[data-nx-opt]");
    if (answer) {
      const option = next()?.ask.options?.[Number(answer.getAttribute("data-nx-opt"))];
      if (option != null) {
        answer.classList.add("pressed");
        decide({ option });
      }
      return;
    }
    if (target.closest("[data-nx-allow]")) { decide("allow"); return; }
    const note = card.querySelector("textarea"), box = card.querySelector(".nx-note");
    if (note?.id !== "nx-note-in" || !(box instanceof HTMLElement)) return;
    if (target.closest("[data-nx-send]")) { decide("deny", note.value); return; }
    if (target.closest("[data-nx-back]")) {
      morph(card, () => { card.classList.add("noting"); box.hidden = false; }, { duration: 280, fade: box });
      note.focus({ preventScroll: true });
    } else if (target.closest("[data-nx-cancel]")) {
      morph(card, () => { card.classList.remove("noting"); box.hidden = true; }, { duration: 260 });
      card.focus({ preventScroll: true });
    }
  });

  scope.listen(home, "keydown", (event) => {
    const { target } = event;
    if (!(target instanceof Element) || !(event instanceof KeyboardEvent)) return;
    if (target instanceof HTMLTextAreaElement && target.id === "nx-note-in") {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Enter" && !event.shiftKey) ownKey(event, () => decide("deny", target.value));
      if (event.key === "Escape") ownKey(event, () => press(target.closest(".next"), "[data-nx-cancel]"));
      return;
    }
    if (!target.matches(".next") || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.repeat) { ownKey(event); return; }
    const need = next();
    if (!need || need.key !== target.getAttribute("data-key")) return;
    const glance = need.effort === "glance";
    const binary = isBinary(need.ask);
    if (glance && !binary && /^[1-9]$/.test(event.key) && Array.isArray(need.ask.options)) {
      const option = need.ask.options[Number(event.key) - 1];
      if (option != null) ownKey(event, () => decide({ option }));
    } else if (glance && binary && is(event, "allow")) {
      ownKey(event, () => decide("allow"));
    } else if (glance && is(event, "back")) {
      ownKey(event, () => press(target, "[data-nx-back]"));
    } else if (is(event, "details") || event.key === "Enter") {
      ownKey(event, () => details(need.key));
    }
  });
}

/** @param {KeyboardEvent} event @param {() => void} [run] */
function ownKey(event, run) {
  event.preventDefault();
  event.stopPropagation();
  run?.();
}

/** @param {Element | null} card @param {string} selector */
function press(card, selector) {
  const button = card?.querySelector(selector);
  if (button instanceof HTMLButtonElement) button.click();
}
