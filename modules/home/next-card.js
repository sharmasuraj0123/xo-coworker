// @ts-check

import { esc } from "../../core/platform/util.js";
import { itemParts } from "../../core/services/review.js";
import { ICON } from "../../core/ui/icons/names.js";

/** @import { Evidence, NextCardDeps, NextCardNeed } from "./next-card-types.d.ts" */

/** @param {NextCardDeps} options */
export function createNextCard({ D, Kit, evidenceFor, PROJ, convOfChat }) {
  /** @param {string} o @param {number} i @param {Evidence} ev */
  function optHtml(o, i, ev) {
    const pv = ev && ev.preview ? ev.preview.find((p) => p.label === o) : null;
    return `<button type="button" class="b b-opt${pv ? " has-pv" : ""}" data-fid="opt${i}" data-nx-opt="${i}" title="Answer “${esc(o)}”">${pv ? `<span class="o-pv" aria-hidden="true"><span class="o-s" style="${esc(pv.css)}">${esc(pv.sample || o)}</span></span>` : ""}<span class="o-l">${esc(o)}</span></button>`;
  }

  /** @param {NextCardNeed} n */
  function nextActHtml(n) {
    const a = n.ask;
    const binary = Kit.isBinary(a);
    const details = `<button type="button" class="b b-ghost b-later" data-fid="ev" data-decide="${esc(n.key)}" title="Open it in the panel"><span class="b-l">${ICON.eye}Details</span></button>`;
    let html = "";
    if (n.effort === "glance" && Array.isArray(a.options) && !binary) {
      const ev = evidenceFor(n);
      html += `<div class="c-opts n${Math.min(a.options.length, 3)}" role="group" aria-label="Answers">${a.options.map((o, i) => optHtml(o, i, ev)).join("")}</div>` +
        `<div class="c-btns"><button type="button" class="b b-back" data-fid="back" data-nx-back><span class="b-l">${ICON.rewind}Send back</span></button>${details}</div>`;
    } else if (n.effort === "glance" && binary) {
      const IP = a.item ? itemParts(a.item) : null;
      const yes = IP && IP.primary ? IP.primary.label : "Allow", no = IP && IP.back ? IP.back.label : "Send back";
      html += `<div class="c-btns"><button type="button" class="b b-allow" data-fid="allow" data-nx-allow><span class="b-l">${ICON.check}${esc(yes)}</span></button><button type="button" class="b b-back" data-fid="back" data-nx-back><span class="b-l">${ICON.rewind}${esc(no)}</span></button>${details}</div>`;
    } else {
      const verb = n.group === "stopped" ? "Look and choose" : n.risk === "destructive" ? "Read it closely" : n.ask.kind === "action" ? "See what it needs" : n.ask.replyOnly ? "Read and reply" : "Decide";
      html += `<div class="c-btns"><button type="button" class="b b-go" data-fid="go" data-decide="${esc(n.key)}"><span class="b-l">${verb}${ICON.arrow}</span></button>` +
        (n.effort === "think" ? `<button type="button" class="b b-ghost b-later" data-fid="later" data-later="${esc(n.key)}" title="Park it until later today"><span class="b-l">${ICON.clock}Later today</span></button>` : "") + `</div>`;
    }
    const kept = D.failedNote(n.key);
    html += `<div class="c-note nx-note"${kept ? "" : " hidden"}>${kept ? `<p class="c-hint show stay" role="status">That didn't send. Your note is still here: Send back tries again.</p>` : ""}<label for="nx-note-in" class="c-note-l">What should it do instead? (optional)</label><textarea id="nx-note-in" rows="2" placeholder="e.g. what it should try instead">${esc(kept)}</textarea>` +
      `<div class="c-note-row"><button type="button" class="b b-sm b-go" data-nx-send>${ICON.rewind}Send back</button><button type="button" class="b b-sm b-ghost" data-nx-cancel>Cancel</button></div></div>`;
    return html;
  }

  /** @param {NextCardNeed} n */
  return function nextCardHtml(n) {
    const t = n.t, P = D.parts;
    const where = t.host
      ? `<button type="button" class="c-where" data-fid="where"${t.chatId ? ` data-go="${esc(convOfChat(t.project))}"` : t.plainSession ? ` data-go="c:${esc(t.plainSession)}"` : ""} title="${t.asker ? `Open ${esc(PROJ(t.project))}, where its coordinator asks` : "Where it was asked"}">${t.asker ? `${esc(PROJ(t.project))}<span aria-hidden="true">›</span><b>${esc(t.title)}</b>` : esc(t.title)}</button>`
      : `<button type="button" class="c-where" data-fid="where" data-go="t:${esc(t.id)}" title="Open the thread">${esc(PROJ(t.project))}<span aria-hidden="true">›</span><b>${esc(t.title)}</b></button>`;
    const chips = P.chipsHtml(n);
    return `<article class="next r-${n.risk} e-${n.effort}${D.failedNote(n.key) ? " noting" : ""}" data-key="${esc(n.key)}" data-fid="nextcard" tabindex="-1" aria-labelledby="nx-h">` +
      `<div class="stamp stamp-allow" aria-hidden="true">${ICON.stampAllow}</div>` +
      `<div class="nx-in"><div class="c-body">` +
      `<div class="c-top">${P.effTagHtml(n)}${where}</div>` +
      P.leadHtml(n, "nx", "h2") +
      (chips ? `<div class="c-chips"><ul class="chips" aria-label="About this">${chips}</ul></div>` : "") +
      `</div><div class="c-act">${nextActHtml(n)}</div></div></article>`;
  }
}
