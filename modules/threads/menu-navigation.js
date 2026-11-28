// @ts-check

import { entryInput } from "../../core/ui/a11y/focus.js";

/** @typedef {ReturnType<typeof entryInput>} EntryInput */

/** @typedef {{ thread: (id: string) => { id: string, project: string } | null | undefined }} Threads */

/** @typedef {{ go: (view: string) => void, showThread: (id: string, input: EntryInput) => void }} Navigation */

/** @param {Threads & Navigation & { inStage: () => boolean, closeMenu: () => void }} options */
export function createThreadMenuNavigation({ thread, go, showThread, inStage, closeMenu }) {
  /** @param {Element} target @param {MouseEvent} event */
  return function navigateMenu(target, event) {
    const next = target.closest("[data-tgo]");
    if (next) {
      const view = next.getAttribute("data-tgo");
      if (next.getAttribute("aria-disabled") === "true" || !view) return true;
      const stage = inStage(), input = entryInput(event);
      closeMenu();
      if (stage && view.startsWith("t:")) showThread(view.slice(2), input);
      else go(view);
      return true;
    }
    const side = target.closest("[data-tside]")?.getAttribute("data-tside");
    if (!side) return false;
    const row = thread(side), input = entryInput(event);
    closeMenu();
    if (row) {
      go("p:" + row.project);
      showThread(row.id, input);
    }
    return true;
  };
}
