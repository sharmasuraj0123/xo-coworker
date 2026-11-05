// The conversation's bubbles (with css/msgx.css): the shipped chat look and its behaviour, not an
// experiment. It reads #msgs and decorates what app.js draws (it never changes the app's list), so the app
// works without it, but the chat as designed needs it. Nothing here sends anything on its own: a reply
// only adds a quote ("> …") to the message you send yourself.
//
//   The look is final (owner, 5 Nov): yours in XO's green, theirs on glass, a tail on the first bubble of
//   each run, every reply in a bubble. There is no switch.
//   Replies:
//     · hover a message: Reply and Copy on a small glass bar
//     · select words in a message: "Reply to this" quotes exactly them
//     · swipe a message right (trackpad or touch): reply, like WhatsApp
//     · swipe left anywhere: every message's time slides in, like Messages
//     · a sent reply shows its quote as a card in your bubble; press it to go back to the original

import { elapsed } from "./ui.js";

const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement;
const I = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  reply: I('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  down: I('<path d="M6 9.5l6 6 6-6"/>'),
};

// The CSS keys off these attributes. Fixed: XO's green for yours, tails on, long replies stay bubbles.
root.dataset.msgx = "bubbles";
root.dataset.msgxTone = "xo";
root.dataset.msgxTails = "";
delete root.dataset.msgxOpen;
const conv = $("#conv");

// ── decorating what the app draws ───────────────────────────────────────────
const msgs = $("#msgs");
function nameIn(m) {
  if (m.classList.contains("m-you")) return "You";
  if (m.classList.contains("m-turn")) {
    // the name the agent signs its own messages with (theirs carry the thread tile, a coordinator's the XO mark)
    const n = [...msgs.querySelectorAll(".m-them > .av-t + .mb > .mh b")].pop();
    return n ? n.textContent.trim() : "Agent";
  }
  for (let el = m; el; el = el.previousElementSibling) {
    const b = el.querySelector(":scope .mh b");
    if (b) return b.textContent.trim();
    if (el.classList.contains("m-turn")) return "The agent";
    if (!el.classList.contains("cont")) break;
  }
  return "The agent";
}
function timeIn(m) {
  const t = m.querySelector(".bubble[title]")?.getAttribute("title") || m.querySelector(".mh time, :scope > time, .meta time")?.textContent;
  if (t) return t.trim();
  for (let el = m.previousElementSibling; el; el = el.previousElementSibling) if (el.dataset.mxTime) return el.dataset.mxTime;
  return "";
}
/** The element that is a message's bubble: yours, theirs, or the answer at the end of an agent's turn. */
function bubbleOf(m) {
  if (m.classList.contains("m-you")) return m.querySelector(":scope > .bubble");
  if (m.classList.contains("m-turn")) return [...m.querySelectorAll(".turn > .tb-answer, .turn > .tb-text")].pop() || null;
  return m.querySelector(":scope > .mb > .prose");
}
const textOf = (m) => { const b = m.querySelector(".bubble, .mb > .prose, .tb-answer"); if (!b) return ""; const c = b.cloneNode(true); c.querySelector(".mx-name")?.remove(); return (c.innerText || c.textContent || "").trim(); };

/** A sent reply starts with "> " lines: show them as a card at the top of your bubble. */
function quoteCard(m) {
  const b = m.querySelector(".bubble");
  if (!b || b._mxq || !/^> /.test(b.textContent)) return;
  b._mxq = true;
  const lines = b.textContent.split("\n");
  let i = 0; const q = [];
  while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
  const rest = lines.slice(i).join("\n").replace(/^\n+/, "");
  const who = (q[0].match(/^\*\*(.+?)\*\*$/) || [])[1];
  const said = (who ? q.slice(1) : q).join(" ").replace(/^[“"]|[”"]$/g, "");
  b.textContent = "";
  const card = document.createElement("button");
  card.type = "button"; card.className = "mx-qc"; card.dataset.mxJump = said;
  card.title = "Go to the message";
  card.innerHTML = `<b></b><span></span>`;
  card.querySelector("b").textContent = who || "Quote";
  card.querySelector("span").textContent = said;
  b.append(card, document.createTextNode(rest));
}

function decorate() {
  const kids = [...msgs.children];
  kids.forEach((el) => {
    if (!el.classList.contains("m") && !el.classList.contains("ev")) return;
    if (!el.dataset.mxTime) { const t = timeIn(el); if (t) el.dataset.mxTime = t; }
    if (!el.classList.contains("m") || el._mx) return;
    el._mx = true;
    el.dataset.noswipe = ""; // a swipe on a message is a reply here; the page's back-swipe starts elsewhere
    const acts = document.createElement("div");
    acts.className = "mx-acts";
    acts.innerHTML = `<button type="button" data-mx-reply title="Reply" aria-label="Reply">${IC.reply}</button><button type="button" data-mx-copy title="Copy" aria-label="Copy">${IC.copy}</button>`;
    const arrow = document.createElement("span");
    arrow.className = "mx-swipe"; arrow.innerHTML = IC.reply; arrow.setAttribute("aria-hidden", "true");
    quoteCard(el);
    // Reply and Copy sit beside the bubble itself; a message with no words (a card, pictures) has neither
    const bub = bubbleOf(el);
    if (bub) bub.append(acts);
    if (bub && !el.classList.contains("m-you")) {
      const foot = acts.cloneNode(true); foot.classList.add("is-foot");
      el.querySelector(":scope > .mb")?.append(foot);
    } else if (!bub && el.querySelector(".mx-stack, .tb-files")) {
      // pictures with no words still take a reply: beside the last picture, at its foot
      const foot = acts.cloneNode(true); foot.classList.add("is-foot");
      foot.querySelector("[data-mx-copy]")?.remove();
      el.classList.add("mx-nobub");
      (el.querySelector(":scope > .mb") || el).append(foot);
    }
    // the swipe's arrow: beside your bubble, or in the gap a reply leaves on the left
    (el.classList.contains("m-you") && el.querySelector(".bubble") || el).append(arrow);
  });
  // a few emoji and nothing else are the message itself: large, without a bubble
  for (const el of kids) {
    if (!el.classList.contains("m") || el._mxe === el.textContent) continue;
    el._mxe = el.textContent;
    const t = (el.querySelector(".bubble") || el.querySelector(".mb > .prose, .tb-answer"))?.textContent.trim() || "";
    el.classList.toggle("mx-emoji", t.length > 0 && t.length <= 16 && /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u.test(t) && !/^[\d#*\s]+$/.test(t));
  }
  // Tails: on the first bubble of each run, pointing at the mark and name above it (as WhatsApp does)
  for (const el of kids) {
    if (!el.classList.contains("m")) continue;
    const b = bubbleOf(el);
    if (!b) continue;
    const you = el.classList.contains("m-you");
    const prev = el.previousElementSibling;
    const runStarted = you ? el.classList.contains("cont") : el.classList.contains("cont") || (prev && prev.matches(".m-them") && el.matches(".m-turn + .m-them:not(.mx-other), .m-them + .m-turn"));
    // an answer under the agent's work pills, or your words under your pictures, isn't the first thing in its message
    const first = el.classList.contains("m-turn") ? b === el.querySelector(".turn > :first-child") : !(you && el.querySelector(":scope > .mx-stack"));
    const tail = !runStarted && first && !el.classList.contains("mx-emoji") && !el.classList.contains("is-relay");
    b.classList.toggle("mx-tail", tail);
    b.classList.toggle("is-them", tail && !you);
    // the same sender goes on in the next bubble: this one's lower corner tightens (was a :has(+ …) rule)
    const next = el.nextElementSibling;
    el.classList.toggle("mx-next-cont", !!next && next.classList.contains("cont") && next.classList.contains(you ? "m-you" : "m-them"));
  }
  // Names: whoever you're mainly talking to here goes unnamed, as in a one-to-one chat; anyone else who
  // speaks up is named. In a thread, the coordinator stepping in is set apart, quietly, in its violet.
  const view = document.getElementById("app").dataset.view;
  const theirs = kids.filter((el) => el.classList.contains("m-them") && !el.classList.contains("m-turn") && !el.classList.contains("m-card"));
  const count = new Map();
  for (const el of theirs) { const n = nameIn(el); el._mxWho = n; count.set(n, (count.get(n) || 0) + 1); }
  let main = view === "thread" ? ([...msgs.querySelectorAll(".m-them > .av-t + .mb > .mh b")].pop()?.textContent.trim() || null) : null;
  if (!main) main = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  for (const el of theirs) {
    const other = !!main && el._mxWho !== main;
    el.classList.toggle("mx-other", other);
    el.classList.toggle("mx-coord", other && view === "thread" && /coordinator/i.test(el._mxWho));
    // a named sender's name opens their first bubble, in their colour, on the bubble's text edge (as a
    // WhatsApp group does), so name, words and tail are one shape beside their mark
    const b = el.querySelector(":scope > .mb > .prose");
    const nm = b && b.querySelector(":scope > .mx-name");
    const want = other && !el.classList.contains("cont") && b;
    if (want && !nm) b.insertAdjacentHTML("afterbegin", `<span class="mx-name"></span>`);
    if (want) b.querySelector(":scope > .mx-name").textContent = el._mxWho;
    else if (nm) nm.remove();
  }
  for (const el of kids) {
    if (!el.classList.contains("m-turn")) continue;
    const mb = el.querySelector(":scope > .mb");
    if (mb) delete mb.dataset.mxWho; // a turn is always the main agent's own
    working(el);
  }
  projectMarks();
  cardSteps();
}

/** A thread card's step handoff: when a step completes since the card was last drawn, green fills it from
 *  the left, then the next lights up. Keyed by the thread, so the card's redraws don't replay it. */
const STEPS = new Map();
function cardSteps() {
  for (const c of msgs.querySelectorAll(".tcard")) {
    const key = c.querySelector("[data-go]")?.dataset.go;
    const segs = [...c.querySelectorAll(".tc-segs .sg")];
    wave(c);
    if (!key) continue;
    const done = segs.filter((g) => g.classList.contains("s-done")).length;
    const was = STEPS.get(key);
    if (was != null && done > was && segs[done - 1]) {
      segs[done - 1].classList.add("mx-seg-done");
      segs.find((g) => g.classList.contains("s-doing"))?.classList.add("mx-seg-next");
      setTimeout(() => { for (const g of c.querySelectorAll(".mx-seg-done,.mx-seg-next")) g.classList.remove("mx-seg-done", "mx-seg-next"); }, 1400);
    }
    STEPS.set(key, done);
  }
}

/** A project's coordinator wears the project's own icon (the one in the sidebar); XO's mark stays with the
 *  Workspace coordinator. In a thread, its violet ring still says "coordinator". */
function projectMarks() {
  const row = document.querySelector('#projects .prow.is-on[data-go^="p:"]');
  const view = document.getElementById("app").dataset.view;
  const ic = (view === "project" || view === "thread") && row && row.querySelector(".pr-ic svg");
  if (!ic) return;
  for (const av of document.querySelectorAll("#msgs .m-them > .av:not(.av-gap):not(.mx-pm), #typing .typing > .av:not(.mx-pm)")) {
    if (!av.querySelector(".xo-mark")) continue;
    av.classList.add("mx-pm");
    av.replaceChildren(ic.cloneNode(true), ...[...av.querySelectorAll(".arc")]);
  }
}
const typingFade = () => { const t = document.querySelector("#typing .ty-t"); if (t) t.classList.toggle("mx-fade", t.scrollWidth > t.clientWidth + 1); };
new MutationObserver(() => { projectMarks(); wave(document.getElementById("typing")); typingFade(); }).observe(document.getElementById("typing"), { childList: true, subtree: true, characterData: true });
new ResizeObserver(typingFade).observe(document.getElementById("typing"));

// ── the agent at work: one calm bubble ──────────────────────────────────────
const WORKING = new Map(); // turn key → { text, since, w }
const FINISHED_CARDS = new Map(); // only completed turns whose work card has been opened
// A turn that ended this session stays drawn where it was, after what arrived while it worked. Pure CSS,
// keyed by the app's own data-k, so it holds for every later redraw from the very first frame:
//   [the turn] {order: 2n−1}   and everything after the last thing that arrived meanwhile ~ {order: 2n}
// (the working turn is order 1000; everything else keeps its place, order 0).
const ENDED = new Set();
// each working turn's height, held by its key (see working(): the finished turn starts drawn at it)
const HOLD = new Map();
const holdSheet = document.head.appendChild(Object.assign(document.createElement("style"), { id: "mx-hold" }));
/** An element's height from its content alone (its children's extent), whatever min-height holds it at. */
function naturalHeight(el) {
  const top = el.getBoundingClientRect().top;
  let h = 0;
  for (const c of el.children) { const r = c.getBoundingClientRect(); if (r.height) h = Math.max(h, r.bottom - top); }
  return Math.round(h);
}
function holdRules() { holdSheet.textContent = [...HOLD].map(([k, h]) => `:root[data-msgx] #msgs>[data-k="${CSS.escape(k)}"]{min-height:${h}px}`).join("\n"); }
const orderSheet = document.head.appendChild(Object.assign(document.createElement("style"), { id: "mx-order" }));
function keepEnded(key, lastKey) {
  if (ENDED.has(key)) return;
  ENDED.add(key);
  const n = ENDED.size;
  orderSheet.append(`:root[data-msgx] #msgs>[data-k="${CSS.escape(key)}"]{order:${2 * n - 1}}\n:root[data-msgx] #msgs>[data-k="${CSS.escape(lastKey)}"]~*{order:${2 * n}}\n`);
}
/** What the agent is doing right now, in its own words where it has them. */
function nowText(turn) {
  const all = [...turn.querySelectorAll(".tb-rows.is-cur > li, .tb-think.is-live .tb-ht, .tb-narr, .tb-act.is-live > .tb-h .tb-ht")];
  const last = all.pop();
  if (!last) return "Working";
  const label = last.querySelector(".tb-rl") || last;
  let t = (last.matches(".tb-narr") ? (last.innerText.trim().split(/\n+/).pop() || "") : (label.textContent || "").split(/\n/)[0]).trim();
  t = t.replace(/\s*·\s*[\d.]+\s*(?:ms|s|m|min)(?:\s*\d+\s*s)?$/i, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
  return t || "Working";
}
function working(el) {
  const live = el.classList.contains("is-live") || !!el.querySelector(".turn.is-live");
  el.classList.toggle("mx-live", live);
  const key = el.dataset.k;
  const mb = el.querySelector(":scope > .mb");
  // what you asked to see, or a step that waits on you, shows in full
  el.classList.toggle("mx-expanded", !!el.querySelector('.turn [aria-expanded="true"], .turn .is-waiting'));
  // its mark centres on a 44 px row when that comes first: an open work card, an answer, a block pressed open
  el.classList.toggle("mx-av-row", !!el.querySelector(':scope > .mb > .turn > :is(.tb-work.is-open, .tb-answer, .tb-text, .tb.is-unfolded):first-child'));
  if (!live || !mb) {
    // it just ended: it stays drawn where it was, after what arrived while it worked, so nothing jumps
    if (WORKING.has(key)) {
      const last = [...msgs.children].filter((c) => c !== el && c.dataset.k).pop();
      if (last && last.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_PRECEDING) keepEnded(key, last.dataset.k);
      // and its height eases from the bubble's down to the finished line's (44 → 28) instead of snapping. A
      // keyed rule (holdSheet) has held the turn at its working height since it began, so the finished
      // element is drawn at that height from its very first frame, before this runs: no layout ever sees the
      // drop (at the bottom, the page clamped the view 16 px in one frame). Now the hold lets go gently.
      const from = WORKING.get(key).h;
      const letGo = () => { HOLD.delete(key); holdRules(); };
      // its own height, read while the hold still stands (so this layout never sees the drop either)
      const to = naturalHeight(el);
      if (from && to < from - 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const cs = getComputedStyle(el), d = cs.getPropertyValue("--d-move").trim();
        // it waits one beat first: the turn's answer usually lands with its end, and the app's follow is
        // carrying the view down to it; a shrink during that glide is absorbed, where one at the very bottom
        // would pull the view up a few px a frame
        const ms = parseFloat(d) * (d.endsWith("ms") ? 1 : 1000) || 320;
        const a = el.animate([{ minHeight: `${from}px` }, { minHeight: `${to}px` }], { duration: ms, delay: ms, fill: "backwards", easing: cs.getPropertyValue("--ease").trim() || "ease" });
        a.finished.then(letGo, letGo);
      } else letGo();
    }
    const previous = FINISHED_CARDS.get(key) || WORKING.get(key);
    if (previous?.timer) clearTimeout(previous.timer);
    if (mb && (previous || el.classList.contains("mx-expanded"))) {
      const state = previous || {};
      settle(el, state);
      if (state.open) FINISHED_CARDS.set(key, state); else FINISHED_CARDS.delete(key);
    }
    WORKING.delete(key); return;
  }
  let w = mb.querySelector(":scope > .mx-work");
  const was = WORKING.get(key);
  // the line changes at most every 2.5 s: steps can flicker by faster than anyone can read them
  // (Cloudscape's "thinking" guidance: never let the label flicker)
  let text = nowText(el);
  const now = Date.now();
  if (was && text !== was.text && now - (was.swapped || 0) < 2500) {
    clearTimeout(was.timer);
    was.timer = setTimeout(decorate, 2500 - (now - was.swapped) + 20);
    text = was.text;
  }
  const since = +(el.querySelector(".elapsed[data-since]")?.dataset.since || 0) || was?.since || Date.now();
  if (!w) {
    w = document.createElement("button");
    w.type = "button"; w.className = "mx-work"; w.setAttribute("aria-live", "polite");
    w.title = "See every step";
    w.innerHTML = `<span class="mx-wt"></span><span class="mx-we"></span>`;
    w.addEventListener("click", () => el.querySelector(".turn .tb-h")?.click());
    mb.prepend(w);
  }
  const wt = w.querySelector(".mx-wt");
  const cur = wt.querySelector(".mx-wl:not(.is-out)");
  // what fits on the line, ending at a word with a visible "…" (the full step is the bubble's tooltip)
  const shown = fitLine(w, text);
  w.title = shown === text ? "See every step" : `${text}\nSee every step`;
  if (!cur || cur.textContent !== shown) {
    // the old line leaves upward as the new one rises in; the bubble eases to the new line's width
    const old = cur || (was && was.text !== text ? Object.assign(document.createElement("span"), { className: "mx-wl", textContent: was.shown || was.text }) : null);
    if (old) { if (!old.parentNode) wt.append(old); old.className = "mx-wl is-out"; setTimeout(() => old.remove(), 220); }
    const line = Object.assign(document.createElement("span"), { className: old || !was ? "mx-wl is-in" : "mx-wl", textContent: shown });
    wt.append(line);
  }
  // it starts the agent's run (so it has the tail) unless the agent was just speaking
  // (it's drawn last, so what comes before it on screen is the conversation's last message)
  const pv = [...msgs.children].filter((c) => c !== el && !c.classList.contains("mx-live")).pop();
  w.classList.add("is-them");
  w.classList.toggle("mx-tail", !(pv && pv.matches(".m-them:not(.mx-other)")));
  const st = Object.assign(was || {}, { text, shown, since, swapped: !was || was.text !== text ? now : was.swapped });
  WORKING.set(key, st);
  settle(el, st);
  sizeWork(w, key, shown);
  // what it measures while working, for the ease when it ends: its content's own height, never the held
  // min-height (reading offsetHeight held it at its tallest: open the work, close it, and the turn kept the
  // open card's height as empty space; owner, 5 Nov)
  const held = HOLD.get(key) || 0;
  st.h = naturalHeight(el);
  if (Math.abs(held - st.h) >= 1) {
    HOLD.set(key, st.h); holdRules();
    // it got shorter (the work folded back): ease down to it instead of snapping, the way it opened
    if (held > st.h + 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      const cs = getComputedStyle(el), d = cs.getPropertyValue("--d-move").trim();
      el.animate([{ minHeight: `${held}px` }, { minHeight: `${st.h}px` }], { duration: parseFloat(d) * (d.endsWith("ms") ? 1 : 1000) || 320, easing: cs.getPropertyValue("--ease").trim() || "ease" });
    }
  }
  tick();
}
/**
 * The app redraws a working turn whole at every step, which made everything in it start over each time:
 * the open card re-ran its entrance, every row flashed in again, the arc on the mark jumped back to the
 * top. Here only what is really new moves: the card opens once, a new step rises into place while the
 * others stay still, the card's height eases to fit, and the arcs keep turning from where they were.
 */
const TURN_MS = 1600; // the arc's turn (panel.css .arc, app.css .tb-live)
const WAVE_MS = 2400; // the shimmer's wave (app.css .shimmer)
/** Give each shimmer, as it's drawn, a phase taken from the clock, so every one (old or redrawn) shows the
 *  same point of the wave: a redraw never restarts it. Set once per element; changing it later would jump. */
function wave(root = document) {
  for (const e of root.querySelectorAll(".shimmer, .mx-wl, .tc-segs, .tc-segs .sg.s-doing")) if (!e.style.getPropertyValue("--mx-wave")) e.style.setProperty("--mx-wave", `${-(Date.now() % WAVE_MS)}ms`);
}
function settle(el, st) {
  wave(el);
  const phase = `${-(Date.now() % TURN_MS)}ms`;
  // once per element, like the shimmer: rewriting a running animation's delay would jump it
  for (const a of el.querySelectorAll(".arc")) if (!a.style.getPropertyValue("--mx-phase")) a.style.setProperty("--mx-phase", phase);
  for (const a of el.querySelectorAll(".tb-live")) if (!a.style.animationDelay) a.style.animationDelay = phase;
  const card = el.classList.contains("mx-expanded") ? el.querySelector('.turn > .tb-work.is-open, .turn > .tb:is(.tb-think,.tb-act,.tb-plan):has(> .tb-h[aria-expanded="true"])') : null;
  const key = card?.querySelector(":scope > .tb-h")?.dataset.tb;
  if (!card || st.cardKey !== key) {
    st.resize?.animation.cancel();
    if (st.card) st.card.style.overflow = "";
    st.open = false; st.rows = null; st.h = 0; st.resize = null; st.card = null; st.cardKey = key;
    if (!card) return;
  }
  if (!st.open) card.classList.add("mx-opening");
  const seen = st.rows || new Set();
  for (const r of card.querySelectorAll(".tb-rail > .tb, .tb-rows > li, .tb-steps > li, .tb-plan-l > li")) {
    const block = r.closest(".tb");
    const blockKey = block?.querySelector(":scope > .tb-h")?.dataset.tb || key;
    const listKey = r.parentElement.matches(".tb-steps") ? "thinking" : r.parentElement.matches(".tb-plan-l") ? "plan" : "rows";
    // Thinking/plan lists append in order. Tool calls have an identity independent of their text.
    const k = r.matches(".tb") ? `block:${blockKey}` : r.dataset.callId != null ? `call:${r.dataset.callId}` : `${blockKey}:${listKey}:${[...r.parentElement.children].indexOf(r)}`;
    if (st.open && !seen.has(k)) r.classList.add("mx-row-in");
    seen.add(k);
  }
  st.rows = seen;
  // A timer may decorate the same DOM again during its height animation; leave that animation alone.
  if (st.card === card) return;
  const h = card.offsetHeight;
  const previous = st.resize;
  const progress = previous?.animation.effect.getComputedTiming().progress ?? 1;
  const from = previous ? previous.from + (previous.to - previous.from) * progress : st.h;
  const style = getComputedStyle(card);
  const durationToken = style.getPropertyValue("--d-move").trim();
  const fullDuration = parseFloat(durationToken) * (durationToken.endsWith("ms") ? 1 : 1000);
  // A replacement with the same target keeps the original finishing time, rather than restarting.
  const duration = previous && previous.to === h ? Math.max(0, previous.duration - (previous.animation.currentTime || 0)) : fullDuration;
  previous?.animation.cancel();
  if (st.card) st.card.style.overflow = "";
  st.resize = null;
  if (st.open && from && Math.abs(h - from) > 1 && duration > 0 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    card.style.overflow = "hidden";
    const animation = card.animate([{ height: `${from}px` }, { height: `${h}px` }], { duration, easing: style.getPropertyValue("--ease").trim(), fill: "both" });
    const resize = st.resize = { animation, from, to: h, duration };
    animation.finished.then(() => {
      if (st.resize !== resize) return;
      card.style.overflow = ""; st.resize = null; animation.cancel();
    }, () => {});
  }
  st.open = true; st.card = card; st.h = h;
}
/** Ease the working bubble's width to fit its line (it never jumps): measure, then transition to it. */
// The working bubble is as wide as a message bubble at most (560 px, 88 % of the column); its line gets what's
// left after the padding (16 + 16), the gap (12) and room for the time (64).
const WORK_MAX = 560, WORK_CHROME = 16 + 12 + 64 + 16 + 2;
const lineFont = (w) => { const c = getComputedStyle(w); return `${c.fontWeight} ${c.fontSize} ${c.fontFamily}`; };
const measureCtx = document.createElement("canvas").getContext("2d");
/** The step as it fits on one line: whole, or cut at a word with "…" (a real character, so the shimmer
 *  paints it too; CSS's ellipsis takes the text colour, which the shimmer makes transparent, so a cut line
 *  used to just stop mid-word). */
function fitLine(w, text) {
  const room = Math.min(WORK_MAX, (w.parentElement?.clientWidth || WORK_MAX) * 0.88) - WORK_CHROME;
  measureCtx.font = lineFont(w);
  if (measureCtx.measureText(text).width <= room) return text;
  const words = text.split(" ");
  while (words.length > 1) {
    words.pop();
    const t = words.join(" ").replace(/[\s,;:·–—-]+$/, "") + "…";
    if (measureCtx.measureText(t).width <= room) return t;
  }
  // one long word: cut by characters
  let t = text;
  while (t.length > 1 && measureCtx.measureText(t + "…").width > room) t = t.slice(0, -1);
  return t + "…";
}
function sizeWork(w, key, text) {
  const probe = document.createElement("span");
  probe.className = "mx-wsize"; probe.textContent = text;
  w.append(probe);
  // padding 16 + the line + gap 12 + the time (at least 64, so a growing clock never squeezes the line) + padding 16
  const natural = 16 + probe.offsetWidth + 12 + Math.max(64, w.querySelector(".mx-we").offsetWidth) + 16 + 2;
  probe.remove();
  const max = w.parentElement.clientWidth * 0.88;
  const target = Math.min(natural, WORK_MAX, max);
  const st = WORKING.get(key);
  if (st && st.w && Math.abs(st.w - target) > 1) {
    w.style.transition = "none"; w.style.width = `${st.w}px`; void w.offsetWidth;
    w.style.transition = ""; w.style.width = `${target}px`;
  } else w.style.width = `${target}px`;
  if (st) st.w = target;
}
function tick() {
  for (const w of document.querySelectorAll(".mx-work")) {
    const st = WORKING.get(w.closest(".m")?.dataset.k);
    if (!st) continue;
    const s = Math.max(0, Math.floor((Date.now() - st.since) / 1000));
    const t = s >= 3 ? elapsed(s) : "";
    const e = w.querySelector(".mx-we");
    if (e.textContent !== t) e.textContent = t;
  }
}
setInterval(tick, 1000);

new MutationObserver(decorate).observe(msgs, { childList: true });

// ── replying ────────────────────────────────────────────────────────────────
const composer = $("#composer"), sayEl = $("#say");
// A reply belongs to the conversation it was started in, like a draft (QA #4: one page-wide quote used to
// follow you into every other conversation and go out with the next message there). Each conversation keeps
// its own; switching shows that conversation's (or none).
let reply = null; // { who, text, conv }
const replies = new Map(); // conversation id → its reply on the way
const chip = document.createElement("div");
chip.className = "mx-reply"; chip.hidden = true;
chip.innerHTML = `<span class="mx-r-ic">${IC.reply}</span><span class="mx-r-t"><b></b><span></span></span><button type="button" class="mx-r-x" aria-label="Don't reply to this" title="Don't reply (Esc)">${IC.close}</button>`;
composer.insertBefore(chip, $(".composer-field", composer));
const clip = (s, n = 220) => { s = s.replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };

const convNow = () => document.getElementById("app").dataset.conv || "";
function showReply(r, animate) {
  reply = r;
  chip.hidden = !r;
  if (!r) return;
  chip.querySelector("b").textContent = r.who === "You" ? "Yourself" : r.who;
  chip.querySelector(".mx-r-t>span").textContent = r.text;
  chip.classList.remove("is-in");
  if (animate) { void chip.offsetWidth; chip.classList.add("is-in"); }
}
function startReply(m, text) {
  const who = nameIn(m);
  const r = { who, text: clip(text || textOf(m) || (m.querySelector(".mx-stack, .tb-files") ? "A picture" : "")), conv: convNow() };
  replies.set(r.conv, r);
  showReply(r, true);
  m.classList.remove("mx-flash"); void m.offsetWidth; m.classList.add("mx-flash");
  sayEl.focus();
}
function endReply() { if (reply) replies.delete(reply.conv); showReply(null); }
// another conversation: its own reply, or none
new MutationObserver(() => showReply(replies.get(convNow()) || null, false)).observe(document.getElementById("app"), { attributes: true, attributeFilter: ["data-conv"] });
chip.querySelector(".mx-r-x").addEventListener("click", () => { endReply(); sayEl.focus(); });

// When you send, the quote goes first, as Markdown the agent reads like any quote. If the app doesn't send
// (an empty message, a block), the quote comes back off.
function withQuote() {
  if (!reply || reply.conv !== convNow() || !sayEl.value.trim()) return;
  const before = sayEl.value;
  const prefix = `> **${reply.who}**\n> ${reply.text}\n\n`;
  sayEl.value = prefix + before;
  setTimeout(() => { if (sayEl.value === prefix + before) sayEl.value = before; else endReply(); }, 0);
}
document.addEventListener("keydown", (e) => {
  if (e.target !== sayEl || !reply) return;
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing && $("#at-list").hidden) withQuote();
  if (e.key === "Escape" && $("#at-list").hidden) { e.preventDefault(); e.stopImmediatePropagation(); endReply(); }
}, true);
document.addEventListener("submit", (e) => { if (e.target === composer && $("#send").dataset.mode !== "stop") withQuote(); }, true);

msgs.addEventListener("click", async (e) => {
  const r = e.target.closest("[data-mx-reply]");
  if (r) { startReply(r.closest(".m")); return; }
  const c = e.target.closest("[data-mx-copy]");
  if (c) {
    try { await navigator.clipboard.writeText(textOf(c.closest(".m"))); c.innerHTML = IC.check; setTimeout(() => { c.innerHTML = IC.copy; }, 1200); } catch { /* no clipboard here */ }
    return;
  }
  const q = e.target.closest("[data-mx-jump]");
  if (q) {
    const want = q.dataset.mxJump.replace(/…$/, "").slice(0, 80);
    const hit = [...msgs.querySelectorAll(".m")].reverse().find((m) => m !== q.closest(".m") && textOf(m).replace(/\s+/g, " ").includes(want));
    if (hit) { hit.scrollIntoView({ block: "center", behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" }); hit.classList.remove("mx-flash"); void hit.offsetWidth; hit.classList.add("mx-flash"); }
  }
});

// Select words in a message: "Reply to this" quotes exactly them
const qpop = document.createElement("button");
qpop.type = "button"; qpop.className = "mx-qpop"; qpop.hidden = true;
qpop.innerHTML = `${IC.reply}<span>Reply to this</span>`;
document.body.append(qpop);
let picked = null;
function onSelect() {
  const s = getSelection();
  const text = s && !s.isCollapsed ? s.toString().trim() : "";
  const m = text && s.anchorNode && s.anchorNode.parentElement?.closest("#msgs .m");
  if (!m || !m.contains(s.focusNode) || text.length < 2) { qpop.hidden = true; picked = null; return; }
  const r = s.getRangeAt(0).getBoundingClientRect();
  picked = { m, text };
  qpop.hidden = false;
  const w = qpop.offsetWidth;
  qpop.style.left = `${Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2))}px`;
  qpop.style.top = `${Math.max(8, r.top - qpop.offsetHeight - 8)}px`;
}
document.addEventListener("mouseup", () => setTimeout(onSelect, 0));
document.addEventListener("keyup", (e) => { if (e.shiftKey) onSelect(); });
document.addEventListener("selectionchange", () => { if (!qpop.hidden && getSelection().isCollapsed) qpop.hidden = true; });
$("#scroller").addEventListener("scroll", () => { qpop.hidden = true; }, { passive: true });
qpop.addEventListener("mousedown", (e) => e.preventDefault());
qpop.addEventListener("click", () => { if (picked) startReply(picked.m, picked.text); qpop.hidden = true; getSelection().removeAllRanges(); });

// ── swipes: right on a message replies to it, left anywhere shows the times ─
const scroller = $("#scroller");
const REPLY_AT = 56, REPLY_MAX = 72, TIME_MAX = 64;
let g = null, idle = 0;
const band = (raw, max) => (raw <= max ? raw : max + (raw - max) * 0.15); // past the end it only gives a little
function gMove(dx) {
  if (g.kind === "reply") {
    g.raw = Math.max(0, g.raw + dx);
    const d = band(g.raw, REPLY_MAX);
    g.m.style.setProperty("--mx-drag", d.toFixed(1));
    g.m.classList.toggle("mx-armed", d >= REPLY_AT);
  } else {
    g.raw = Math.max(0, g.raw + dx);
    msgs.style.setProperty("--mx-pull", band(g.raw, TIME_MAX).toFixed(1));
  }
}
function gEnd() {
  if (!g) return;
  const { kind, m } = g;
  if (kind === "reply") {
    const armed = m.classList.contains("mx-armed");
    m.classList.remove("mx-dragging", "mx-armed"); m.style.removeProperty("--mx-drag");
    if (armed) startReply(m);
  } else {
    msgs.classList.remove("mx-pulling"); msgs.style.removeProperty("--mx-pull");
  }
  g = null;
}
function gStart(kind, m) {
  g = { kind, m, raw: 0 };
  if (kind === "reply") m.classList.add("mx-dragging"); else msgs.classList.add("mx-pulling");
}
// a trackpad's horizontal swipe arrives as wheel events; it ends when they stop
// Scrolling always wins. A sideways swipe only starts from a clearly sideways movement (at least 6 px, and
// twice the vertical) and never during a vertical scroll (or its momentum, 400 ms after it); any vertical
// movement ends it and scrolls. (It used to catch a slightly diagonal start and then hold the page still
// for the whole gesture: "stuck while scrolling".)
let lastV = 0;
scroller.addEventListener("wheel", (e) => {
  const ax = Math.abs(e.deltaX), ay = Math.abs(e.deltaY);
  if (ay > ax) { lastV = e.timeStamp; if (g) gEnd(); return; }
  if (!g && (ax < 6 || ax < ay * 2 || e.timeStamp - lastV < 400)) return;
  e.preventDefault();
  if (!g) {
    const m = e.target.closest?.("#msgs .m");
    if (e.deltaX < 0 && m) gStart("reply", m); else if (e.deltaX > 0) gStart("time", null); else return;
  }
  gMove(g.kind === "reply" ? -e.deltaX : e.deltaX);
  clearTimeout(idle); idle = setTimeout(gEnd, 140);
}, { passive: false });
// a finger: a message follows it sideways; up and down still scrolls
let touch = null;
msgs.addEventListener("pointerdown", (e) => {
  if (e.pointerType !== "touch") return;
  touch = { x: e.clientX, y: e.clientY, m: e.target.closest(".m"), on: false };
});
msgs.addEventListener("pointermove", (e) => {
  if (!touch || e.pointerType !== "touch") return;
  const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
  if (!touch.on) {
    if (Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx)) { touch = null; return; }
    if (Math.abs(dx) < 10) return;
    touch.on = true;
    if (dx > 0 && touch.m) gStart("reply", touch.m); else gStart("time", null);
    touch.last = touch.x;
  }
  gMove(g.kind === "reply" ? e.clientX - touch.last : touch.last - e.clientX);
  touch.last = e.clientX;
});
for (const t of ["pointerup", "pointercancel"]) msgs.addEventListener(t, () => { if (touch && touch.on) gEnd(); touch = null; });

decorate();

// ── back to the latest (as WhatsApp does) ───────────────────────────────────
// Read further up than half a screen and a round button waits above the composer, on its right edge; a
// message that arrives meanwhile is counted on it. Press it to glide back down. Coming back to a
// conversation already returns you where you were (app.js keeps each place's scroll); this tells you
// what's new below.
const down = document.createElement("button");
down.type = "button"; down.className = "mx-down"; down.title = "Back to the latest";
down.innerHTML = `${IC.down}<span class="mx-down-n" hidden></span>`;
conv.append(down);
let unseen = 0;
const away = () => scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight;
/** The top of what's docked above the conversation: a decision card docked over the composer when there is
 *  one (its real top, whatever its height on this screen), else the composer itself. */
const tdock = $("#tdock");
function dockTop() {
  let top = composer.getBoundingClientRect().top;
  for (const el of tdock.querySelectorAll(":scope > *, :scope > * > *")) {
    const r = el.getBoundingClientRect();
    if (r.height > 0 && r.width > 0 && getComputedStyle(el).visibility !== "hidden") top = Math.min(top, r.top);
  }
  return top;
}
function downSync() {
  // 12 px above whatever is docked: the decision card when one is docked, else the composer itself
  const top = dockTop(), v = conv.getBoundingClientRect();
  if (Number.isFinite(top) && composer.getBoundingClientRect().height) down.style.bottom = `${Math.round(v.bottom - top + 12)}px`;
  // on a short phone a docked card can take nearly all the room: if the button would reach the header (less
  // than 8 px below the conversation's top), it stays away rather than sit on the title or the tabs
  const room = top - 12 - 40 >= scroller.getBoundingClientRect().top + 8;
  const far = room && away() > Math.max(240, scroller.clientHeight * 0.5);
  if (!far) unseen = 0;
  down.classList.toggle("is-on", far);
  // written only when they change: this runs on every scroll event, and rewriting the count's text each time
  // forced a full style pass (6–7 ms on a long chat; QA #6)
  const n = down.querySelector(".mx-down-n"), txt = unseen > 99 ? "99+" : String(unseen), label = unseen ? `${unseen} new below · back to the latest` : "Back to the latest";
  if (n.hidden !== !unseen) n.hidden = !unseen;
  if (n.textContent !== txt) n.textContent = txt;
  if (down.getAttribute("aria-label") !== label) down.setAttribute("aria-label", label);
}
scroller.addEventListener("scroll", downSync, { passive: true });
down.addEventListener("click", () => {
  scroller.scrollTo({ top: scroller.scrollHeight, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
});
new MutationObserver((ms) => {
  // a whole conversation swapped in is a new place, not news
  if (ms.reduce((n, m) => n + m.removedNodes.length, 0) > 6) unseen = 0;
  // only what lands at the end is news; older messages loading in above you are not
  else if (away() > 80) for (const m of ms) for (const n of m.addedNodes) {
    if (n.nodeType !== 1 || !n.classList.contains("is-new") || !n.matches(".m-them, .m-you")) continue;
    let after = n.nextElementSibling;
    while (after && (after.classList.contains("mx-live") || !after.classList.contains("m"))) after = after.nextElementSibling;
    if (!after) unseen++;
  }
  requestAnimationFrame(downSync);
}).observe(msgs, { childList: true });
const downRO = new ResizeObserver(() => downSync());
downRO.observe(scroller); downRO.observe($("#dock")); downRO.observe(tdock);
// a card docking or leaving (and its own glide in or out) moves the button with it, frame by frame
let downRaf = 0;
const followDock = (until) => { cancelAnimationFrame(downRaf); const step = () => { downSync(); if (performance.now() < until) downRaf = requestAnimationFrame(step); }; step(); };
new MutationObserver(() => {
  // what's docked, as classes the CSS keys off (were .app:has(#tdock > …) rules)
  const a = document.getElementById("app"), first = tdock.firstElementChild;
  a.classList.toggle("has-tdock", !!first);
  a.classList.toggle("has-tdock-card", !!tdock.querySelector(":scope > .card"));
  followDock(performance.now() + 700);
}).observe(tdock, { childList: true, subtree: true });

// ── at the latest, the conversation follows itself (owner, 5 Nov) ──────────────────────────────────────
// Opening a conversation lands at the latest, and while you're at the latest it stays there through every
// change in height: history arriving as it opens, pictures loading, the agent's turn growing as it streams
// (the app follows only new rows, and not a row that grows: after a moment of quiet, a working turn that
// grew by a line left you 30 px above the latest). Following stops the moment you scroll up yourself, or
// open something to read (a step, the work card), or go to a particular message; it starts again when you
// come back to the latest. Your own scrolling always wins.
const app = $("#app");
const column = $("#column");
const gapNow = () => scroller.scrollHeight - scroller.clientHeight - scroller.scrollTop;
let following = true, userAt = 0, holdOff = 0;
function toLatest() { following = true; scroller.scrollTop = scroller.scrollHeight; }
function keepFollowing() {
  if (performance.now() < holdOff) return;
  if (following) { if (gapNow() > 0.5) scroller.scrollTop = scroller.scrollHeight; }
  else if (gapNow() <= 8) following = true; // back at the latest without scrolling (something above closed)
}
// a conversation opens: app.js names it in data-conv (its id). Never inferred from the header's text: that
// carries live status and counts, and a status change while you read used to throw you to the latest (QA #3)
const opened = () => {
  if (app.dataset.view === "home" || app.dataset.view === "artifacts" || $("#conv").hidden) return;
  toLatest();
};
new MutationObserver(opened).observe(app, { attributes: true, attributeFilter: ["data-conv"] });
// it changes height (and the view changes size): stay with it, before the frame is painted
const followRO = new ResizeObserver(keepFollowing);
followRO.observe(column); followRO.observe(scroller);
new MutationObserver(keepFollowing).observe(msgs, { childList: true, subtree: true });
// you scroll yourself: you follow only if you end up at the latest
const moved = () => { userAt = performance.now(); };
for (const ev of ["wheel", "touchmove"]) scroller.addEventListener(ev, moved, { passive: true });
scroller.addEventListener("pointerdown", (e) => { if (e.target === scroller) moved(); });
document.addEventListener("keydown", (e) => { if (["PageUp", "PageDown", "ArrowUp", "ArrowDown", "Home", "End", " "].includes(e.key) && !e.target.closest?.("textarea, input, [contenteditable]")) moved(); });
scroller.addEventListener("scroll", () => { if (performance.now() - userAt < 500) following = gapNow() <= 8; }, { passive: true });
// you open something to read, or go to one particular message: that's the place now, not the latest.
// (The app's click handler runs on the same click, after this capture listener.)
document.addEventListener("click", (e) => {
  const t = e.target;
  if (t.closest?.("[data-go-msg], [data-mx-jump]")) { following = false; holdOff = performance.now() + 900; return; }
  if (t.closest?.("#msgs") && t.closest?.("[aria-expanded], .mx-work, [data-tb]")) { following = false; holdOff = performance.now() + 700; }
}, true);
// the back-to-latest button: follow again
down.addEventListener("click", () => { following = true; });
