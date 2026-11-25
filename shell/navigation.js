// @ts-check

import { requireHtml } from "../core/platform/dom.js";
import { focusDestination } from "./navigation-focus.js";

/** @param {import("./navigation-types").NavigationDeps} deps */
export function createNavigation({ location, bus, say, scroller, pageEl, convThread }) {
  /** @type {Set<import("./navigation-types").LeaveGuard>} */
  const guards = new Set();
  /** @param {string} v @param {import("./navigation-types").NavigationOptions} options */
  function go(v, options = {}) {
    if (!v) return;
    const previous = location.view();
    const { from, focus = false, carry = false, panel = false, still = false } = options;
    if (v !== previous) {
      for (const allow of guards) if (!allow(() => go(v, options))) return;
    }
    bus.emit("app:view-preparing", { changed: v !== previous, panel });
    if (v === previous) { if (focus) say.focus(); return; }
    const page = pageEl(previous);
    if (page) location.saveScroll(previous, page.scrollTop);
    const deeper = v.startsWith("t:") && !previous.startsWith("t:");
    const backFrom = from?.startsWith("t:") ? from : null;
    bus.emit("app:view-leaving", { from: previous, to: v });
    location.visit(v, options);
    bus.emit("app:view-visited");
    const el = pageEl(v) || requireHtml("#column");
    el.classList.remove("enter-r", "enter-l", "enter", "enter-up");
    void el.offsetWidth;
    if (!still) el.classList.add(carry ? "enter-up" : deeper ? "enter-r" : backFrom ? "enter-l" : "enter");
    bus.emit("app:view-restoring");
    bus.emit("app:render");
    const opened = pageEl(v);
    if (opened) opened.scrollTop = location.scrollOf(v);
    const row = backFrom && location.takeReturnRow(backFrom, v);
    bus.emit("app:return-target", focusDestination({ row, backFrom, composer: focus ? say : null, region: opened || scroller }));
  }
  function back() {
    const v = location.view();
    if (v.startsWith("c:")) go("chats", { from: "t:", remember: false });
    else if (v.startsWith("t:")) go(location.parentOf(v) || "p:" + convThread(v)?.project, { from: v, remember: false });
  }
  return {
    go, back,
    /** @param {import("./navigation-types").LeaveGuard} guard */
    beforeLeave(guard) { guards.add(guard); return () => { guards.delete(guard); }; },
  };
}
