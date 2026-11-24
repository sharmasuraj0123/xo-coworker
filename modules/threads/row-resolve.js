// @ts-check

import { esc } from "../../core/platform/util.js";
import { whenWorld } from "../../core/services/world/when.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @param {import("./row-resolve-types.d.ts").ResolveRowDeps} options */
export function createRowResolve({ world, resolveThread, allEl, allRender }) {
  /** @param {string} tid @param {boolean} resolved @param {HTMLElement & { _redraw?: ReturnType<typeof setTimeout> }} li */
  return function resolveFromRow(tid, resolved, li) {
    const t = world.thread(tid);
    const name = t ? t.title : "";
    li.classList.remove("is-swiping", "is-armed");
    li.innerHTML = `<p class="ar-undo"><span></span><button type="button" data-ar-undo hidden></button></p>`;
    const box = /** @type {HTMLElement} */ (li.firstElementChild), line = /** @type {HTMLElement} */ (box.firstElementChild), btn = /** @type {HTMLButtonElement} */ (box.lastElementChild);
    /** @type {(() => void) | null} */
    let next = null;
    /** @param {string} html @param {string} [label] */
    const show = (html, label, err = false) => {
      line.innerHTML = html;
      box.classList.toggle("is-err", err);
      if (label === undefined) return;
      btn.hidden = !label;
      if (label) btn.textContent = label;
    };
    /** @param {boolean} to */
    const act = (to) => {
      const busy = (/** @type {boolean} */ on) => { if (on) { box.setAttribute("aria-busy", "true"); btn.setAttribute("aria-busy", "true"); btn.setAttribute("aria-disabled", "true"); } else { box.removeAttribute("aria-busy"); btn.removeAttribute("aria-busy"); btn.removeAttribute("aria-disabled"); } };
      busy(true);
      show(`<i class="spin" aria-hidden="true"></i><b>${to ? "Resolving" : "Reopening"}</b> ${esc(name)}`);
      resolveThread(tid, to, { undo: false, sayFail: false }).then(({ ok, why }) => {
        busy(false);
        if (!li.isConnected) return;
        line.title = ok ? "" : why || "";
        if (ok && to === resolved) {
          show(`${ICON.check}<b>${resolved ? "Resolved" : "Reopened"}</b> ${esc(name)}`, "Undo");
          next = () => act(!resolved);
          clearTimeout(li._redraw);
          li._redraw = setTimeout(() => { if (li.isConnected && !li.contains(document.activeElement) && !allEl.hidden) allRender(); }, 5000);
        } else if (ok) {
          clearTimeout(li._redraw);
          whenWorld(world, () => (world.thread(tid)?.state === "resolved") === to, () => {
            if (!li.isConnected || allEl.hidden) return;
            const had = li.contains(document.activeElement);
            allRender();
            if (had) (/** @type {HTMLElement | null} */ (allEl.querySelector(`#all-list [data-go="t:${CSS.escape(tid)}"]`)))?.focus({ preventScroll: true });
          });
        } else {
          show(`${ICON.close}<b>${to ? "Couldn't resolve" : "Couldn't reopen"}</b> ${esc(name)}`, "Retry", true);
          next = () => act(to);
        }
      });
    };
    btn.addEventListener("click", () => { if (btn.getAttribute("aria-busy") !== "true" && next) next(); });
    act(resolved);
  }
}
