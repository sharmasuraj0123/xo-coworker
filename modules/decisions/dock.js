// @ts-check

import { esc } from "../../core/platform/util.js";
import { usable } from "../../core/ui/a11y/focus.js";
import { stateMark } from "../../core/ui/icons/icon.js";
import { ICON } from "../../core/ui/icons/names.js";
import { morph, RM, wait, hold } from "../../core/ui/motion.js";
import { EFFORT } from "./rank.js";
import { goneLine } from "./cardparts.js";
import { dockEdges, fitDock } from "./dock-layout.js";

/** @import { Mount, DockDeps, Thread, Need, Gone } from "./dock-types.d.ts" */

/** @param {Mount} mount @param {DockDeps} deps */
export function createDock({ el: tdock, view, region, TD = { key: null, item: null, busy: false, undone: null, gen: 0 } }, {
  CH, D, S, world, convThread, convHost, askShort, schedule, dockGestures,
}) {
  const placeRegion = region;
  /** @param {() => void} fill @param {HTMLElement | null} [to] @param {Parameters<typeof morph>[2] | null} [opts] */
  function dockSwap(fill, to = null, opts = null) {
    const had = tdock.contains(document.activeElement);
    const run = () => {
      fill();
      if (had && !tdock.contains(document.activeElement)) (to && usable(to) ? to : placeRegion()).focus({ preventScroll: true });
    };
    if (opts) morph(tdock, run, opts); else run();
  }
  function reset() {
    Object.assign(TD, { key: null, item: null, busy: false, undone: null, gen: TD.gen + 1 });
    tdock._ch = "";
    dockRO.disconnect();
    dockSwap(() => tdock.replaceChildren());
  }
  const keepBottom = () => {}; // pinned at the latest, follow.js keeps the view there as the card changes
  const GONE_FRESH = 5000; // a withdrawal older than this was not what just emptied the dock
  const dockRO = new ResizeObserver(() => { const f = tdock.querySelector(".card.is-dock"); if (f) fitDock(f); });
  tdock.addEventListener("scroll", () => { const f = tdock.querySelector(".card.is-dock"); if (f) dockEdges(f); }, { capture: true, passive: true });
  /** @param {Need[]} needs */
  function dockRender(needs) {
    // a chat: its "send now" question first, else its own open decision (the chat's host), as a thread docks one
    const hc = CH.isChats(view()) ? CH.confirmHtml(view()) : "";
    if (hc) { if (tdock._ch !== hc) { dockSwap(() => { tdock.innerHTML = hc; }); tdock._ch = hc; TD.key = null; } return; }
    if (tdock._ch) { tdock._ch = ""; dockSwap(() => { tdock.innerHTML = ""; }); TD.key = null; }
    if (view() === "chats") { if (TD.key) { TD.key = null; dockSwap(() => { tdock.innerHTML = ""; }); } return; }
    const t = convThread(view()) || convHost(view());
    const n = t && !D.isOpen() ? needs.find((x) => x.t.id === t.id && !x.later && (x.admitted || x.held)) : null;
    // Keep a folded ask in one line until a new one arrives.
    const folded = !!(n && S.dockFold[n.key]);
    const key = n ? n.key + (folded ? "|fold" : "") : null;
    if (TD.busy || key === TD.key) return;
    const prev = TD.key, gone = !n && prev ? world.state.gone.get(TD.item) : null;
    TD.key = key;
    TD.item = n && n.ask.item ? n.ask.item.id : null;
    if (!n) {
      if (!prev) { dockSwap(() => { tdock.innerHTML = ""; }); return; }
      if (gone && Date.now() - gone.at < GONE_FRESH) { goneRender(gone); return; }
      dockSwap(() => { tdock.innerHTML = ""; }, null, { duration: 300 });
      return;
    }
    const head = (() => { const tp = document.createElement("template"); tp.innerHTML = D.cardHtml(n, "dock").trim(); return (/** @type {HTMLElement | null} */ (tp.content.querySelector(".c-h")))?.textContent.trim() || askShort(n); })();
    if (folded) {
      const E = EFFORT[n.effort];
      const bar = document.createElement("button");
      bar.type = "button";
      bar.className = `dock-fold r-${n.risk}`;
      bar.dataset.unfold = n.key;
      bar.title = "Open the decision";
      bar.innerHTML = `${stateMark(n.group === "stopped" ? "failed" : "needs_reply")}<span class="df-t">${esc(head)}</span><span class="df-e">${esc(E.label)} ${esc(E.time)}</span><span class="df-go">Open ${ICON.chevron}</span>`;
      dockSwap(() => { tdock.innerHTML = ""; tdock.appendChild(bar); }, bar, { duration: 300 });
      return;
    }
    const frame = document.createElement("article");
    frame.className = `card is-dock r-${n.risk} e-${n.effort}`;
    frame.tabIndex = -1;
    frame.setAttribute("aria-roledescription", "decision");
    frame.innerHTML = `<div class="stamp stamp-allow" aria-hidden="true">${ICON.stampAllow}</div><div class="stamp stamp-back" aria-hidden="true">${ICON.stampBack}</div>`;
    const tpl = document.createElement("template");
    tpl.innerHTML = D.cardHtml(n, "dock").trim();
    const inner = /** @type {Element} */ (tpl.content.firstElementChild);
    frame.appendChild(inner);
    frame.setAttribute("aria-labelledby", (/** @type {Element} */ (inner.querySelector(".c-h"))).id);
    const what = (/** @type {Thread} */ (t)).host ? "chat" : "thread";
    (inner.querySelector(".c-top") || frame).insertAdjacentHTML("beforeend", `<button type="button" class="dock-hide" data-fold="${esc(n.key)}" title="Fold it away and read the ${what} first">${ICON.chevron}<span>Read the ${what} first</span></button>`);
    dockSwap(() => { tdock.innerHTML = ""; tdock.appendChild(frame); fitDock(frame); }, frame, { duration: prev ? 300 : 360, fade: frame });
    dockRO.disconnect();
    for (const el of [frame, frame.querySelector(".c-body"), frame.querySelector(".c-act")]) if (el) dockRO.observe(el);
    D.wireCard(frame, inner, n, {
      surface: "dock",
      onStep: keepBottom,
      after: async (how) => {
        TD.busy = true;
        const gen = TD.gen;
        if (!RM.matches && how !== "later") { frame.classList.add(`st-${how}`); await wait(380); if (TD.gen !== gen) return; }
        if (how !== "later") {
          // one calm line in place of the card, then it folds away
          const e = D.decisions()[0];
          const verb = e && e.verb === "Answered" ? `Answered “${e.said}”` : e ? e.verb : "Done";

          const had = frame.contains(document.activeElement);
          morph(frame, () => {
            frame.className = "card is-dock r-done"; frame.innerHTML = `<p class="tp-done${how === "back" ? " is-back" : ""}" role="status"><span class="tp-done-ic">${how === "back" ? ICON.rewind : ICON.check}</span><span title="${esc(verb)}."><b>${esc(verb)}.</b> ${how === "back" ? "It's taking another route." : "It's back at work."}</span><button type="button" class="tp-done-u" data-dock-undo>Undo</button></p>`;
            if (had && !frame.contains(document.activeElement)) (/** @type {HTMLElement} */ (frame.querySelector("[data-dock-undo]"))).focus({ preventScroll: true });
          }, { duration: 300 });
          // Keep the receipt for the Undo window and remove it as soon as it is undone.
          let undone = false;
          await /** @type {Promise<void>} */ (new Promise((end) => { TD.undone = { key: n.key, end: () => { undone = true; end(); } }; hold(RM.matches ? 3000 : 2700).then(end); }));
          if (TD.gen !== gen) return;
          TD.undone = null;
          if (undone) { TD.busy = false; TD.key = null; dockRender(D.needItems()); schedule(); return; }
        }
        TD.busy = false;
        TD.key = "__settling";
        dockSwap(() => { tdock.innerHTML = ""; }, null, { duration: 320 });
        TD.key = null;
        schedule();
      },
    });
  }
  /** @param {Gone} g */
  async function goneRender(g) {
    const L = goneLine(g);
    const line = document.createElement("article");
    line.className = "card is-dock r-done";
    line.innerHTML = `<p class="tp-done is-gone" role="status"><span class="tp-done-ic">${ICON.clock}</span><span title="${esc(`${L.head}. ${L.text}`)}"><b>${esc(L.head)}.</b> ${esc(L.text)}</span></p>`;
    TD.busy = true;
    dockSwap(() => { tdock.innerHTML = ""; tdock.appendChild(line); }, null, { duration: 300 });
    const gen = TD.gen;
    await hold(3000);
    if (TD.gen !== gen) return;
    TD.busy = false;
    TD.key = "__settling";
    dockSwap(() => { tdock.innerHTML = ""; }, null, { duration: 320 });
    TD.key = null;
    schedule();
  }
  tdock.addEventListener("click", (e) => {
    if ((/** @type {Element} */ (e.target)).closest("[data-dock-more]")) { tdock.querySelector(".card.is-dock .c-act")?.scrollIntoView({ block: "end", behavior: RM.matches ? "auto" : "smooth" }); return; }
    const f = /** @type {(HTMLButtonElement & { dataset: { fold: string } }) | null} */ ((/** @type {Element} */ (e.target)).closest("[data-fold]"));
    if (f) { S.dockFold[f.dataset.fold] = true; dockRender(D.needItems()); placeRegion().focus({ preventScroll: true }); return; }
    const u = /** @type {(HTMLButtonElement & { dataset: { unfold: string } }) | null} */ ((/** @type {Element} */ (e.target)).closest("[data-unfold]"));
    if (u) { delete S.dockFold[u.dataset.unfold]; dockRender(D.needItems()); (/** @type {HTMLElement | null} */ (tdock.querySelector(".card")))?.focus({ preventScroll: true }); return; }
    if ((/** @type {Element} */ (e.target)).closest("[data-dock-undo]")) D.undo();
  });
  tdock.addEventListener("keydown", (e) => {
    const card = tdock.querySelector(".card");
    if (!card) return;
    D.cardKeys(e, card, {});
  });
  dockGestures(tdock);
  return { render: dockRender, reset, TD, el: tdock };
}
