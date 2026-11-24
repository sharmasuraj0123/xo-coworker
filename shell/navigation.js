// @ts-check

import { $ } from "../core/platform/dom.js";
import { focusDestination } from "./navigation-focus.js";

/** @param {import("./navigation-types").NavigationDeps} deps */
export function createNavigation({
  location, VW, STAGE, IQ, PHONE, REC, clearDock, clearThreadEdit, say, scroller, closeSettings,
  setDrawer, saveDraft, follow, pageEl, loadDraft, render, returnPill, convThread,
}) {
  /** @param {string} v @param {import("./navigation-types").NavigationOptions} options */
  function go(v, options = {}) {
    if (!v) return;
    const previous = location.view();
    const { from, focus = false, carry = false, panel = false, still = false } = options;
    if (v !== previous && VW.editing) { VW.leave(() => go(v, options)); return; }
    clearThreadEdit();
    if (v !== previous) STAGE.leave();
    closeSettings({ restore: false });
    setDrawer(false);
    IQ.close({ restore: false });
    if (panel && v !== previous && PHONE.matches && STAGE.isOpen) STAGE.close({ restore: false, quiet: true });
    if (v === previous) { if (focus) say.focus(); return; }
    const page = pageEl(previous);
    if (page) location.saveScroll(previous, page.scrollTop);
    saveDraft();
    const deeper = v.startsWith("t:") && !previous.startsWith("t:");
    const backFrom = from?.startsWith("t:") ? from : null;
    REC.leave(previous, v);
    location.visit(v, options);
    follow();
    clearDock();
    const el = pageEl(v) || $("#column");
    el.classList.remove("enter-r", "enter-l", "enter", "enter-up");
    void el.offsetWidth;
    if (!still) el.classList.add(carry ? "enter-up" : deeper ? "enter-r" : backFrom ? "enter-l" : "enter");
    loadDraft();
    render();
    const opened = pageEl(v);
    if (opened) opened.scrollTop = location.scrollOf(v);
    const row = backFrom && location.takeReturnRow(backFrom, v);
    returnPill(focusDestination({ row, backFrom, composer: focus ? say : null, region: opened || scroller }));
  }
  function back() {
    const v = location.view();
    if (v.startsWith("c:")) go("chats", { from: "t:", remember: false });
    else if (v.startsWith("t:")) go(location.parentOf(v) || "p:" + convThread(v)?.project, { from: v, remember: false });
  }
  return { go, back };
}
