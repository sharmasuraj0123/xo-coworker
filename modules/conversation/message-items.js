// @ts-check

import { clock, dayOf } from "../../core/platform/time.js";
import { esc } from "../../core/platform/util.js";
import { untilWords } from "../../core/services/runtimes.js";
import { ownReply } from "../../core/services/world/conversation.js";
import { ICON, XO } from "../../core/ui/icons/names.js";
import { renderMarkdown } from "../../core/ui/markdown/markdown.js";
import { mediaHtml } from "../../core/services/media/render.js";
import { fromAttachment } from "../../core/services/media/items.js";
import { turnHtml, turnAv } from "./blocks/turn.js";

/** @import { MessageItemsDeps } from "./message-items-types.d.ts" */

/** @import { Control, Forward, History, Limit, Message } from "./message-types.d.ts" */

/** @import { RankedNeed } from "../../core/services/decision-types.d.ts" */

/** @import { Block, Turn } from "./blocks/turn.js" */

/** @param {string} text @param {string} view */
function proseHtml(text, view) {
  const html = renderMarkdown(text, view);
  return `<div class="prose${html.includes('<div class="md-table') ? " has-table" : ""}">${html}</div>`;
}

/** @param {number} n */
const HS_THEM = (n) => `<div class="hs-them" aria-hidden="true"><i class="hs-av"></i><div class="hs-b"><i class="hs-bar hs-name"></i>${"<i class=\"hs-bar\"></i>".repeat(n)}</div></div>`;
const HIST_SKEL = `<div class="hist-skel" role="status"><span class="sr-only">Loading earlier messages</span>${HS_THEM(2)}` +
  `<div class="hs-you" aria-hidden="true"><i class="hs-bub"><i class="hs-bar"></i></i></div>${HS_THEM(1)}</div>`;
/** @param {Message[]} list @param {Message} m */
const answeredAfter = (list, m) => {
  const i = list.indexOf(m);
  return i >= 0 && list.slice(i + 1).some((x) => ownReply(x) ||
    (x.who === "turn" && x.turn && x.turn.status !== "running" && Array.from(x.blocks || []).some((b) => b && (b.type === "answer" || b.type === "text") && String(b.text || "").trim())));
};

/** Who wrote a copied message and where. @param {Message} m @param {Forward} fwd @param {string | null} src @param {(p: string) => string} P */
function copyHead(m, fwd, src, P) {
  const coord = m.who === "coord", ws = !src && fwd.via?.[0] === "workspace", lead = m.name ? "from" : coord ? "of" : "in";
  const by = ws ? "The Workspace coordinator" : coord ? "The coordinator" : m.author === "thread" ? "A thread" : "An agent";
  /** @param {string} where @param {string} words */
  const go = (where, words) => `<button type="button" class="rt-go" data-go="${esc(where)}" data-go-msg="${esc(fwd.id)}"`
    + ` title="Where it was written">${esc(words)}</button>`;
  const from = src ? `${lead} ${go(`p:${src}`, P(src))}<span class="via"> · copied here by the Workspace</span>`
    : ws ? `· ${go("ws", "copied from the Workspace")}` : `${m.name ? "from" : "in"} another chat · copied here by the ${go("ws", "Workspace")}`;
  return { by, from, name: ws ? by : `${by} ${src ? `${coord ? "of" : "in"} ${P(src)}` : "in another chat"}` };
}

/** A Space notice as a storage meter. @param {Message} m @param {(p: string) => boolean} isProject */
function spaceHtml(m, isProject) {
  const n = /** @type {NonNullable<Message["space"]>} */ (m.space), via = m.fwd ? " · via the Workspace" : "";
  if (n.percent == null || n.total == null) return `<span class="ev-t"><b>Space advisory</b>${via} · ${esc(m.text || "")}</span>`;
  const total = n.total, used = Math.round(total * n.percent) / 100, named = n.users.reduce((a, u) => a + u.gb, 0);
  const rest = Math.round((used - named) * 10) / 10;
  const parts = [...n.users.map((u, i) => ({ ...u, k: Math.min(i + 1, 3) })),
    ...(rest > 0 && n.users.length ? [{ name: "Other", gb: rest, threads: null, k: 4 }] : [])];
  const seg = parts.map((u) => `<i class="sp-k${u.k}" style="flex-basis:${(u.gb / total) * 100}%"></i>`).join("");
  const key = parts.map((u) => {
    const word = u.k < 4 && isProject(u.name) ? `<button type="button" class="rt-go" data-go="p:${esc(u.name)}">${esc(u.name)}</button>`
      : esc(u.name[0].toUpperCase() + u.name.slice(1));
    const tip = u.threads != null ? ` title="${u.threads} thread${u.threads === 1 ? "" : "s"}"` : "";
    return `<li class="sp-k${u.k}"${tip}>${word} <span>${u.gb} GB</span></li>`;
  }).join("");
  const title = n.percent >= 90 ? "Memory almost full" : n.percent >= 75 ? "Memory running high" : "Memory";
  const bar = `<span class="sp-bar" role="meter" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(n.percent)}"`
    + ` aria-label="Memory used">${seg || `<i class="sp-k1" style="flex-basis:${n.percent}%"></i>`}</span>`;
  return `<div class="ev-t sp-body"><p class="sp-head"><b>${title}</b><span>${used} of ${n.total} GB used · ${n.percent}%</span></p>${bar}`
    + `${key ? `<ul class="sp-users" aria-label="Who uses it">${key}</ul>` : ""}<p class="sp-src">Space advisory${via}</p></div>`;
}

/** @param {MessageItemsDeps} deps */
export function createMessageItems({
  limitStatus, world, CH, CHG, STAGE, PROJ, projects, convThread, convProject, messagesOf, fwdSource, reactionsHtml,
  youText, startHtml, fileRoute, threadCardHtml, queuedMeta, nameOf, moveBannerHtml, setupBannerHtml, handBackRowHtml, passedTo,
  transcriptOpen,
}) {
  /** @param {string} conv @param {RankedNeed[]} needs */
  function msgItems(conv, needs) {
    if (CH.isChats(conv)) return CH.items(conv);
    if (conv.startsWith("t:") && !convThread(conv)) {
      const known = projects().length > 0;
      return [{ key: "gone", html: known
        ? `<div class="calm"><div class="calm-mark">${ICON.thread}</div><h2>This thread isn't here.</h2><p>It may have been removed, or the link is older than this Space. Everything else is where you left it.</p><div class="calm-act"><button type="button" class="btn" data-go="home">Go to Home</button></div></div>`
        : `<div class="calm"><div class="calm-mark">${ICON.thread}</div><h2>Looking for this thread…</h2></div>` }];
    }
    const list = messagesOf(conv);
    const items = [];
    let day = "", prev = /** @type {Message | null} */ (null), above = /** @type {Message | null} */ (null);
    const named = !!convThread(conv);
    let spoke = null, notices = 0;
    const lastYou = [...list].reverse().find((m) => m.who === "you");
    const lastQueued = [...list].reverse().find((m) => m.queued);
    const chosen = STAGE.chosen(conv);
    /** @param {string} target */
    const changed = (target) => { const c = CHG.forTarget(conv, target); return c ? { additions: c.file.additions, deletions: c.file.deletions, binary: c.file.binary, on: c.path === chosen } : null; };
    for (const m of list) {
      const d = Number.isFinite(m.at) ? dayOf(m.at) : day;
      if (d !== day) { items.push({ key: "day|" + d, html: `<div class="day" role="separator"><span>${esc(d)}</span></div>` }); day = d; prev = null; above = null; spoke = null; }
      const cont = prev && prev.who === m.who && prev.name === m.name && m.at - prev.at < 5 * 60000 && (prev.fwd?.chatId || null) === (m.fwd?.chatId || null) && (m.who === "you" || m.who === "coord" || m.who === "agent");
      let html = "";
      if (m.who === "you") {
        spoke = "you";
        let meta = "";
        if (m.status === "sending") meta = `<div class="meta is-sending"><i class="spin" aria-hidden="true"></i>Sending</div>`;
        else if (m.status === "failed") meta = `<div class="meta is-err"><span${m.err ? ` title="${esc(m.err.text)}"` : ""}>${m.err ? esc(m.err.title) : "Not sent"}</span><button type="button" class="meta-btn" data-retry="${esc(m.id)}">${ICON.retry}Retry</button><button type="button" class="meta-btn" data-edit="${esc(m.id)}">${ICON.edit}Edit</button></div>`;
        else if (m === lastQueued) meta = queuedMeta(conv, answeredAfter(list, m));
        else if (m === lastYou && (m.status === "sent" || m.sent) && !answeredAfter(list, m)) {
          const to = passedTo(m);
          meta = `<div class="meta"><time>${clock(m.at)}</time><span class="sent">${to ? `Passed to <b>${esc(to)}</b>` : "Received by XO"} ${ICON.check}</span></div>`;
        }
        let route = "";
        if (m.waiting) route = `<div class="route-row"><i class="dash" aria-hidden="true"></i>Sent to <b>${esc(m.target === "workspace" ? "the coordinator" : PROJ(m.target))}</b> · waiting for a thread</div>`;
        else if (m.relay) {
          const r = m.relay, P = PROJ(r.project);
          const when = r.at ? ` at ${clock(r.at)}` : "";
          route = r.fwd
            ? `<div class="route-row">${ICON.arrow}<span>You, in the <button type="button" class="rt-go" data-go="ws" data-go-msg="${esc(r.fwd.id)}" title="Where you wrote it"><b>Workspace</b></button> · passed on${when} by ${esc(P)}'s coordinator</span></div>`
            : `<div class="route-row">${ICON.arrow}<span>You, in <button type="button" class="rt-go" data-go="p:${esc(r.project)}" data-go-msg="${esc(r.id)}" title="Where you wrote it"><b>${esc(P)}'s chat</b></button> · passed on${when} by the coordinator</span></div>`;
        }
        else if (m.fwd) {
          const src = fwdSource(m.fwd);
          route = src
            ? `<div class="route-row">${ICON.arrow}<span>From <button type="button" class="rt-go" data-go="p:${esc(src)}" data-go-msg="${esc(m.fwd.id)}" title="Where you wrote it"><b>${esc(PROJ(src))}</b></button> via the Workspace</span></div>`
            : `<div class="route-row">${ICON.arrow}<span>Forwarded by the <button type="button" class="rt-go" data-go="ws" data-go-msg="${esc(m.fwd.id)}" title="Where you wrote it"><b>Workspace</b></button></span></div>`;
        }
        else if (m.routed && m.routed.length) route = `<div class="route-row">${ICON.arrow}<span>Routed to ${[...new Set(m.routed.map((r) => r.chat))].map((c) => `<button type="button" class="rt-go" data-go="p:${esc(c)}"><b>${esc(PROJ(c))}</b></button>`).join(", ")}</span></div>`;
        const files = m.files && m.files.length ? mediaHtml(m.files.map((f) => fromAttachment(f, { chat: m.chatId, by: "You", at: m.at })), { side: "you" }) : "";
        html = `<div class="m m-you${cont ? " cont" : ""}${m.relay ? " is-relay" : ""}${m.status === "failed" ? " is-failed" : ""}${m.status === "sending" ? " is-pending" : ""}">${files}${m.text ? `<div class="bubble" title="${esc(clock(m.wrote ?? m.at))}">${youText(m.text)}</div>` : ""}${reactionsHtml(m.reactions)}${meta}${route}</div>`;
      } else if (m.who === "coord" || m.who === "agent") {
        const src = m.fwd ? fwdSource(m.fwd) : null, copy = m.fwd ? copyHead(m, m.fwd, src, PROJ) : null;
        const [name, role] = m.name ? [m.name, m.role || ""] : copy ? [copy.name, ""] : nameOf(conv, m.who);
        const from = copy ? `<span class="m-from">${copy.from}</span>` : "";
        const av = m.fwd ? `<div class="av av-p">${ICON.project}</div>`
          : m.who === "coord" ? `<div class="av">${XO}</div>` : `<div class="av av-t">${ICON.thread}</div>`;
        const joined = cont && !m.fwd;
        const tid = m.thread || m.threadId;
        const iq = m.iq ? `<span class="m-iq" title="${m.iq.src === "pinned" ? "Pinned for this conversation" : `Chosen by the ${esc(m.iq.src)}`}">${esc(m.iq.name)} ${m.iq.pips} · ${esc(m.iq.src)}</span>` : "";
        const media = m.files && m.files.length ? mediaHtml(m.files.map((f) => fromAttachment(f, { chat: m.chatId, by: name, at: m.at })), { side: "them" }) : "";
        const under = !!(above && ((m.cause && above.who === "asked" && above.hop === m.cause) || (m.lead && above.key === m.lead)));
        const anon = !m.fwd && (!named || spoke === name || under);
        spoke = name;
        if (under) items[items.length - 1].html = items[items.length - 1].html.replace(/^<div class="ev /, '<div class="ev is-lead ');
        html = `<div class="m m-them${(m.who === "coord" || m.coord) && convThread(conv) ? " m-coord" : ""}${m.fwd ? " m-ext" : ""}${joined ? " cont" : ""}${anon ? " m-anon" : ""}${under ? " m-under" : ""}">${joined ? `<div class="av av-gap"></div>` : av}<div class="mb">` +
          (joined ? "" : `<div class="mh"><b>${esc(copy && !m.name ? copy.by : name)}</b>${from}${role ? `<span class="role">${esc(role)}</span>` : ""}<time>${clock(m.at)}</time>${iq}</div>`) +
          `${m.text ? proseHtml(m.text, conv) : ""}${media}${reactionsHtml(m.reactions)}${tid ? threadCardHtml(tid, needs) : ""}${(m.threads || []).map((x) => threadCardHtml(x, needs)).join("")}</div></div>`;
      } else if (m.who === "turn") {
        const inner = turnHtml(/** @type {Turn} */ (m.turn), /** @type {Block[]} */ (m.blocks), { view: conv, open: transcriptOpen(), hideAnswer: m.hideAnswer, carried: m.carried, route: (p) => fileRoute(p, conv), by: nameOf(conv, "agent")[0], working: m.working, changed });
        if (!inner) { prev = m; continue; }
        const live = (/** @type {Turn} */ (m.turn)).status === "running", unfolded = inner.includes('aria-expanded="true"') || /class="[^"]*\bis-waiting\b/.test(inner);
        const said = live && !unfolded && /class="turn[^"]*\bis-said\b/.test(inner);
        spoke = nameOf(conv, "agent")[0];
        html = `<div class="m m-them m-turn${live ? " is-live" : ""}${live && !unfolded ? " is-folded" : ""}${said ? " has-said" : ""}">${turnAv(/** @type {Turn} */ (m.turn), m.blocks)}<div class="mb">${inner}</div></div>`;
      } else if (m.who === "card") {
        html = `<div class="m m-them m-card"><div class="av av-gap"></div><div class="mb">${threadCardHtml(/** @type {string} */ (m.thread), needs)}</div></div>`;
      } else if (m.who === "system" && m.space) {
        const hot = m.space.percent != null && m.space.percent >= 90;
        const again = prev?.space ? notices + 1 : 1;
        if (again > 1) items.pop();
        notices = again;
        html = `<div class="ev ev-space${hot ? " is-hot" : ""}" role="status"><span class="ev-ic">${ICON.warn}</span>` +
          `${spaceHtml(m, (p) => !!world.project(p))}` +
          `${again > 1 ? `<span class="ev-n">updated ${again}×</span>` : ""}<time>${clock(m.at)}</time></div>`;
      } else if (m.who === "system" && m.back) {
        const b = m.back, q = b.text.replace(/\s+/g, " ").trim(), via = (b.via || []).find((v) => v !== "workspace" && v !== "project" && world.project(v));
        html = `<div class="ev ev-sys ev-back"><span class="ev-ic">${ICON.arrow}</span><span class="ev-t">Your earlier message <button type="button" class="rt-go" data-go="p:${esc(convProject(conv))}" data-go-msg="${esc(b.id)}" title="Where you wrote it">“${esc(q.length > 40 ? q.slice(0, 39) + "…" : q)}”</button> came back${via ? ` via ${esc(PROJ(via))}` : ""}</span><time>${clock(m.at)}</time></div>`;
      } else if (m.who === "system" && m.passedOn) {
        const p = m.passedOn;
        html = `<div class="ev ev-sys ev-pass"><span class="ev-ic">${ICON.arrow}</span><span class="ev-t">Passed to <button type="button" class="rt-go" data-go="p:${esc(p.project)}"${p.to ? ` data-go-msg="${esc(p.to)}"` : ""} title="Open ${esc(PROJ(p.project))}'s chat"><b>${esc(PROJ(p.project))}</b></button> through the Workspace</span><time>${clock(m.at)}</time></div>`;
      } else if (m.who === "control") {
        const c = /** @type {Control} */ (m.ctl);
        const who = c.by === "workspace-coordinator" ? "The workspace coordinator" : "The coordinator";
        const text = c.action === "steer" ? `${who} added to the running turn` : c.action === "interrupt" ? `${who} interrupted the turn` : `${who} stopped the thread${c.reason ? `: ${c.reason}` : ""}`;
        html = `<div class="ev ev-sys ev-ctl is-${esc(c.action)}"${c.reason && c.action !== "stop" ? ` title="${esc(c.reason)}"` : ""}><span class="ev-ic">${c.action === "steer" ? ICON.arrow : c.action === "interrupt" ? ICON.pause : ICON.close}</span><span class="ev-t">${esc(text)}</span><time>${clock(m.at)}</time></div>`;
      } else if (m.who === "limit") {
        const it = /** @type {Limit} */ (m.item), L = it.limit;
        const status = limitStatus(it.id);
        const opts = (it.options || []).map((o) => `<button type="button" class="${o.decision === "move" ? "btn btn-pri" : "btn"}" data-limit="${esc(it.id)}" data-limit-d="${esc(o.decision)}"${status?.busy ? " disabled" : ""}>${esc(o.label)}</button>`).join("");
        html = `<div class="lim-ban" role="group" aria-labelledby="lim-h-${esc(it.id)}"><p class="lim-h" id="lim-h-${esc(it.id)}">${ICON.clock}<span>${esc(it.title)}${L.resetsAt && untilWords(L.resetsAt) ? ` <em>${esc(untilWords(L.resetsAt))}</em>` : ""}</span></p>` +
          (it.why ? `<p class="lim-why">${esc(it.why)}</p>` : "") + (status?.error ? `<p class="rt-ferr" role="alert">${esc(status.error)}</p>` : "") + `<div class="lim-acts">${opts}</div></div>`;
      } else if (m.who === "system" && (m.continuedIn || m.continuedFrom)) {
        html = moveBannerHtml(m, convThread(conv));
      } else if (m.who === "system" && m.setup) {
        html = setupBannerHtml(m, convThread(conv));
      } else if (m.who === "handback") {
        const t = convThread(conv);
        if (!t || !m.hopRow) { prev = m; continue; }
        html = handBackRowHtml(m.hopRow, t);
      } else if (m.who === "asked") {
        const open = !!transcriptOpen()[m.key];
        html = `<div class="ev ev-sys ev-asked${open ? " is-open" : ""}"><span class="ev-ic">${ICON.arrow}</span><button type="button" class="ev-t" data-tb="${esc(m.key)}" aria-expanded="${open}" title="${open ? "Fold" : "Show all of it"}">Asked the coordinator: ${esc(m.text)}</button><time>${clock(m.at)}</time></div>`;
      } else if (m.who === "system") {
        html = `<div class="ev ev-sys" title="${esc(m.text)}"><span class="ev-ic">${ICON.router}</span><span class="ev-t">${esc(m.text)}</span><time>${clock(m.at)}</time></div>`;
      } else if (m.who === "note") {
        html = m.load ? `<div class="m-load" role="status"><i class="spin is-load" aria-hidden="true"></i><span class="sr-only">${esc(m.load)}</span></div>` : `<p class="m-note">${esc(m.text)}</p>`;
      } else if (m.who === "start") {
        html = startHtml(/** @type {string} */ (m.pid));
      } else if (m.who === "hist") {
        const h = /** @type {History} */ (m.h);
        html = h.loading ? HIST_SKEL
          : `<div class="day hist" role="separator">${h.all ? `<span>${h.capped ? "Showing the latest 1,000 messages" : "Beginning of the conversation"}</span>` : h.olderError ? `<span>Couldn't load earlier messages</span><button type="button" class="hist-more" data-older>Try again</button>` : `<button type="button" class="hist-more" data-older>Earlier messages</button>`}</div>`;
      } else if (m.who === "event") {
        html = `<div class="ev ev-${m.tone || "ok"}"><span class="ev-ic">${m.tone === "back" ? ICON.rewind : m.tone === "stop" ? ICON.close : m.tone === "sys" ? ICON.pause : ICON.check}</span><span class="ev-t">${esc(m.text)}</span><time>${clock(m.at)}</time></div>`;
      } else if (m.who === "rec") {
        const canUndo = m.undo && Date.now() < (/** @type {number} */ (m.until));
        html = `<div class="ev ev-rec${m.refused ? " is-refused" : ""}"><span class="ev-ic">${m.refused ? ICON.close : ICON.router}</span><span class="ev-t">${esc(m.text)}</span>${canUndo ? `<button type="button" class="ev-undo" data-rec-undo="${esc(m.id)}">Undo</button>` : ""}<time>${clock(m.at)}</time></div>`;
      }
      items.push({ key: m.key, html });
      prev = above = m;
    }
    return items;
  }

  return { msgItems };
}
