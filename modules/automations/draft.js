// @ts-check

import { once } from "../../core/platform/pending.js";
import { redraw } from "../../core/ui/redraw.js";
import { createDialog } from "../../core/ui/components/dialog.js";
import { bodyOf, problemOf, readForm, sentenceHtml, withDay } from "./form.js";

/** @import { FormValues, SideDeps } from "./types" */

const BUSY = "au-save:new";

/** A new automation, as one sentence in a dialog. @param {SideDeps} deps @param {(id: string) => void} made */
export function createDraft(deps, made) {
  const now = deps.now ?? Date.now;
  /** @type {HTMLDialogElement | null} */
  let box = null;
  /** @type {FormValues | null} */
  let values = null;
  let problem = "";

  const typed = () => {
    const form = box?.querySelector("form[data-au-form]");
    return values && form instanceof HTMLElement ? readForm(form, values) : values;
  };

  function paint() {
    if (!box || !values) return;
    redraw(box, sentenceHtml(values, { projects: deps.projects(), problem, busy: BUSY, agents: deps.agentsFor?.(values.chat) ?? null }));
  }

  function close() {
    values = null;
    if (!box?.hasAttribute("open")) return;
    if (typeof box.close === "function") box.close();
    else box.removeAttribute("open");
  }

  async function save() {
    const v = values = typed();
    if (!v) return;
    problem = problemOf(v, now());
    if (problem) { paint(); return; }
    const body = bodyOf(v, null, now());
    await once(BUSY, async () => {
      paint();
      try {
        const id = await deps.store.save(null, body);
        deps.announce(`${body.name} is on`);
        close();
        made(id);
      } catch (error) {
        problem = error instanceof Error ? error.message : "Couldn't save it.";
        deps.failed(error, "");
        paint();
      }
    });
  }

  /** @param {Event} e */
  function onClick(e) {
    const target = e.target instanceof Element ? e.target.closest("[data-au-act], [data-au-day]") : null;
    const day = target?.getAttribute("data-au-day");
    if (day != null) { const v = typed(); if (v) { values = withDay(v, Number(day)); paint(); } }
    else if (target?.getAttribute("data-au-act") === "cancel") close();
  }

  /** @param {Event} e */
  function onInput(e) {
    if (!(e.target instanceof Element) || !["repeat", "chat"].includes(e.target.getAttribute("name") ?? "")) return;
    values = typed();
    paint();
  }

  function make() {
    const d = createDialog();
    d.classList.add("au-dlg");
    d.setAttribute("aria-labelledby", "au-new-h");
    d.addEventListener("click", onClick);
    d.addEventListener("input", onInput);
    d.addEventListener("submit", (e) => { e.preventDefault(); void save(); });
    d.addEventListener("cancel", (e) => { e.preventDefault(); close(); });
    document.body.append(d);
    return d;
  }

  return {
    /** @param {FormValues} start */
    open(start) {
      values = start; problem = "";
      const d = box ??= make();
      paint();
      if (!d.hasAttribute("open")) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); }
      const text = d.querySelector("textarea[name=prompt]");
      if (text instanceof HTMLElement) text.focus({ preventScroll: true });
    },
    get shown() { return !!values; },
    /** Esc closes it; true when it did. */
    escape() { if (!values) return false; close(); return true; },
    repaint: paint,
    dispose() { close(); box?.remove(); box = null; },
  };
}
