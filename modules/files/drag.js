// @ts-check

import { parentOf } from "./scope.js";

/** @param {HTMLElement} host @param {() => boolean} enabled @param {(row: HTMLElement) => string | null} pathOfRow @param {(path: string) => string} base @param {(from: string, to: string) => void} moveTo */
export function wireFileDrag(host, enabled, pathOfRow, base, moveTo) {
  /** @type {{ path: string; kind: string } | null} */
  let dragging = null;
  /** @param {HTMLElement} t */
  const dropDir = (t) => { const r = t.closest && /** @type {HTMLElement | null} */ (t.closest(".fl-g > .fl-r.is-dir")); if (r) return r.dataset.flDir; return t.closest && t.closest(".fl-list") && !t.closest(".fl-r, .fl-secs") ? "" : null; };
  /** @param {string | null | undefined} to */
  const fits = (to) => dragging && to != null && to !== parentOf(dragging.path) && to !== dragging.path && !to.startsWith(dragging.path + "/");

  /** @type {Element | null} */
  let over = null;
  /** @param {Element | null} el */
  const mark = (el) => { if (over === el) return; over?.classList.remove("is-drop"); over = el; el?.classList.add("is-drop"); };
  host.addEventListener("dragstart", (e) => {
    const t = /** @type {HTMLElement} */ (e.target);
    const r = t.closest && /** @type {HTMLElement | null} */ (t.closest(".fl-g > .fl-r[draggable]"));
    if (!r || !enabled()) return;
    dragging = { path: /** @type {string} */ (pathOfRow(r)), kind: r.dataset.flDir != null ? "dir" : "file" };
    /** @type {DataTransfer} */ (e.dataTransfer).effectAllowed = "move";

    /** @type {DataTransfer} */ (e.dataTransfer).setData("text/plain", dragging.path);
  });
  host.addEventListener("dragover", (e) => {
    const to = dropDir(/** @type {HTMLElement} */ (e.target));
    if (!fits(to)) { mark(null); return; }
    e.preventDefault(); /** @type {DataTransfer} */ (e.dataTransfer).dropEffect = "move";
    mark(to ? /** @type {HTMLElement} */ (e.target).closest(".fl-r") : /** @type {HTMLElement} */ (e.target).closest(".fl-list"));
  });
  host.addEventListener("dragleave", (e) => { if (!host.contains(/** @type {Node | null} */ (e.relatedTarget))) mark(null); });
  host.addEventListener("dragend", () => { dragging = null; mark(null); });
  host.addEventListener("drop", (e) => {
    const to = dropDir(/** @type {HTMLElement} */ (e.target)), d = dragging;
    mark(null); dragging = null;
    if (!d || !fits(to)) return;
    e.preventDefault();
    moveTo(d.path, to ? `${to}/${base(d.path)}` : base(d.path));
  });
}
