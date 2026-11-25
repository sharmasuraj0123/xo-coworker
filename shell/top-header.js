// @ts-check

import { esc } from "../core/platform/index.js";
import { $ } from "../core/platform/dom.js";
import { ICON } from "../core/ui/icons/names.js";
import { redraw } from "../core/ui/redraw.js";
import { headerActionsHtml } from "./header.js";
import { createSurfaceSlots } from "./surfaces.js";

/** @import { HeaderThread as Thread, HeaderNeed as Need, HeaderDeps } from "./header-types.d.ts" */

/** @import { SurfaceScope } from "./surface-types.d.ts" */

/** @template {Thread} T @template {Need} N @param {HeaderDeps<T, N>} deps @param {SurfaceScope} scope @param {() => void} schedule */
export function createTopHeader(deps, scope, schedule) {
  const { location, convThread, isBusy, CH, STAGE, checklistRender, PROJ, conversationHeaderHtml, kernel, atOf, LP, LW, tdelRender } = deps;
  /** @type {ReturnType<typeof createSurfaceSlots<import("./app-service-types").ConversationHeaderPaint>>} */
  const drawDetails = createSurfaceSlots({
    places: kernel.places, place: "header.detail", scope, schedule, fallback: () => $("#scroller"), hideOnRetire: true,
  });
  /** @param {N[]} needs */
  function topRender(needs) {
    const v = location.view();
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
      const to = location.parentOf(v) || "p:" + t.project;
      const name = to === "home" ? "Home" : to === "ws" ? "Workspace" : PROJ(to.slice(2));
      redraw(back, `${ICON.back}<span>${esc(name)}</span>`);
      back.setAttribute("aria-label", `Back to ${name}`);
      back.title = "Back (Esc)";
    }
    const { who, controls } = conversationHeaderHtml(v, t, needs);
    if (who != null) redraw($("#top-who"), who);
    const pv = v.startsWith("p:");
    const endHtml = t ? "" : (pv ? controls + headerActionsHtml(kernel.places, atOf(v)) + LP.button(v, LW.isOpen) : "") + STAGE.button(v);
    redraw($("#top-end"), endHtml);
    LP.ensure(v);
    checklistRender(needs);
    tdelRender(t);
    const painted = { project: pv ? v.slice(2) : null, needs };
    drawDetails((id) => document.getElementById(id), painted);
    kernel.bus.emit("app:conversation-header", painted);
  }
  return topRender;
}
