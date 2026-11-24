// @ts-check

// The header's buttons that come from the header.action place (an app's), drawn as XO's own and pressed through their entry.

import { esc } from "../core/platform/index.js";
import { xi, hasIcon } from "../core/ui/icons/icon.js";
import { $ } from "../core/platform/dom.js";
import { ICON } from "../core/ui/icons/names.js";
import { patch, redraw } from "../core/ui/redraw.js";

/** @typedef {import("../core/kernel/types").Kernel["places"]} Places @typedef {import("../core/kernel/types").At} At */

/** The buttons for where you are, in the place's order. @param {Places} places @param {At} at */
export function headerActionsHtml(places, at) {
  return places.entries("header.action", at).map((/** @type {any} */ e) =>
    `<button type="button" class="tw-act" data-header-action="${esc(e.id)}" title="${esc(e.label)}">${hasIcon(e.icon) ? xi(e.icon) : ""}<span>${esc(e.label)}</span></button>`).join("");
}

/** A press on one runs its entry's onPress with where you are. @param {Places} places @param {() => At} at @param {Pick<Document, "addEventListener">} [root] */
export function wireHeaderActions(places, at, root = document) {
  root.addEventListener("click", (e) => {
    const b = /** @type {any} */ (e.target)?.closest?.("[data-header-action]");
    if (b) /** @type {any} */ (places.get("header.action", b.dataset.headerAction))?.onPress(at());
  });
}

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
      if (v !== "chats") { patch(back, `${ICON.back}<span>Chats</span>`); back.setAttribute("aria-label", "Back to Chats"); back.title = "Back (Esc)"; }
      patch($("#top-who"), CH.headHtml(v));
      patch($("#top-end"), STAGE.button(v));
      checklistRender(needs);
      return;
    }
    if (t) {
      const to = S.parent[v] || "p:" + t.project;
      const name = to === "home" ? "Home" : to === "ws" ? "Workspace" : PROJ(to.slice(2));
      patch(back, `${ICON.back}<span>${esc(name)}</span>`);
      back.setAttribute("aria-label", `Back to ${name}`);
      back.title = "Back (Esc)";
    }
    const end = "", who = conversationHeaderHtml(v, t, needs);
    if (who != null && $("#top-who")._h !== who) { redraw($("#top-who"), who); $("#top-who")._h = who; }
    const pv = v.startsWith("p:");
    const endHtml = t ? end : end + (pv ? S.hdrCtl + headerActionsHtml(kernel.places, atOf(v)) + LP.button(v, LW.isOpen) : "") + STAGE.button(v);
    if ($("#top-end")._h !== endHtml) { redraw($("#top-end"), endHtml); $("#top-end")._h = endHtml; }
    LP.ensure(v);
    checklistRender(needs);
    tdelRender(t);
    REC.sinceLine(v.startsWith("p:") ? v.slice(2) : null, needs);
  }
  return topRender;
}
