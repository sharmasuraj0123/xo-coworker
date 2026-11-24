// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { ICON } from "../../core/ui/icons/names.js";
import { stateMark } from "../../core/ui/icons/icon.js";
import { redraw } from "../../core/ui/redraw.js";
import { menuKeys } from "../../core/ui/a11y/keynav.js";
import { heldBadge } from "../../core/services/world/held.js";
import { conversationGestures as bindConversation } from "../../shell/gestures.js";
import { decorateConversation } from "./decoration.js";
import { createFollow } from "./follow.js";
import { createConv } from "./draw.js";
import { threadPageHtml } from "./thread-page-html.js";
import { wordsOf } from "./words.js";

/** @import { Conversation } from "./draw-types.d.ts" */

/** @import { DockNeed, PanelComposer, Thread, ThreadPage, ThreadPageDeps } from "./thread-page-types.d.ts" */

/** @param {ThreadPageDeps} deps */
export function createThreadPage({
  STAGE, S, world, D, createDock, dockDeps, wireComposer, wireTray, closeThreadMenu, addFiles, toggleIq, sessionOf,
  convProject, watchDock, toastLine, loadAhead, returnPill, saveDraft, loadDraft, convThread, stOf, glyphOf,
  isHeld, wordOf, rtTag, threadMenuHtml, checklistRender, drawConv, updateComposer, sendRender, targetLineRender,
}) {
  /** @type {ThreadPage} */
  const TP = { box: null, C: null, K: null, tid: null, follow: null, viewSubs: new Set() };
  const tpView = () => (TP.tid ? "t:" + TP.tid : "");
  /** @param {HTMLElement} box */
  function tpMount(box) {
    TP.box = box;
    box.classList.add("tp");
    box.innerHTML = threadPageHtml($);
    const els = { scroller: $("#tscroller"), column: $("#tcolumn"), msgs: $("#tmsgs"), dock: $("#tpdock") };
    TP.follow = createFollow(els);
    TP.follow.init();
    TP.C = createConv({ view: tpView, msgs: els.msgs, scroller: els.scroller, column: els.column, typing: $("#ttyping"), follow: TP.follow });
    TP.K = { main: false, get view() { return tpView(); }, say: $("#tsay"), send: $("#tsend"), form: $("#tpcomposer"), target: $("#ttarget"), label: $("#tsay-label"), conv: TP.C,
      tray: $("#tatt-tray"), attach: $("#tattach"), input: $("#tatt-input"), note: $("#tatt-note"), iq: $("#tiq"), at: $("#tat-list") };
    wireComposer(TP.K);
    wireTray(TP.K);
    TP.dock = createDock({ el: $("#tptdock"), view: tpView, region: () => (/** @type {Conversation} */ (TP.C)).scroller }, dockDeps);
    const acts = document.createElement("span");
    acts.className = "tp-acts"; acts.id = "tpacts"; acts.dataset.for = "thread";
    STAGE.slot.append(acts);
    menuKeys(acts, { close: () => closeThreadMenu() });
    TP.K.attach.addEventListener("click", () => (/** @type {PanelComposer} */ (TP.K)).input.click());
    TP.K.input.addEventListener("change", () => { addFiles((/** @type {PanelComposer} */ (TP.K)).input.files, /** @type {PanelComposer} */ (TP.K)); (/** @type {PanelComposer} */ (TP.K)).input.value = ""; });
    TP.K.iq.addEventListener("click", () => toggleIq(sessionOf(tpView()), (/** @type {PanelComposer} */ (TP.K)).iq));
    TP.deco = decorateConversation({ conv: box, msgs: els.msgs, scroller: els.scroller, typing: $("#ttyping"), composer: TP.K.form, say: TP.K.say, send: TP.K.send, atList: TP.K.at,
      dock: els.dock, tdock: $("#tptdock"), herald: $("#tpherald"), host: box, project: () => convProject(tpView()), follow: TP.follow, isThread: () => true, view: tpView, onView: (fn) => TP.viewSubs.add(fn) });
    TP.dockRO = watchDock(els.dock, box);
    bindConversation({ scroller: els.scroller, msgs: els.msgs, say: TP.K.say, toast: (text) => toastLine(text) }, wordsOf);
    els.scroller.addEventListener("scroll", () => { if (!TP.scrollRaf) TP.scrollRaf = requestAnimationFrame(() => { TP.scrollRaf = 0; loadAhead(/** @type {Conversation} */ (TP.C)); }); }, { passive: true });
  }
  /** @param {string} key */
  function tpShow(key, { focus = false } = {}) {
    if (TP.tid !== key) {
      returnPill(null);
      if (TP.tid && TP.K) saveDraft(TP.K);
      TP.tid = key;
      (/** @type {Conversation} */ (TP.C)).rendered = null; (/** @type {Conversation} */ (TP.C)).filled = null;
      (/** @type {Conversation} */ (TP.C)).msgs.replaceChildren(); $("#tpthead").hidden = true;
      (/** @type {NonNullable<ThreadPage['dock']>} */ (TP.dock)).reset();
      world.act.watchSideThread?.(key);
      loadDraft(/** @type {PanelComposer} */ (TP.K));
      TP.viewSubs.forEach((fn) => fn());
      const t = convThread(tpView());
      if (t) tpHead(t);
      TP.wait = true;
      requestAnimationFrame(() => setTimeout(() => {
        TP.wait = false;
        if (TP.tid === key && STAGE.pageShown?.name === "thread") drawThreadPage(D.needItems());
        if (focus && TP.tid === key) (/** @type {PanelComposer} */ (TP.K)).say.focus({ preventScroll: true });
      }, 0));
      return;
    }
    drawThreadPage(D.needItems());
    if (focus) requestAnimationFrame(() => (/** @type {PanelComposer} */ (TP.K)).say.focus({ preventScroll: true }));
  }
  function tpClose() {
    if (TP.K && TP.tid) saveDraft(TP.K);
    if (S.tMenuIn === "page") { S.tMenu = null; S.tMenuIn = null; }
    world.act.watchSideThread?.(null);
    TP.tid = null;
  }

  /** @param {Thread} t */
  function tpHead(t) {
    const head = $("#tphead"), acts = $("#tpacts");
    const open = S.tMenu === t.id && S.tMenuIn === "page";
    const html = `<button type="button" class="stg-btn tp-main" data-tp-main="${esc(t.id)}" title="Open in main chat" aria-label="Open in main chat">${ICON.toMain}</button><span class="badge st-${stOf(t)}">${stateMark(glyphOf(t))}${isHeld(t) ? heldBadge(t.held) : wordOf(t)}</span>` +
      `${rtTag(t)}${t.branch ? `<code class="tp-br" title="${esc(t.branch)}">${ICON.branch}${esc(t.branch)}</code>` : ""}`;
    const menu = `<span class="tp-menu-w"><button type="button" class="stg-ic tw-more" data-tmenu="${esc(t.id)}" data-tmenu-in="page" aria-haspopup="menu" aria-expanded="${open}" title="Everything this thread can do" aria-label="Thread actions">${ICON.more}</button>${open ? threadMenuHtml(t, "page") : ""}</span>`;
    if (head._h !== html + menu) { redraw(head, html); redraw(acts, menu); head._h = html + menu; }
  }
  /** @param {DockNeed[]} needs */
  function drawThreadPage(needs) {
    const t = convThread(tpView());
    if (!t) { STAGE.closePage("thread"); return; }
    tpHead(t);
    checklistRender(needs, $("#tpthead"), tpView(), "tck-list");
    drawConv(/** @type {Conversation} */ (TP.C), needs);
    (/** @type {NonNullable<ThreadPage['dock']>} */ (TP.dock)).render(needs);
    if (document.activeElement !== (/** @type {PanelComposer} */ (TP.K)).say) updateComposer(/** @type {PanelComposer} */ (TP.K)); else { sendRender(/** @type {PanelComposer} */ (TP.K)); targetLineRender(/** @type {PanelComposer} */ (TP.K)); }
  }

  return { TP, tpMount, tpShow, tpClose, drawThreadPage };
}
