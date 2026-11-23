// @ts-check

import { $ } from "../../core/platform/dom.js";
import { esc } from "../../core/platform/util.js";
import { dial, ICON, NEXT_GLYPH, XO } from "../../core/ui/icons/names.js";
import { landed, RM, wait } from "../../core/ui/motion.js";
import { patch } from "../../core/ui/redraw.js";
import { drawSections } from "./sections.js";

/** @import { HomeChoice, HomeViewDeps, HomeViewNeed } from "./view-types.d.ts" */

/** @param {HomeViewDeps} options */
export function createHomeView({ S, D, world, Kit, EFFORT, homeParts, nextCardHtml, endRender, greeting, today, num, noun, plural, isBusy, askTitle, PROJ, kernel, SV, announce, schedule }) {
  /** @type {Map<string, number>} */
  const NEXT_SEEN = new Map();

  /** @param {HomeViewNeed[]} needs */
  function homeRender(needs) {
    const box = $("#home");
    if (!box._built) {
      box.innerHTML = `<div class="hm"><div id="hm-head"></div><div class="hm-body" id="hm-body"><div id="hm-since"></div><div id="hm-next"></div><div id="hm-then"></div><div id="hm-end"></div><div id="hm-made"></div></div></div>`;
      box._built = true;
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
    patch($("#hm-head"), `<header class="hm-top"><div class="hm-hd"><p class="hm-date">${esc(date)}</p><h1 class="hm-h" id="home-h">${hello}.<span> ${sub}</span></h1></div>` +
      `<button type="button" class="create" data-create data-fid="create"><span class="create-ic">${ICON.plus}</span><span class="cr-l">Create XO Project</span><span class="cr-s">New project</span></button></header>`);
    landed($("#hm-head"), [$("#home-h span"), $("#hm-head .create")]);

    const nb = $("#hm-next");
    const card0 = nb.querySelector(".next");
    const nextHad = nb.contains(document.activeElement);
    const inPanel = P0.next && D.current() === P0.next.key;
    if (card0 && (card0.classList.contains("noting") || card0._busy) && P0.next && card0.dataset.key === P0.next.key) { /* don't disturb a note in progress */ }
    else if (P0.next && inPanel) {
      nb._key = null;
      patch(nb, `<p class="hm-lbl"><span class="nx-glyph">${NEXT_GLYPH}</span>Your next move</p><p class="in-panel">${ICON.arrow}<span>Open in the panel</span></p>`);
    } else if (P0.next) {
      const key = P0.next.key;
      const changed = nb._key !== key;
      if (changed) NEXT_SEEN.set(key, performance.now());
      const html = `<p class="hm-lbl"><span class="nx-glyph">${NEXT_GLYPH}</span>Your next move</p>` + nextCardHtml(P0.next);
      if (patch(nb, html) && changed) {
        const card = nb.querySelector(".next");
        if (nb._key && !RM.matches) card.classList.add(S.pinAnim === "undo" ? "in-undo" : "in-next");
        S.pinAnim = null;
      }
      nb._key = key;
    } else {
      nb._key = null;
      const w = working.length;
      if (down) patch(nb, `<div class="calm is-down"><div class="calm-mark">${XO}</div><h2>Can't reach XO.</h2><p>Retrying every few seconds. Nothing you write is lost; sending waits until it's back.</p></div>`);
      else patch(nb, `<p class="calm-line">${w ? `${num(w)} ${noun(plural(w, "thread"))} working. ${w === 1 ? "It'll" : "They'll"} ask when it's worth it.` : "Start something below, or enjoy the quiet."}</p>`);
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
    patch($("#hm-then"), then);
    landed($("#hm-then"));
    drawSections(kernel.places, $("#hm-body"), { needs, patch });

    endRender(P0, working);
    SV.homeOrder($("#hm-body"));
  }

  /** @param {HomeChoice} choice @param {string} [note] */
  async function nextDecide(choice, note) {
    const card = $("#hm-next .next");
    if (!card || card._busy) return;
    const key = card.dataset.key;
    const seen = NEXT_SEEN.get(/** @type {string} */ (key));
    if (seen == null || performance.now() - seen < Kit.READ_MS) { if (card.classList.contains("r-notable")) announce("A beat to read it first."); return; }
    card._busy = true;
    card.focus({ preventScroll: true });
    if (!D.decideNow(key, choice, note)) { card._busy = false; return; }
    if (!RM.matches) { card.classList.add(choice === "deny" ? "st-back" : "st-allow"); await wait(choice === "deny" ? 260 : 300); }
    S.pin = null;
    schedule();
    requestAnimationFrame(() => requestAnimationFrame(() => { const nc = $("#hm-next .next"); if (nc && S.view === "home" && !D.isOpen()) nc.focus({ preventScroll: true }); }));
  }

  return { homeRender, nextDecide };
}
