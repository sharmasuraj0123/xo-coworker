// @ts-check

import { $ } from "../core/platform/dom.js";

/** @param {import("./navigation-types").NavigationDeps} deps */
export function createNavigation({ S, VW, STAGE, IQ, PHONE, REC, TD, tdock, say, scroller, closeSettings, setDrawer, saveScroll, saveDraft, follow, pageEl, loadDraft, render, returnPill, convThread }) {
  /** @param {string} v @param {import("./navigation-types").NavigationOptions} options */
  function go(v, { from, row = null, focus = false, carry = false, panel = false, still = false } = {}) {
    if (!v) return;
    if (v !== S.view && VW.editing) { VW.leave(() => go(v, { from, row, focus, carry, panel, still })); return; }
    S.tEdit = null; S.tMenu = null;
    if (v !== S.view) STAGE.leave();
    closeSettings({ restore: false });
    setDrawer(false);
    IQ.close({ restore: false });
    if (panel && v !== S.view && PHONE.matches && STAGE.isOpen) STAGE.close({ restore: false, quiet: true });
    if (v === S.view) { if (focus) say.focus(); return; }
    saveScroll(); saveDraft();
    if (!S.retrace && !v.startsWith("t:") && !v.startsWith("c:")) { S.trail = S.trail.filter((x) => x !== v); S.trail.push(S.view); if (S.trail.length > 30) S.trail.shift(); }
    const deeper = v.startsWith("t:") && !S.view.startsWith("t:");
    if (v.startsWith("t:")) S.parent[v] = from || (S.view.startsWith("t:") ? S.parent[S.view] : S.view);
    if (v.startsWith("t:")) S.backTo[v] = row ? { view: S.view, k: row } : null;
    const back = from && from.startsWith("t:");
    REC.leave(S.view, v);
    S.view = v;
    follow();
    TD.key = null; tdock.innerHTML = ""; tdock._ch = "";
    const el = pageEl(v) || $("#column");
    el.classList.remove("enter-r", "enter-l", "enter", "enter-up");
    void el.offsetWidth;
    if (!still) el.classList.add(carry ? "enter-up" : deeper ? "enter-r" : back ? "enter-l" : "enter");
    loadDraft();
    render();
    if (pageEl(v)) /** @type {HTMLElement} */ (pageEl(v)).scrollTop = S.scroll[v] || 0;
    const was = back ? S.backTo[from] : null;
    if (back) delete S.backTo[from];
    const left = was && was.view === v ? $("#msgs").querySelector(`:scope > [data-k="${CSS.escape(was.k)}"]`) : null;
    const target = left ? left.querySelector(`[data-go="${CSS.escape(/** @type {string} */ (from))}"]`) || left.querySelector("[data-go]") : null;
    if (focus) say.focus({ preventScroll: true });
    else if (back && target) target.focus({ preventScroll: true });
    else if (!$("#panel").contains(document.activeElement)) (pageEl(v) || scroller).focus({ preventScroll: true });
    returnPill(back && target && !focus ? target : null);
  }
  function back() {
    const v = S.view;
    S.retrace = true;
    if (v.startsWith("c:")) go("chats", { from: "t:" });
    else if (v.startsWith("t:")) go(S.parent[v] || "p:" + convThread(v)?.project, { from: v });
    S.retrace = false;
  }
  return { go, back };
}
