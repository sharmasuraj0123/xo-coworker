// @ts-check

import { $ } from "../../core/platform/dom.js";
import { expand } from "../../core/ui/motion.js";

/** @typedef {import("./all-types").AllThreadsDeps["S"]} AllState */

/** @param {{S: AllState, convProject: (view: string) => string | null | undefined, allEl: HTMLElement, field: HTMLInputElement, phone: MediaQueryList, allRender: () => void, schedule: () => void, syncInert: () => void, go: (view: string) => unknown}} deps */
export function createAllThreadsSheet({ allEl, field, phone: PHONE, S, convProject, allRender, schedule, syncInert, go }) {
  /** @type {HTMLElement | null} */
  let allReturn = null;
  /** @param {HTMLElement | null} anchor */
  function openAll(anchor = null) {
    if (!convProject(S.view) || convProject(S.view) === "workspace") return;
    allReturn = /** @type {HTMLElement | null} */ (document.activeElement);
    const drop = !!anchor && !PHONE.matches;
    allEl.classList.toggle("is-drop", drop);
    if (drop) {
      const r = anchor.getBoundingClientRect();
      const w = Math.min(480, innerWidth - 32);
      allEl.style.setProperty("--dx", `${Math.max(16, Math.round(r.right - w))}px`);
      allEl.style.setProperty("--dy", `${Math.round(r.bottom + 8)}px`);
      allEl.style.setProperty("--dw", `${w}px`);
    }
    S.allFilter = "all"; S.allDone = false;
    field.value = "";
    allRender();
    allEl.hidden = false;
    field.focus();
    schedule();
  }
  function closeAll() {
    if (allEl.hidden) return;
    allEl.hidden = true; syncInert();
    /** @param {Element | null} el */
    const shown = (el) => el && el.isConnected && el.getClientRects().length > 0;
    const back = shown(allReturn) ? allReturn : [.../** @type {NodeListOf<HTMLElement>} */ (document.querySelectorAll("[data-switch]"))].find(shown);
    back?.focus({ preventScroll: true });
    schedule();
  }
  field.addEventListener("input", allRender);
  allEl.addEventListener("keydown", (e) => {
    if (e.isComposing || e.keyCode === 229) { e.stopPropagation(); return; } // the IME's keys, not the switcher's or the page's
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const target = /** @type {Element} */ (e.target);
    const inSearch = target === field;
    if (e.key === "/" && !inSearch && !target.closest?.("input, textarea, [contenteditable]")) { e.preventDefault(); e.stopPropagation(); field.focus(); field.select(); return; }
    if (e.key === "Escape" && inSearch && field.value) { e.preventDefault(); e.stopPropagation(); field.value = ""; allRender(); return; }
    if (e.key !== "ArrowDown" && e.key !== "ArrowUp" && !(inSearch && e.key === "Enter")) return;
    const rows = [.../** @type {NodeListOf<HTMLElement>} */ (allEl.querySelectorAll(".all-list [data-go]"))].filter((b) => b.offsetParent);
    if (inSearch) {
      if (!rows.length || e.key === "ArrowUp") return;
      e.preventDefault();
      if (e.key === "ArrowDown") rows[0].focus();
      else { allEl.hidden = true; go(/** @type {string} */ (rows[0].dataset.go)); }
      return;
    }
    const i = rows.indexOf(/** @type {HTMLElement} */ (document.activeElement));
    if (i < 0) return;
    e.preventDefault();
    if (e.key === "ArrowUp" && i === 0) { field.focus(); return; }
    rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === "ArrowDown" ? 1 : -1)))].focus();
  });
  allEl.addEventListener("click", (e) => {
    const target = /** @type {Element} */ (e.target);
    if (target === allEl || target.closest("[data-close]")) { closeAll(); return; }
    const f = /** @type {HTMLElement | null} */ (target.closest("[data-af]"));
    if (f) { S.allFilter = /** @type {AllState["allFilter"]} */ (f.dataset.af); allRender(); return; }
    if (target.closest("[data-all-done]")) {
      const box = $(".ar-done");
      S.allDone = !S.allDone;
      /** @type {Element} */ (box.querySelector(".ar-fold")).setAttribute("aria-expanded", String(S.allDone));
      expand(box, box.querySelector(".ar-db"), S.allDone);
      return;
    }
    const g = /** @type {HTMLElement | null} */ (target.closest("[data-go]"));
    if (g) { allEl.hidden = true; go(/** @type {string} */ (g.dataset.go)); }
  });
  return { openAll, closeAll };
}
