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

const $ = (s, r = document) => r.querySelector(s);
const root = document.documentElement;
const I = (d) => `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
const IC = {
  reply: I('<path d="M9 14 4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11"/>'),
  copy: I('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/>'),
  check: I('<path d="m5 12.5 4.5 4.5L19 7.5"/>'),
  close: I('<path d="M6 6l12 12M18 6 6 18"/>'),
  tail: I('<path d="M5 5h11a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4H9c-1.5 1.6-3.2 2.4-5 2.5 1-1.2 1-2.7 1-4.5z"/>'),
};

const TONES = [
  { id: "graphite", name: "Graphite", hint: "Yours in soft graphite, theirs in stone: contrast from tone, not white" },
  { id: "moss", name: "Moss", hint: "Yours quietly tinted with XO's green, like deep moss" },
  { id: "glass", name: "Glass", hint: "Yours in frosted glass with a fine edge, theirs in stone" },
  { id: "outline", name: "Outline", hint: "Yours drawn as an outline, theirs filled" },
];
const KEY = "cv-msgx-tone", TAILS = "cv-msgx-tails";
const fromUrl = new URLSearchParams(location.search).get("tone");
let tone = TONES.some((t) => t.id === fromUrl) ? fromUrl : (localStorage.getItem(KEY) || "graphite");
if (!TONES.some((t) => t.id === tone)) tone = "graphite";
let tails = localStorage.getItem(TAILS) !== "0";

function apply() {
  root.dataset.msgx = "bubbles";
  root.dataset.msgxTone = tone;
  if (tails) root.dataset.msgxTails = ""; else delete root.dataset.msgxTails;
  try { localStorage.setItem(KEY, tone); localStorage.setItem(TAILS, tails ? "1" : "0"); } catch { /* private mode */ }
  for (const b of sw.querySelectorAll("[data-tone]")) b.setAttribute("aria-checked", String(b.dataset.tone === tone));
  sw.querySelector("[data-tails]").setAttribute("aria-pressed", String(tails));
  decorate();
}

// ── the switch: a glass bar over the conversation ──────────────────────────
const sw = document.createElement("div");
sw.className = "mx-switch";
sw.innerHTML = `<div class="mx-seg" role="radiogroup" aria-label="Your bubbles">${TONES.map((t) => `<button type="button" role="radio" data-tone="${t.id}" title="${t.hint}">${t.name}</button>`).join("")}</div>` +
  `<button type="button" class="mx-spot" data-tails aria-pressed="false" title="A small tail on the last bubble of a run">${IC.tail}<span>Tails</span></button>`;
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
  if (e.target.closest("[data-tails]")) { tails = !tails; apply(); say(tails ? "Tails on: the last bubble of a run has a small tail" : "Tails off"); }
});
const conv = $("#conv");
conv.append(sw, hint);
// it sits just under whatever heads the conversation (the title, and in a thread its steps)
const place = () => conv.style.setProperty("--mx-top", `${$("#scroller").offsetTop}px`);
const ro = new ResizeObserver(place);
ro.observe($("#top")); ro.observe($("#thead"));

// ── decorating what the app draws ───────────────────────────────────────────
const msgs = $("#msgs");
function nameIn(m) {
  if (m.classList.contains("m-you")) return "You";
  if (m.classList.contains("m-turn")) {
    const n = m.nextElementSibling?.querySelector(":scope .mh b") || [...msgs.querySelectorAll(".m-them .mh b")].pop();
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
const textOf = (m) => (m.querySelector(".bubble, .mb > .prose, .tb-answer")?.innerText || "").trim();

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
    el.append(acts);
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
  // the agent's work before its answer carries the agent's name, unless the agent was just speaking
  for (const el of kids) {
    if (!el.classList.contains("m-turn")) continue;
    const mb = el.querySelector(":scope > .mb");
    const prev = el.previousElementSibling;
    const cont = prev && (prev.classList.contains("m-them") || prev.classList.contains("m-turn"));
    if (mb && !cont) mb.dataset.mxWho = nameIn(el); else if (mb) delete mb.dataset.mxWho;
  }
}
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
  reply = { who, text: clip(text || textOf(m)) };
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
