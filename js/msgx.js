// Bubbles and replies, an exploration (thread "Message styles & replies", branch xo/thread-682d17).
// Not part of app.js: it only reads #msgs and decorates what the app draws, so it comes out by deleting
// this file, css/msgx.css and their lines in index.html. Nothing here sends anything on its own: a
// reply only adds a quote ("> …") to the message you send yourself.
//
//   Bubbles, with a switch over the conversation for the tone of yours (also ?tone=<id>):
//     Graphite · Moss · Glass · Outline, and Tails on the last bubble of a run
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
  open: I('<path d="M4 6h16M4 10h16M4 14h10M4 18h7"/>'),
  tail: I('<path d="M5 5h11a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H9c-1.5 1.6-3.2 2.4-5 2.5 1-1.2 1-2.7 1-4.5z"/>'),
};

const TONES = [
  { id: "xo", name: "XO", hint: "XO's green, deepened to hold its colour on the dark; the agent answers on glass" },
  { id: "bright", name: "XO Bright", hint: "The brand green itself with dark ink, like the Send button: the boldest" },
  { id: "graphite", name: "Graphite", hint: "No colour: a cool grey a step lighter than the agent's glass" },
];
const KEY = "cv-msgx-tone", TAILS = "cv-msgx-tails", OPEN = "cv-msgx-open";
const fromUrl = new URLSearchParams(location.search).get("tone");
let tone = TONES.some((t) => t.id === fromUrl) ? fromUrl : (localStorage.getItem(KEY) || "xo");
if (!TONES.some((t) => t.id === tone)) tone = "xo";
let tails = localStorage.getItem(TAILS) !== "0";
let open = localStorage.getItem(OPEN) !== "0";

function apply() {
  root.dataset.msgx = "bubbles";
  root.dataset.msgxTone = tone;
  if (tails) root.dataset.msgxTails = ""; else delete root.dataset.msgxTails;
  if (open) root.dataset.msgxOpen = ""; else delete root.dataset.msgxOpen;
  try { localStorage.setItem(KEY, tone); localStorage.setItem(TAILS, tails ? "1" : "0"); localStorage.setItem(OPEN, open ? "1" : "0"); } catch { /* private mode */ }
  for (const b of sw.querySelectorAll("[data-tone]")) b.setAttribute("aria-checked", String(b.dataset.tone === tone));
  sw.querySelector(".mx-fold b").textContent = TONES.find((t) => t.id === tone).name;
  sw.querySelector("[data-tails]").setAttribute("aria-pressed", String(tails));
  sw.querySelector("[data-open]").setAttribute("aria-pressed", String(open));
  decorate();
}

// ── the switch: a glass bar over the conversation ──────────────────────────
const sw = document.createElement("div");
sw.className = "mx-switch";
sw.innerHTML = `<button type="button" class="mx-fold" aria-expanded="false" title="How your bubbles look">${IC.tail}<span>Bubbles</span><b></b>${IC.down}</button>` +
  `<div class="mx-panel"><div class="mx-seg" role="radiogroup" aria-label="Your bubbles">${TONES.map((t) => `<button type="button" role="radio" data-tone="${t.id}" title="${t.hint}">${t.name}</button>`).join("")}</div>` +
  `<button type="button" class="mx-spot" data-tails aria-pressed="false" title="A tail on the first bubble of a run">${IC.tail}<span>Tails</span></button>` +
  `<button type="button" class="mx-spot mx-spot2" data-open aria-pressed="false" title="Long replies read on the canvas, not in a bubble">${IC.open}<span>Open</span></button></div>`;
const fold = (open) => { sw.classList.toggle("is-open", open); sw.querySelector(".mx-fold").setAttribute("aria-expanded", String(open)); };
sw.querySelector(".mx-fold").addEventListener("click", () => fold(!sw.classList.contains("is-open")));
document.addEventListener("pointerdown", (e) => { if (!sw.contains(e.target)) fold(false); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && sw.classList.contains("is-open")) fold(false); });
const hint = document.createElement("p");
hint.className = "mx-hint"; hint.setAttribute("aria-live", "polite");
let hintT = 0;
function say(text) {
  hint.textContent = text; hint.classList.add("is-on");
  clearTimeout(hintT); hintT = setTimeout(() => hint.classList.remove("is-on"), 2600);
}
sw.addEventListener("click", (e) => {
  const b = e.target.closest("[data-tone]");
  if (b) { tone = b.dataset.tone; apply(); say(TONES.find((t) => t.id === tone).hint); return; }
  if (e.target.closest("[data-tails]")) { tails = !tails; apply(); say(tails ? "Tails on: the last bubble of a run curls into a tail" : "Tails off"); }
  if (e.target.closest("[data-open]")) { open = !open; apply(); say(open ? "Open: long replies read on the canvas; short ones stay bubbles" : "Every reply in a bubble"); }
});
const conv = $("#conv");
conv.append(sw, hint);
// on a phone there's no margin beside the text, so the switch lives in the top bar, beside Settings
const phoneMQ = matchMedia("(max-width: 760px)");
const seat = () => { if (phoneMQ.matches) $("#phonebar").insertBefore(sw, $("#set-phone")); else if (sw.parentNode !== conv) conv.insertBefore(sw, hint); };
phoneMQ.addEventListener("change", seat); seat();
// it sits just under whatever heads the conversation (the title, and in a thread its steps)
const place = () => conv.style.setProperty("--mx-top", `${$("#scroller").offsetTop}px`);
const ro = new ResizeObserver(place);
ro.observe($("#top")); ro.observe($("#thead"));

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
  // Open: a long reply (more than a few lines, or a list, code or a table) reads without a bubble
  for (const el of kids) {
    if (!el.classList.contains("m-them")) continue;
    const b = bubbleOf(el);
    const long = !!b && (b.textContent.length > 280 || b.querySelectorAll(":scope > p").length > 2 || !!b.querySelector(":scope > :is(ul,ol,pre,table,h1,h2,h3,blockquote,.md-code)"));
    el.classList.toggle("mx-open", long);
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
    const tail = !runStarted && first && !el.classList.contains("mx-emoji") && !el.classList.contains("mx-open") && !el.classList.contains("is-relay");
    b.classList.toggle("mx-tail", tail);
    b.classList.toggle("is-them", tail && !you);
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
new MutationObserver(() => { projectMarks(); wave(document.getElementById("typing")); }).observe(document.getElementById("typing"), { childList: true, subtree: true });

// ── the agent at work: one calm bubble ──────────────────────────────────────
const WORKING = new Map(); // turn key → { text, since, w }
/** What the agent is doing right now, in its own words where it has them. */
function nowText(turn) {
  const all = [...turn.querySelectorAll(".tb-rows.is-cur > li, .tb-think.is-live .tb-ht, .tb-narr, .tb-act.is-live > .tb-h .tb-ht")];
  const last = all.pop();
  if (!last) return "Working";
  let t = (last.matches(".tb-narr") ? (last.innerText.trim().split(/\n+/).pop() || "") : (last.innerText || "").split(/\n/)[0]).trim();
  t = t.replace(/\s*·\s*[\d.]+\s*(?:ms|s|m|min)(?:\s*\d+\s*s)?$/i, "").replace(/`/g, "").replace(/\s+/g, " ").trim();
  return t || "Working";
}
function working(el) {
  const live = el.classList.contains("is-live") || !!el.querySelector(".turn.is-live");
  el.classList.toggle("mx-live", live);
  const key = el.dataset.k;
  const mb = el.querySelector(":scope > .mb");
  if (!live || !mb) { WORKING.delete(key); return; }
  // what you asked to see, or a step that waits on you, shows in full
  el.classList.toggle("mx-expanded", !!el.querySelector('.turn [aria-expanded="true"], .turn .is-waiting'));
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
  if (!cur || cur.textContent !== text) {
    // the old line leaves upward as the new one rises in; the bubble eases to the new line's width
    const old = cur || (was && was.text !== text ? Object.assign(document.createElement("span"), { className: "mx-wl", textContent: was.text }) : null);
    if (old) { if (!old.parentNode) wt.append(old); old.className = "mx-wl is-out"; setTimeout(() => old.remove(), 220); }
    const line = Object.assign(document.createElement("span"), { className: old || !was ? "mx-wl is-in" : "mx-wl", textContent: text });
    wt.append(line);
  }
  // it starts the agent's run (so it has the tail) unless the agent was just speaking
  // (it's drawn last, so what comes before it on screen is the conversation's last message)
  const pv = [...msgs.children].filter((c) => c !== el && !c.classList.contains("mx-live")).pop();
  w.classList.add("is-them");
  w.classList.toggle("mx-tail", !(pv && pv.matches(".m-them:not(.mx-other)")));
  const st = Object.assign(was || {}, { text, since, swapped: !was || was.text !== text ? now : was.swapped });
  WORKING.set(key, st);
  settle(el, st);
  sizeWork(w, key, text);
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
  for (const e of root.querySelectorAll(".shimmer, .mx-wl")) if (!e.style.getPropertyValue("--mx-wave")) e.style.setProperty("--mx-wave", `${-(Date.now() % WAVE_MS)}ms`);
}
function settle(el, st) {
  wave(el);
  const phase = `${-(Date.now() % TURN_MS)}ms`;
  for (const a of el.querySelectorAll(".arc")) a.style.setProperty("--mx-phase", phase);
  for (const a of el.querySelectorAll(".tb-live")) a.style.animationDelay = phase;
  const card = el.classList.contains("mx-expanded") && el.querySelector(".turn > .tb-work.is-open");
  if (!card) { st.open = false; st.rows = null; st.h = 0; return; }
  if (!st.open) card.classList.add("mx-opening");
  const seen = st.rows || new Set();
  for (const r of card.querySelectorAll(".tb-rail > .tb, .tb-rows > li")) {
    const k = r.querySelector("[data-tb]")?.dataset.tb || r.textContent.trim().slice(0, 80);
    if (st.open && !seen.has(k)) r.classList.add("mx-row-in");
    seen.add(k);
  }
  const h = card.offsetHeight;
  if (st.open && st.h && Math.abs(h - st.h) > 1 && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
    card.style.height = `${st.h}px`; card.style.overflow = "hidden"; void card.offsetHeight;
    card.style.transition = "height var(--d-move) var(--ease)"; card.style.height = `${h}px`;
    card.addEventListener("transitionend", () => { card.style.height = ""; card.style.overflow = ""; card.style.transition = ""; }, { once: true });
  }
  st.open = true; st.rows = seen; st.h = h;
}
/** Ease the working bubble's width to fit its line (it never jumps): measure, then transition to it. */
function sizeWork(w, key, text) {
  const probe = document.createElement("span");
  probe.className = "mx-wsize"; probe.textContent = text;
  w.append(probe);
  // padding 16 + the line + gap 12 + the time (at least 64, so a growing clock never squeezes the line) + padding 16
  const natural = 16 + probe.offsetWidth + 12 + Math.max(64, w.querySelector(".mx-we").offsetWidth) + 16 + 2;
  probe.remove();
  const max = w.parentElement.clientWidth * 0.88;
  const target = Math.min(natural, 480, max);
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
let reply = null; // { who, text }
const chip = document.createElement("div");
chip.className = "mx-reply"; chip.hidden = true;
chip.innerHTML = `<span class="mx-r-ic">${IC.reply}</span><span class="mx-r-t"><b></b><span></span></span><button type="button" class="mx-r-x" aria-label="Don't reply to this" title="Don't reply (Esc)">${IC.close}</button>`;
composer.insertBefore(chip, $(".composer-field", composer));
const clip = (s, n = 220) => { s = s.replace(/\s+/g, " ").trim(); return s.length > n ? s.slice(0, n - 1).replace(/\s+\S*$/, "") + "…" : s; };

function startReply(m, text) {
  const who = nameIn(m);
  reply = { who, text: clip(text || textOf(m) || (m.querySelector(".mx-stack, .tb-files") ? "A picture" : "")) };
  chip.querySelector("b").textContent = who === "You" ? "Yourself" : who;
  chip.querySelector(".mx-r-t>span").textContent = reply.text;
  chip.hidden = false; chip.classList.remove("is-in"); void chip.offsetWidth; chip.classList.add("is-in");
  m.classList.remove("mx-flash"); void m.offsetWidth; m.classList.add("mx-flash");
  sayEl.focus();
}
function endReply() { reply = null; chip.hidden = true; }
chip.querySelector(".mx-r-x").addEventListener("click", () => { endReply(); sayEl.focus(); });

// When you send, the quote goes first, as Markdown the agent reads like any quote. If the app doesn't send
// (an empty message, a block), the quote comes back off.
function withQuote() {
  if (!reply || !sayEl.value.trim()) return;
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
scroller.addEventListener("wheel", (e) => {
  if (Math.abs(e.deltaX) <= Math.abs(e.deltaY) * 1.2 && !g) return;
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

apply();
place();

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
function downSync() {
  // 12 px above the composer itself (the dock around it has its own padding)
  const c = composer.getBoundingClientRect(), v = conv.getBoundingClientRect();
  if (c.height) down.style.bottom = `${Math.round(v.bottom - c.top + 12)}px`;
  const far = away() > Math.max(240, scroller.clientHeight * 0.5);
  if (!far) unseen = 0;
  down.classList.toggle("is-on", far);
  const n = down.querySelector(".mx-down-n");
  n.hidden = !unseen; n.textContent = unseen > 99 ? "99+" : String(unseen);
  down.setAttribute("aria-label", unseen ? `${unseen} new below · back to the latest` : "Back to the latest");
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
downRO.observe(scroller); downRO.observe($("#dock"));
