// @ts-check

import { once } from "../../core/platform/pending.js";
import { redraw } from "../../core/ui/redraw.js";
import { closeDialog, createDialog } from "../../core/ui/components/dialog.js";
import { bodyOf, problemOf, readForm, sentenceHtml, withDay } from "./form.js";

/** @import { FormOptions, FormValues, SideDeps } from "./types" */

const BUSY = "au-save:new";
const REDRAWN = ["repeat", "chat", "date", "persona"];

/** What the form offers: agents, runtimes, the runtime's models. @param {SideDeps} deps @param {FormValues} v @returns {FormOptions} */
export function optionsOf(deps, v, problem = "", busy = "", loaded = () => {}) {
  const rt = v.persona ? null : v.runtime ?? deps.mainRuntime?.() ?? null;
  return { projects: deps.projects(), problem, busy, agents: deps.agentsFor?.(v.chat) ?? null, runtimes: deps.runtimes?.() ?? [],
    models: rt ? deps.models?.(rt, loaded) ?? [] : [] };
}

/** Whether a change to this field redraws the form. @param {EventTarget | null} el */
export const redraws = (el) => el instanceof Element && REDRAWN.includes(el.getAttribute("name") ?? "");

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
    redraw(box, sentenceHtml(values, optionsOf(deps, values, problem, BUSY, paint)));
  }

  function close() {
    values = null;
    if (box) closeDialog(box);
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
    if (!redraws(e.target)) return;
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
      const rt = start.persona || start.runtime ? start.runtime : deps.mainRuntime?.() ?? null;
      values = { ...start, runtime: rt }; problem = "";
      const d = box ??= make();
      if (!d.hasAttribute("open") || d.classList.contains("is-closing")) d.replaceChildren();
      d.classList.remove("is-closing");
      paint();
      if (!d.hasAttribute("open")) { if (typeof d.showModal === "function") d.showModal(); else d.setAttribute("open", ""); }
      const text = d.querySelector("textarea[name=prompt]");
      if (text instanceof HTMLElement) text.focus({ preventScroll: true });
    },
    get shown() { return !!values; },
    /** Esc closes it; true when it did. */
    escape() { if (!values) return false; close(); return true; },
    repaint: paint,
    dispose() { values = null; box?.remove(); box = null; },
  };
}
