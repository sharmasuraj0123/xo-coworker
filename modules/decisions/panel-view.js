// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import * as K from "../../core/platform/keys.js";
import { sound } from "../../core/services/sound.js";
import { ICON } from "../../core/ui/icons/names.js";
import { RM, wait, morph } from "../../core/ui/motion.js";
import { redraw } from "../../core/ui/redraw.js";
import * as Kit from "./kit.js";
import { commandOf } from "./cardparts.js";

/** @import { PanelViewDeps, Transition, CardNeed } from "./panel-view-types.d.ts" */

const BIG_CHECK = ICON.stampAllow;
const BIG_BACK = ICON.stampBack;

/** @param {PanelViewDeps} options */
export function createDecisionPanelView({ F, P, PROJ, stage, needItems, cardHtml, wireCard, pending, log, announce, render, onBreak, onAllClear, advance, close, allowAllRoutine }) {
  /** @param {string} key @param {Transition} how */
  async function show(key, how) {
    const n = F.items.get(key);
    if (!n) return;
    F.vig = false;
    const my = ++F.swap;
    const ae = document.activeElement, cur = $("#card");
    const typing = how !== "allow" && how !== "back" && !!(cur && ae && cur.contains(ae) && ae.matches("textarea, input, [contenteditable]"));
    clearTimeout(F.autoT);
    F.hold && F.hold.cancel();
    let frame = $("#card");
    if (!frame) {
      stage.innerHTML = `<article class="card" id="card" tabindex="-1" aria-roledescription="decision"><div class="stamp stamp-allow" aria-hidden="true">${BIG_CHECK}</div><div class="stamp stamp-back" aria-hidden="true">${BIG_BACK}</div></article>`;
      frame = $("#card");
    }
    const old = frame.querySelector(".card-in");
    F.busy = true;
    if (old && !RM.matches) {
      if (how === "allow" || how === "back") { frame.classList.add(`st-${how}`); await wait(190); }
      old.classList.add(`out-${how}`);
      await wait(how === "allow" || how === "back" ? 150 : 120);
      frame.classList.remove("st-allow", "st-back");
    }
    if (my !== F.swap) return;
    const fresh = needItems().find((x) => x.key === key) || n;
    const tpl = document.createElement("template");
    tpl.innerHTML = cardHtml(fresh, "panel").trim();
    const inner = /** @type {HTMLElement} */ (tpl.content.firstElementChild);
    inner.classList.add(`in-${how}`);
    morph(frame, () => {
      old && old.remove();
      frame.className = `card r-${fresh.risk} e-${fresh.effort}`;
      frame.appendChild(inner);
    }, { duration: 300 });
    frame.setAttribute("aria-labelledby", (/** @type {HTMLElement} */ (inner.querySelector(".c-h"))).id);
    const why = inner.querySelector(".c-line");
    if (why) frame.setAttribute("aria-describedby", why.id); else frame.removeAttribute("aria-describedby");
    if (typing) { frame._quiet = true; frame._quietWhy = "The ask you were writing to went away; this is the next one."; }
    wireCard(frame, inner, fresh, { surface: "panel", after: (h) => advance(h) });
    F.busy = false;
    frame.focus({ preventScroll: true });
    chrome();
  }

  /** @param {Transition} how */
  async function vigilance(how) {
    F.vig = true;
    const frame = $("#card");
    const old = frame && frame.querySelector(".card-in");
    if (old && !RM.matches) {
      frame.classList.add(`st-${how}`); await wait(190);
      old.classList.add(`out-${how}`); await wait(150);
      frame.classList.remove("st-allow", "st-back");
    }
    const left = F.order.filter(pending).length;
    const m = Math.round(P.reviewMin());
    const inner = document.createElement("div");
    inner.className = "card-in in-enter vig";
    inner.innerHTML = `<div class="c-body"><div class="vig-ic">${ICON.pause}</div>` +
      `<h3 class="c-h" id="vig-h">${m} minutes of deciding.</h3>` +
      `<p class="c-line">Attention dips after about 25. ${left} left, nothing urgent; they'll hold.</p></div>` +
      `<div class="c-act"><div class="c-btns"><button type="button" class="b b-back" data-vig="rest"><span class="b-l">${ICON.pause}Take a break</span></button><button type="button" class="b b-back" data-vig="go"><span class="b-l">Keep going</span></button></div></div>`;
    morph(frame, () => { old && old.remove(); frame.className = "card r-vig"; frame.appendChild(inner); }, { duration: 280 });
    frame.setAttribute("aria-labelledby", "vig-h");
    frame.focus({ preventScroll: true });
    announce(`${m} minutes of deciding. A break is a good idea; the rest will hold.`);
    inner.addEventListener("click", (e) => {
      const b = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-vig]"));
      if (!b) return;
      if (b.dataset.vig === "go") { P.keepGoing(); show(/** @type {string} */ (F.cur), "enter"); }
      else { P.rested(); close(); onBreak && onBreak(left); }
    });
    chrome();
  }

  /** @param {Transition} how */
  async function finish(how) {
    F.done = true;
    const my = ++F.swap;
    const frame = $("#card");
    const old = frame && frame.querySelector(".card-in");
    if (old && !RM.matches) {
      if (how === "allow" || how === "back") { frame.classList.add(`st-${how}`); await wait(190); }
      old.classList.add(`out-${how}`);
      await wait(150);
      frame.classList.remove("st-allow", "st-back");
    }
    if (my !== F.swap || !frame) return;
    const runLog = log.filter((d) => F.order.includes(d.key));
    /** @param {string} k */
    const c = (k) => runLog.filter((d) => d.choice === k).length;
    const laterN = F.order.filter((k) => F.status.get(k) === "later").length;
    const skipped = F.order.filter((k) => !F.status.has(k)).length;
    const freed = 0;
    const parts = [c("allow") && `${c("allow")} allowed`, c("answer") && `${c("answer")} answered`, c("deny") && `${c("deny")} sent back`, laterN && `${laterN} for later`].filter(Boolean);
    const inner = document.createElement("div");
    inner.className = "card-in in-enter done";
    inner.setAttribute("role", "status");
    inner.innerHTML = `<div class="done-ring">${BIG_CHECK}</div><h3>${F.mode === "glance" ? "Glances cleared." : "That's everything."}</h3><p>${parts.join(" · ") || "Nothing decided"}${skipped ? ` · ${skipped} still waiting` : ""}</p>` +
      "";
    morph(frame, () => { old && old.remove(); frame.className = "card r-done"; frame.appendChild(inner); }, { duration: 300 });
    frame.focus({ preventScroll: true });
    chrome();
    sound.play("done");
    announce(`${F.mode === "glance" ? "Glances cleared" : "That's everything"}. ${parts.join(", ")}.`);
    onAllClear && onAllClear(parts.join(" · "), freed);
    F.autoT = setTimeout(() => { if (F.open && F.done) close(); }, RM.matches ? 1400 : 2000);
  }

  function chrome() {
    const rail = $("#pn-rail");
    let html = "";
    /** @type {boolean | null | undefined} */
    let apart = null;
    F.order.forEach((k) => {
      const n = F.items.get(k);
      const d = n && n.risk === "destructive";
      if (apart !== null && apart !== d) html += `<i class="rail-gap"></i>`;
      apart = d;
      const st = F.status.get(k);
      html += `<i class="rs r-${n ? n.risk : "notable"}${k === F.cur && !F.done && !F.vig ? " is-cur" : ""}${st ? " s-" + st : ""}"></i>`;
    });
    rail.innerHTML = html;
    const i = F.order.indexOf(/** @type {string} */ (F.cur)) + 1, total = F.order.length;
    const left = F.order.filter(pending).length;
    $("#pn-count").innerHTML = F.done ? `All ${total} seen` : F.vig ? `${left} held` : `<b>${i}</b> of ${total}`;
    const routine = F.order.filter(pending).map((k) => F.items.get(k)).filter((/** @type {CardNeed | undefined} */ n) => n && n.group === "routine" && Kit.isBinary(n.ask));
    const foot = $("#pn-foot");
    redraw(foot, F.done || F.vig ? "" :
      `<button type="button" class="pn-nav" data-nav="-1" title="Previous${K.hint("prev")}" aria-label="Previous ask"${total < 2 ? " disabled" : ""}>${ICON.back}</button>` +
      (routine.length >= 2 ? `<button type="button" class="pn-all" data-all>Allow all ${routine.length} routine</button>` : `<span class="pn-tip">Skip freely; nothing here is forced first.</span>`) +
      `<button type="button" class="pn-nav" data-nav="1" title="Skip ahead${K.hint("next")}" aria-label="Skip to the next ask"${total < 2 ? " disabled" : ""}>${ICON.right}</button>`);
    render();
  }

  function confirmAll() {
    const batch = /** @type {CardNeed[]} */ (F.order.filter(pending).map((k) => F.items.get(k)).filter((n) => n && n.group === "routine" && Kit.isBinary(n.ask)));
    if (!batch.length || F.done || stage.querySelector(".confirm")) return;
    const el = document.createElement("div");
    el.className = "confirm";
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-labelledby", "cf-h");
    el.innerHTML = `<h3 id="cf-h" tabindex="-1">Allow all ${batch.length} routine asks?</h3><p>Read-only or reversible. Never includes notable or destructive asks.</p>` +
      `<ul>${batch.map((n) => `<li><span class="cf-p">${esc(PROJ(n.t.project))}</span><code>${esc(commandOf(n.ask) || n.ask.title)}</code></li>`).join("")}</ul>` +
      `<div class="c-btns"><button type="button" class="b b-allow" data-cf="yes"><span class="b-l">${ICON.check}Allow ${batch.length}</span></button><button type="button" class="b b-back" data-cf="no" title="Cancel (Esc)"><span class="b-l">Cancel</span></button></div>`;
    stage.appendChild(el);
    (/** @type {HTMLElement} */ (el.querySelector("h3"))).focus();
    el.addEventListener("click", (e) => {
      const b = /** @type {HTMLElement | null} */ ((/** @type {Element} */ (e.target)).closest("[data-cf]"));
      if (!b) return;
      el.remove();
      if (b.dataset.cf === "yes") allowAllRoutine(batch.map((n) => n.key)); else $("#card")?.focus();
    });
  }

  return { show, vigilance, finish, chrome, confirmAll };
}
