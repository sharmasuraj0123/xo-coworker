// @ts-check
import { $ } from "../../core/platform/dom.js";
import { once } from "../../core/platform/pending.js";
import { esc } from "../../core/platform/util.js";

/** @import { EditField, EditDeps, ThreadEdit } from "./editing-types.d.ts" */

/** @param {string} edVal @param {string} edBusy */
export const threadTitleInput = (edVal, edBusy) => `<input class="tw-in tw-in-t" id="tw-edit" data-tedit="title" maxlength="120" value="${esc(edVal)}" aria-label="Thread name"${edBusy}>`;

/** @param {string} edVal @param {string} edBusy */
export const threadLabelInput = (edVal, edBusy) => `<input class="tw-in tw-in-l" id="tw-edit" data-tedit="label" maxlength="32" value="${esc(edVal)}" placeholder="A short label" aria-label="Label"${edBusy}>`;

/** @param {EditDeps} options */
export function createThreadEditing({ S, world, render, schedule, announce, heraldShow, composerAt }) {
  function closeThreadMenu({ focus = true } = {}) {
    if (!S.tMenu) return;
    const back = focus && !!document.activeElement?.closest?.(".tw-menu");
    const opener = S.tMenuIn === "page" ? "#tpacts [data-tmenu]" : "#top-who [data-tmenu]";
    S.tMenu = null; S.tMenuIn = null; $("#top-who")._h = null; if ($("#tphead")) $("#tphead")._h = "";
    if (!back) { schedule(); return; }
    render();
    $(opener)?.focus({ preventScroll: true });
  }

  /** @param {string} tid @param {EditField} field */
  function startThreadEdit(tid, field) {
    const t = world.thread(tid);
    if (!t) return;
    S.tEdit = { tid, field, value: field === "title" ? t.title : t.label || "" };
    $("#top-who")._h = null;
    render();
    const inp = $("#tw-edit");
    if (inp) { inp.focus(); inp.select(); }
  }

  /** @param {ThreadEdit} edit */
  function endThreadEdit(edit) {
    if (S.tEdit !== edit) return;
    const had = document.activeElement?.id === "tw-edit";
    S.tEdit = null; $("#top-who")._h = null; render();
    if (had) $("[data-tmenu]")?.focus({ preventScroll: true });
  }

  /** @param {string} tid @param {EditField} field @param {string} value */
  function saveThreadField(tid, field, value) {
    const edit = S.tEdit && S.tEdit.tid === tid && S.tEdit.field === field ? S.tEdit : null;
    const t = world.thread(tid);
    if (!t) { if (edit) endThreadEdit(edit); return Promise.resolve(); }
    const v = String(value || "").trim();
    if ((field === "title" && (!v || v === t.title)) || (field === "label" && v === (t.label || ""))) { if (edit) endThreadEdit(edit); return Promise.resolve(); }
    return once(`thread-edit:${tid}:${field}`, async () => {
      if (edit) { edit.value = value; edit.busy = true; }
      const inp = edit && $("#tw-edit");
      if (inp) { inp.readOnly = true; inp.setAttribute("aria-busy", "true"); }
      try {
        await world.act.editThread(tid, field === "title" ? { title: v.slice(0, 120) } : { label: v ? v.slice(0, 32) : null });
      } catch (err) {
        if (edit) { edit.busy = false; edit.failed = value; }
        if (inp && inp.isConnected) { inp.readOnly = false; inp.removeAttribute("aria-busy"); }
        announce(`${field === "title" ? "Couldn't rename it" : "Couldn't change the label"}. ${(/** @type {Error} */ (err)).message} What you typed is kept.`);
        heraldShow({ kind: "stopped", text: field === "title" ? "Couldn't rename it" : "Couldn't change the label", sub: (/** @type {Error} */ (err)).message }, 6000);
        return;
      }
      announce(field === "title" ? `Renamed to ${v}.` : v ? `Labelled ${v}.` : "Label removed.");
      if (edit) endThreadEdit(edit);
    });
  }

  /** @param {string} tid @param {HTMLElement | null} btn */
  async function unfreeze(tid, btn) {
    const th = world.thread(tid);
    if (!th || btn?.getAttribute("aria-busy") === "true") return;
    if (btn) { btn.setAttribute("aria-disabled", "true"); btn.setAttribute("aria-busy", "true"); }
    try {
      await world.act.editThread(th.id, { paused: false });
      if (btn && btn.isConnected && btn === document.activeElement) { const K = composerAt(btn); S.focusNext = [() => K.say, () => K.conv.scroller]; }
      announce("Picked back up. Its agent can carry on here.");
      schedule();
    } catch (err) { announce(`Couldn't pick it back up: ${(/** @type {Error} */ (err)).message}`); if (btn) { btn.removeAttribute("aria-disabled"); btn.removeAttribute("aria-busy"); } }
  }
  return { closeThreadMenu, startThreadEdit, endThreadEdit, saveThreadField, unfreeze };
}
