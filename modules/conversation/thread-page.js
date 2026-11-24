// @ts-check

import { $ as query } from "../../core/platform/dom.js";
import { focusEntry } from "../../core/ui/a11y/focus.js";
import { createScope } from "../../core/kernel/scope.js";
import { conversationGestures as bindConversation } from "../../shell/gestures.js";
import { decorateConversation } from "./decoration.js";
import { createFollow } from "./follow.js";
import { createConv } from "./draw.js";
import { threadPageHtml } from "./thread-page-html.js";
import { createThreadPageHead } from "./thread-page-head.js";
import { wordsOf } from "./words.js";

/** @import { Conversation } from "./draw-types.d.ts" */

/** @import { DockNeed, PanelComposer, ThreadPage, ThreadPageDeps } from "./thread-page-types.d.ts" */

/** @template DockDeps @template {DockNeed} N @param {ThreadPageDeps<DockDeps, N>} deps */
export function createThreadPage({
  STAGE, threadControls, world, D, createDock, dockDeps, wireComposer, wireTray, closeThreadMenu, addFiles, toggleIq, sessionOf,
  convProject, watchDock, toastLine, loadAhead, returnPill, saveDraft, loadDraft, convThread, stOf, glyphOf,
  isHeld, wordOf, rtTag, threadMenuHtml, checklistRender, drawConv, updateComposer, sendRender, targetLineRender,
}) {
  /** @type {ReturnType<typeof createScope> | undefined} */
  let mounted;
  /** @type {ThreadPage<N>} */
  const TP = { box: null, C: null, K: null, tid: null, follow: null, viewSubs: new Set() };
  const $ = (/** @type {string} */ selector) => query(selector, /** @type {HTMLElement} */ (TP.box));
  const head = createThreadPageHead({ STAGE, threadControls, closeThreadMenu, stOf, glyphOf, isHeld, wordOf, rtTag, threadMenuHtml });
  let cancelDraw = () => {};
  const tpView = () => (TP.tid ? "t:" + TP.tid : "");
  /** @param {HTMLElement} box */
  function tpMount(box) {
    const scope = createScope();
    mounted = scope;
    TP.box = box;
    box.classList.add("tp");
    box.innerHTML = threadPageHtml(query);
    const els = { scroller: $("#tscroller"), column: $("#tcolumn"), msgs: $("#tmsgs"), dock: $("#tpdock") };
    TP.follow = createFollow(els);
    TP.follow.init();
    const follow = TP.follow;
    scope.effect(() => follow.destroy);
    TP.C = createConv({ ...els, view: tpView, typing: $("#ttyping"), follow: TP.follow });
    TP.K = { main: false, get view() { return tpView(); }, say: $("#tsay"), send: $("#tsend"), form: $("#tpcomposer"), target: $("#ttarget"), label: $("#tsay-label"), conv: TP.C,
      tray: $("#tatt-tray"), attach: $("#tattach"), input: $("#tatt-input"), note: $("#tatt-note"), iq: $("#tiq"), at: $("#tat-list") };
    wireComposer(TP.K, scope);
    wireTray(TP.K, scope);
    TP.dock = createDock({ el: $("#tptdock"), view: tpView, region: () => els.scroller }, dockDeps);

    scope.effect(head.mount);
    const composer = TP.K;
    scope.listen(composer.attach, "click", () => composer.input.click());
    scope.listen(composer.input, "change", () => { addFiles(composer.input.files, composer); composer.input.value = ""; });
    scope.listen(composer.iq, "click", () => toggleIq(sessionOf(tpView()), composer.iq));
    const decoration = decorateConversation({
      ...els, conv: box, typing: $("#ttyping"), composer: composer.form, say: composer.say, send: composer.send, atList: composer.at,
      tdock: $("#tptdock"), herald: $("#tpherald"), host: box, project: () => convProject(tpView()), follow, isThread: () => true,
      view: tpView, onView: (fn) => { TP.viewSubs.add(fn); return () => TP.viewSubs.delete(fn); },
    });
    scope.effect(() => decoration.destroy);
    scope.observe(watchDock(els.dock, box));
    bindConversation({ scroller: els.scroller, msgs: els.msgs, say: TP.K.say, toast: (text) => toastLine(text) }, wordsOf, scope);
    let scrollQueued = false;
    scope.listen(els.scroller, "scroll", () => {
      if (scrollQueued) return;
      scrollQueued = true;
      scope.frame(() => { scrollQueued = false; if (TP.C) loadAhead(TP.C); });
    }, { passive: true });
    return () => {
      if (TP.tid) tpClose();
      scope.dispose();
      TP.dock?.reset({ restoreFocus: false });
      Object.assign(TP, { box: null, C: null, K: null, follow: null, dock: undefined });
      TP.viewSubs.clear();
      mounted = undefined;
    };
  }
  /** @param {string} key */
  function tpShow(key) {
    const scope = mounted;
    if (!scope) return;
    if (TP.tid !== key) {
      cancelDraw();
      returnPill(null);
      if (TP.tid && TP.K) saveDraft(TP.K);
      TP.tid = key;
      (/** @type {Conversation} */ (TP.C)).rendered = null; (/** @type {Conversation} */ (TP.C)).filled = null;
      (/** @type {Conversation} */ (TP.C)).msgs.replaceChildren(); $("#tpthead").hidden = true;
      TP.dock?.reset();
      world.act.watchSideThread?.(key);
      loadDraft(/** @type {PanelComposer} */ (TP.K));
      TP.viewSubs.forEach((fn) => fn());
      const t = convThread(tpView());
      if (t) head.draw($("#tphead"), t);
      TP.wait = true;
      cancelDraw = scope.frame(() => {
        cancelDraw = scope.timeout(() => {
          TP.wait = false;
          if (TP.tid === key && STAGE.pageShown?.name === "thread") drawThreadPage(D.needItems());
        }, 0);
      });
      return;
    }
    drawThreadPage(D.needItems());
  }
  /** @param {HTMLElement | null} heading @param {import("../../core/ui/a11y/focus.js").EntryInput} input */
  function tpFocus(heading, input) {
    focusEntry(TP.K?.say ?? null, heading, input);
  }
  function tpClose() {
    cancelDraw();
    TP.wait = false;
    if (TP.K && TP.tid) saveDraft(TP.K);
    threadControls.clearMenu("page");
    world.act.watchSideThread?.(null);
    TP.tid = null;
  }

  /** @param {N[]} needs */
  function drawThreadPage(needs) {
    const t = convThread(tpView());
    if (!t) { STAGE.closePage("thread"); return; }
    head.draw($("#tphead"), t);
    checklistRender(needs, $("#tpthead"), tpView(), "tck-list");
    drawConv(/** @type {Conversation} */ (TP.C), needs);
    TP.dock?.render(needs);
    if (document.activeElement !== (/** @type {PanelComposer} */ (TP.K)).say) updateComposer(/** @type {PanelComposer} */ (TP.K)); else { sendRender(/** @type {PanelComposer} */ (TP.K)); targetLineRender(/** @type {PanelComposer} */ (TP.K)); }
  }

  return { TP, tpMount, tpShow, tpFocus, tpClose, drawThreadPage };
}
