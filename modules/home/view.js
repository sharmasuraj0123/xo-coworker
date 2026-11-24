// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { dial, ICON, NEXT_GLYPH, XO } from "../../core/ui/icons/names.js";
import { RM, wait } from "../../core/ui/motion.js";
import { landed } from "../../core/ui/landing.js";
import { redraw } from "../../core/ui/redraw.js";
import { drawSections } from "./sections.js";

/** @import { HomeChoice, HomeViewDeps, HomeViewNeed } from "./view-types.d.ts" */

/** @param {HomeViewDeps} options */
export function createHomeView({ S, D, world, Kit, EFFORT, homeParts, nextCardHtml, endRender, greeting, today, num, noun, plural, isBusy, askTitle, PROJ, kernel, SV, announce, schedule }) {
  const built = new WeakSet(), busy = new WeakSet();
  let nextKey = /** @type {string | null} */ (null), nextSeen = 0;

  /** @param {HomeViewNeed[]} needs */
  function homeRender(needs) {
    const box = $("#home");
    if (!built.has(box)) {
      box.innerHTML = `<div class="hm"><div id="hm-head"></div><div class="hm-body" id="hm-body"><div id="hm-since"></div><div id="hm-next"></div><div id="hm-then"></div><div id="hm-end"></div><div id="hm-made"></div></div></div>`;
      built.add(box);
    }
    const P0 = homeParts(needs);
    const working = world.state.threads.filter(isBusy);
    const date = today();
    const act = P0.active.length;
    let sub;
    if (act) sub = act === 1 ? "One thing is worth your time." : `${num(act)} things are worth your time.`;
    else sub = P0.held.length ? "Nothing needs you now." : "Nothing needs you.";
    const down = (world.state.error || world.state.statusError) && !world.state.threads.length;
    if (down) sub = "XO can't be reached right now.";
    const hello = greeting();
    redraw($("#hm-head"), `<header class="hm-top"><div class="hm-hd"><p class="hm-date">${esc(date)}</p><h1 class="hm-h" id="home-h">${hello}.<span> ${sub}</span></h1></div>` +
      `<button type="button" class="create" data-create data-fid="create"><span class="create-ic">${ICON.plus}</span><span class="cr-l">Create XO Project</span><span class="cr-s">New project</span></button></header>`);
    landed($("#hm-head"), [$("#home-h span"), $("#hm-head .create")]);

    const nb = $("#hm-next");
    const card0 = nb.querySelector(".next");
    const nextHad = nb.contains(document.activeElement);
    const inPanel = P0.next && D.current() === P0.next.key;
    if (card0 && (card0.classList.contains("noting") || busy.has(card0)) && P0.next && card0.dataset.key === P0.next.key) { /* Keep the draft in place. */ }
    else if (P0.next && inPanel) {
      nextKey = null;
      redraw(nb, `<p class="hm-lbl"><span class="nx-glyph">${NEXT_GLYPH}</span>Your next move</p><p class="in-panel">${ICON.arrow}<span>Open in the panel</span></p>`);
    } else if (P0.next) {
      const key = P0.next.key;
      const changed = nextKey !== key;
      if (changed) nextSeen = performance.now();
      const html = `<p class="hm-lbl"><span class="nx-glyph">${NEXT_GLYPH}</span>Your next move</p>` + nextCardHtml(P0.next);
      if (redraw(nb, html) && changed) {
        const card = nb.querySelector(".next");
        if (nextKey && !RM.matches) card.classList.add(S.pinAnim === "undo" ? "in-undo" : "in-next");
        S.pinAnim = null;
      }
      nextKey = key;
    } else {
      nextKey = null;
      const w = working.length;
      if (down) redraw(nb, `<div class="calm is-down"><div class="calm-mark">${XO}</div><h2>Can't reach XO.</h2><p>Retrying every few seconds. Nothing you write is lost; sending waits until it's back.</p></div>`);
      else redraw(nb, `<p class="calm-line">${w ? `${num(w)} ${noun(plural(w, "thread"))} working. ${w === 1 ? "It'll" : "They'll"} ask when it's worth it.` : "Start something below, or enjoy the quiet."}</p>`);
    }
    if (S.homeFocusNext || (nextHad && !nb.contains(document.activeElement))) {
      S.homeFocusNext = false;
      const nc = nb.querySelector(".next");
      if (nc) nc.focus({ preventScroll: true }); else { nb.tabIndex = -1; nb.focus({ preventScroll: true }); }
    }
    landed(nb);

    let then = "";
    if (P0.then.length) {
      then = `<section class="then" aria-labelledby="then-h"><h2 class="hm-lbl" id="then-h">Then</h2><ol>` +
        P0.then.map((n) => `<li><button type="button" class="then-i r-${n.risk}" data-fid="then-${esc(n.key)}" data-decide="${esc(n.key)}">` +
          `<span class="eff e-${n.effort}">${dial(n.effort)}<b>${EFFORT[n.effort].label}</b></span>` +
          `<span class="ti-t">${askTitle(n)}</span>` +
          `<span class="ti-p">${n.risk === "destructive" ? `<span class="risk r-destructive">Destructive</span>` : n.group === "stopped" ? `<span class="risk r-stopped">Stopped</span>` : ""}<span class="ti-w">${esc(PROJ(n.t.project))}${n.t.asker ? " coordinator" : ""}</span></span>${ICON.right}</button></li>`).join("") + `</ol>`;
      const foot = [];
      if (P0.more.length) foot.push(`<button type="button" class="hm-quiet" data-fid="more" data-open-all>+${P0.more.length} more</button>`);
      if (P0.glances.length >= 2) foot.push(`<button type="button" class="hm-quiet is-glance" data-fid="glances" data-glances>${dial("glance")}Clear ${P0.glances.length} glances together</button>`);
      if (P0.later.length) foot.push(`<button type="button" class="hm-quiet is-later" data-fid="bring" data-bring>${ICON.clock}${P0.later.length} later today <span>bring back</span></button>`);
      if (foot.length) then += `<div class="then-foot">${foot.join("")}</div>`;
      then += `</section>`;
    } else if (P0.later.length) then = `<div class="then-foot solo"><button type="button" class="hm-quiet is-later" data-fid="bring" data-bring>${ICON.clock}${P0.later.length} later today <span>bring back</span></button></div>`;
    redraw($("#hm-then"), then);
    landed($("#hm-then"));
    drawSections(kernel.places, $("#hm-body"), { needs, patch: redraw });

    endRender(P0, working);
    SV.homeOrder($("#hm-body"));
  }

  /** @param {HomeChoice} choice @param {string} [note] */
  async function nextDecide(choice, note) {
    const card = $("#hm-next .next");
    if (!card || busy.has(card)) return;
    const key = card.dataset.key;
    if (key !== nextKey || performance.now() - nextSeen < Kit.READ_MS) { if (card.classList.contains("r-notable")) announce("A beat to read it first."); return; }
    busy.add(card);
    card.focus({ preventScroll: true });
    if (!D.decideNow(key, choice, note)) { busy.delete(card); return; }
    if (!RM.matches) { card.classList.add(choice === "deny" ? "st-back" : "st-allow"); await wait(choice === "deny" ? 260 : 300); }
    S.pin = null;
    schedule();
    requestAnimationFrame(() => requestAnimationFrame(() => { const nc = $("#hm-next .next"); if (nc && S.view === "home" && !D.isOpen()) nc.focus({ preventScroll: true }); }));
  }

  return { homeRender, nextDecide };
}
