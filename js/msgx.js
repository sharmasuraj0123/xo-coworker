// Message looks and replies, an exploration (thread "Message styles & replies", branch xo/thread-682d17).
// Not part of app.js: it only reads #msgs and decorates what the app draws, so it comes out by deleting
// this file, css/msgx.css and their two lines in index.html. Nothing here sends anything on its own: a
// reply only adds a quote ("> …") to the message you send yourself.
//
//   Looks (a switch over the conversation; also ?msgx=<look>): Now · Bubbles · Script · Pages · Duet · Letters
//   Spotlight: everything before your latest message recedes
//   Replies, in every look:
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
  spot: I('<circle cx="12" cy="12" r="3.5"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2"/>'),
};

const LOOKS = [
  { id: "now", name: "Now", hint: "Today's build, with the new ways to reply" },
  { id: "bubbles", name: "Bubbles", hint: "Both sides in bubbles, like Messages · swipe left for the times" },
  { id: "script", name: "Script", hint: "A transcript: who speaks in the margin, one reading edge for everyone" },
  { id: "pages", name: "Pages", hint: "What you ask becomes the heading; the reply is the page under it" },
  { id: "duet", name: "Duet", hint: "You on the left, replies on the right; your question stays while you read" },
  { id: "letters", name: "Letters", hint: "Each message a letter in the serif, signed at the end" },
];
const KEY = "cv-msgx", SPOT = "cv-msgx-spot";
const fromUrl = new URLSearchParams(location.search).get("msgx");
let look = LOOKS.some((l) => l.id === fromUrl) ? fromUrl : (localStorage.getItem(KEY) || "now");
if (!LOOKS.some((l) => l.id === look)) look = "now";
let spot = localStorage.getItem(SPOT) === "1";

function apply() {
  if (look === "now") delete root.dataset.msgx; else root.dataset.msgx = look;
  if (spot) root.dataset.msgxSpot = ""; else delete root.dataset.msgxSpot;
  try { localStorage.setItem(KEY, look); localStorage.setItem(SPOT, spot ? "1" : "0"); } catch { /* private mode */ }
  for (const b of sw.querySelectorAll("[data-look]")) b.setAttribute("aria-checked", String(b.dataset.look === look));
  sw.querySelector("[data-spot]").setAttribute("aria-pressed", String(spot));
  decorate();
}

// ── the switch: a glass bar over the conversation ──────────────────────────
const sw = document.createElement("div");
sw.className = "mx-switch";
sw.innerHTML = `<div class="mx-seg" role="radiogroup" aria-label="How messages look">${LOOKS.map((l) => `<button type="button" role="radio" data-look="${l.id}" title="${l.hint}">${l.name}</button>`).join("")}</div>` +
  `<button type="button" class="mx-spot" data-spot aria-pressed="false" title="Spotlight: everything before your latest message recedes">${IC.spot}<span>Spotlight</span></button>`;
const hint = document.createElement("p");
hint.className = "mx-hint"; hint.setAttribute("aria-live", "polite");
let hintT = 0;
function say(text) {
  hint.textContent = text; hint.classList.add("is-on");
  clearTimeout(hintT); hintT = setTimeout(() => hint.classList.remove("is-on"), 2600);
}
sw.addEventListener("click", (e) => {
  const b = e.target.closest("[data-look]");
  if (b) { look = b.dataset.look; apply(); say(LOOKS.find((l) => l.id === look).hint); return; }
  if (e.target.closest("[data-spot]")) { spot = !spot; apply(); say(spot ? "Spotlight on: the latest exchange stays lit, hover to read the rest" : "Spotlight off"); }
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
  let lastYou = -1;
  kids.forEach((el, i) => {
    if (!el.classList.contains("m") && !el.classList.contains("ev")) return;
    if (el.classList.contains("m-you")) lastYou = i;
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
  // who speaks (on the first of a run) and the signature (on the last), for the looks that name them
  const ms = kids.filter((el) => el.classList.contains("m"));
  ms.forEach((el, i) => {
    const next = ms[i + 1];
    const first = !el.classList.contains("cont") && !(el.classList.contains("m-turn") && ms[i - 1] && ms[i - 1].nextElementSibling === el && ms[i - 1].classList.contains("m-them"));
    const last = !(next && next === el.nextElementSibling && (next.classList.contains("cont") || next.classList.contains("m-turn")) && next.classList.contains("m-you") === el.classList.contains("m-you"));
    const who = nameIn(el);
    if (first) el.dataset.mxWho = who; else delete el.dataset.mxWho;
    if (last) el.dataset.mxSign = `— ${who}${el.dataset.mxTime ? `, ${el.dataset.mxTime}` : ""}`; else delete el.dataset.mxSign;
  });
  // Spotlight: your latest message and everything after it stay lit
  kids.forEach((el, i) => el.classList.toggle("mx-lit", lastYou < 0 || i >= lastYou));
  // Duet: your message spans the rows of the replies that follow it, so it can stay in view beside them
  if (look === "duet") {
    for (let i = 0; i < kids.length; i++) {
      if (!kids[i].classList.contains("m-you")) continue;
      let n = 0;
      for (let j = i + 1; j < kids.length && !kids[j].classList.contains("m-you") && !kids[j].classList.contains("day"); j++) n++;
      kids[i].style.setProperty("--mx-span", String(Math.max(1, n)));
    }
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
