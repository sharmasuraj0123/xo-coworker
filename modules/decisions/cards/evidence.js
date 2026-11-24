// @ts-check

import { esc } from "../../../core/platform/util.js";
import { clock } from "../../../core/platform/time.js";
import { evidenceOf } from "../../../core/services/review.js";
import { resetWords, rtName } from "../../../core/services/runtimes.js";
import { ICON, stepMark } from "../../../core/ui/icons/names.js";
import { renderMarkdown } from "../../../core/ui/markdown/markdown.js";
import { highlight } from "../../../core/ui/markdown/highlight.js";

/** @import { Change, EvidenceNeed, ItemNeed, LimitItem } from "./evidence-types.d.ts" */

/** @param {Change | null | undefined} c */
function changeBlock(c) {
  if (!c) return "";
  const hl = c.lang !== "diff" ? highlight(c.text, c.lang) : null;
  if (hl != null) return `<figure class="chg"><figcaption>${ICON.doc}<span>${esc(c.label)}</span></figcaption><pre><code class="hl">${hl}</code></pre></figure>`;
  const lines = esc(c.text).split("\n").map((l) => {
    const cls = c.lang === "diff" ? (l.startsWith("+") ? "dl-add" : l.startsWith("-") ? "dl-del" : "") : "";
    return `<span class="${cls}">${l || " "}</span>`;
  }).join("\n");
  return `<figure class="chg"><figcaption>${ICON.doc}<span>${esc(c.label)}</span></figcaption><pre><code>${lines}</code></pre></figure>`;
}

/** @param {EvidenceNeed} n @param {{change?: Change | null, why: string}} ev */
export function detailsHtml(n, ev) {
  const t = n.t;
  const msgs = t.messages.slice(-2);
  const ck = t.checklist.items.map((i) => `<li class="ck ck-${i.state}"><span class="ck-m" aria-hidden="true">${stepMark(i.state)}</span><span>${esc(i.text)}</span></li>`).join("");
  return `<div class="dt">` +
    `<div class="dt-main">${changeBlock(ev.change)}` +
    `<p class="dt-why">${esc(ev.why)}</p>` +
    `<ol class="ev-msgs">${msgs.map((m) => `<li><b>${m.who === "you" ? "You" : "Agent"}</b><span>${esc(m.text)}</span><time>${clock(m.at)}</time></li>`).join("")}</ol></div>` +
    `<div class="dt-side"><h4>Checklist <span>${t.checklist.done} of ${t.checklist.total}</span></h4><ol class="ck-list">${ck}</ol>` +
    (t.branch ? `<p class="ev-br">${ICON.branch}<code>${esc(t.branch)}</code></p>` : "") + `</div></div>`;
}

/** @param {string} o @param {number} i @param {{preview?: {label: string, css: string, sample?: string}[] | null}} ev */
export function optHtml(o, i, ev) {
  const pv = ev.preview ? ev.preview.find((p) => p.label === o) : null;
  return `<button type="button" class="b b-opt${pv ? " has-pv" : ""}" data-opt="${i}" title="Answer “${esc(o)}” (${i + 1})">${pv ? `<span class="o-pv" aria-hidden="true"><span class="o-s" style="${esc(pv.css)}">${esc(pv.sample || o)}</span></span>` : ""}<span class="o-l">${esc(o)}</span></button>`;
}

/** @param {ItemNeed} n */
export function itemDetailsHtml(n) {
  const it = n.ask.item;
  const ev = evidenceOf(it);
  const blocks = ev.blocks.map((b) => b.lang === "md"
    ? `<figure class="chg is-md"><figcaption>${ICON.doc}<span>${esc(b.label)}</span></figcaption><div class="prose chg-md">${renderMarkdown(b.text)}</div></figure>`
    : changeBlock({ label: b.label, lang: b.lang, text: b.text })).join("");
  const notes = (it.annotations || []).map((a) => `<p class="dt-sug"><b>${a.by === "coordinator" ? "The coordinator" : "The agent"}:</b> ${esc(a.note)}</p>`).join("");
  const facts = ev.facts.length ? `<ul class="dt-facts">${ev.facts.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : "";
  const t = n.t;
  const ck = t.checklist.items.map((i) => `<li class="ck ck-${esc(i.state)}"><span class="ck-m" aria-hidden="true">${stepMark(i.state)}</span><span>${esc(i.text)}</span></li>`).join("");
  return `<div class="dt"><div class="dt-main">${blocks}${facts}${notes}</div>` +
    (t.host ? "" : `<div class="dt-side"><h4>Checklist <span>${t.checklist.done} of ${t.checklist.total}</span></h4><ol class="ck-list">${ck}</ol>${t.branch ? `<p class="ev-br">${ICON.branch}<code>${esc(t.branch)}</code></p>` : ""}</div>`) + `</div>`;
}

/** @param {LimitItem} it */
export function limitHtml(it) {
  const L = it.limit;
  const when = L.resetsAt ? resetWords(L.resetsAt) : "";
  return `<div class="lim">${when ? `<p class="lim-when">${ICON.clock}<span>Opens again ${esc(when)}</span></p>` : ""}` +
    `<ul class="lim-ts" aria-label="Waiting threads">${L.threads.map((x) => `<li><button type="button" class="rt-go" data-go="t:${esc(x.ts)}" title="Open “${esc(x.title || "the thread")}”"><b>${esc(x.title || "A thread")}</b></button>${x.stays ? `<span class="lim-stay">stays: its project doesn't allow ${esc(rtName(L.moveTo))}</span>` : ""}</li>`).join("")}</ul></div>`;
}
