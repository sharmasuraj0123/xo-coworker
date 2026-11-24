// @ts-check

import { esc } from "../core/platform/index.js";
import { $ } from "../core/platform/dom.js";
import { ICON } from "../core/ui/icons/names.js";
import { redraw } from "../core/ui/redraw.js";
import { headerActionsHtml } from "./header.js";

/** @template {import("./header-types.d.ts").HeaderThread} T @template {import("./header-types.d.ts").HeaderNeed} N @param {import("./header-types.d.ts").HeaderDeps<T, N>} deps */
export function createTopHeader({ S, convThread, isBusy, CH, STAGE, checklistRender, PROJ, conversationHeaderHtml, kernel, atOf, LP, LW, tdelRender, REC }) {
  /** @param {N[]} needs */
  function topRender(needs) {
    const v = S.view;
    const t = convThread(v);
    const top = $("#top");
    top.dataset.kind = t ? "thread" : "project";
    top.dataset.state = !t ? "" : needs.some((n) => n.t.id === t.id && n.admitted) ? "need" : t.state === "failed" && !t.stop ? "stop" : isBusy(t) ? "busy" : t.state === "done" || t.state === "resolved" ? "done" : "";
    const back = $("#top-back");
    back.hidden = !t;
    if (CH.isChats(v)) {
      top.dataset.kind = v === "chats" ? "project" : "thread";
      back.hidden = v === "chats";
      if (v !== "chats") { redraw(back, `${ICON.back}<span>Chats</span>`); back.setAttribute("aria-label", "Back to Chats"); back.title = "Back (Esc)"; }
      redraw($("#top-who"), CH.headHtml(v));
      redraw($("#top-end"), STAGE.button(v));
      checklistRender(needs);
      return;
    }
    if (t) {
      const to = S.parent[v] || "p:" + t.project;
      const name = to === "home" ? "Home" : to === "ws" ? "Workspace" : PROJ(to.slice(2));
      redraw(back, `${ICON.back}<span>${esc(name)}</span>`);
      back.setAttribute("aria-label", `Back to ${name}`);
      back.title = "Back (Esc)";
    }
    const end = "", who = conversationHeaderHtml(v, t, needs);
    if (who != null) redraw($("#top-who"), who);
    const pv = v.startsWith("p:");
    const endHtml = t ? end : end + (pv ? S.hdrCtl + headerActionsHtml(kernel.places, atOf(v)) + LP.button(v, LW.isOpen) : "") + STAGE.button(v);
    redraw($("#top-end"), endHtml);
    LP.ensure(v);
    checklistRender(needs);
    tdelRender(t);
    REC.sinceLine(v.startsWith("p:") ? v.slice(2) : null, needs);
  }
  return topRender;
}
