// @ts-check
import { createScope } from "../../core/kernel/scope.js";
import { createScheduler } from "../../core/kernel/scheduler.js";
import { read, write } from "../../core/platform/storage.js";
import { wordsOf } from "./words.js";
import { IC } from "./decoration-icons.js";
import { mountLatestButton } from "./latest-button.js";
import { wireMessageSwipes } from "./message-swipes.js";
import { createWorkingTurn, wave } from "./working-turn.js";
import { wireMessageReply } from "./message-reply.js";

/** @param {import("./decoration-types.js").Conversation} E */
export function decorateConversation(E) {
  const scope = createScope();
  const scheduler = createScheduler({ request: (run) => scope.frame(run) });
  const decoratedBubbles = new WeakSet();
  const conv = E.conv;

  const msgs = E.msgs;

  /** @type {string | null} */
  let agentNameMemo = null;
  function agentName() {
    if (agentNameMemo == null) { const n = [...msgs.querySelectorAll(".m-them > .av-t + .mb > .mh b")].pop(); agentNameMemo = n ? (/** @type {string} */ (n.textContent)).trim() : "Agent"; }
    return agentNameMemo;
  }
  /** @param {HTMLElement} m */
  function nameIn(m) {
    if (m.classList.contains("m-you")) return "You";
    if (m.classList.contains("m-turn")) return agentName();
    for (let el = /** @type {Element | null} */ (m); el; el = el.previousElementSibling) {
      const b = el.querySelector(":scope .mh b");
      if (b) return (/** @type {string} */ (b.textContent)).trim();
      if (el.classList.contains("m-turn")) return "The agent";
      if (!el.classList.contains("cont")) break;
    }
    return "The agent";
  }
  /** @param {HTMLElement} m */
  function timeIn(m) {
    const t = m.querySelector(".bubble[title]")?.getAttribute("title") || m.querySelector(".mh time, :scope > time, .meta time")?.textContent;
    if (t) return t.trim();
    for (let el = m.previousElementSibling; el; el = el.previousElementSibling) if ((/** @type {HTMLElement} */ (el)).dataset.mxTime) return /** @type {string} */ ((/** @type {HTMLElement} */ (el)).dataset.mxTime);
    return "";
  }
  /** @param {HTMLElement} m */
  function bubbleOf(m) {
    if (m.classList.contains("m-you")) return m.querySelector(":scope > .bubble");
    if (m.classList.contains("m-turn")) return [...m.querySelectorAll(".turn > .tb-answer, .turn > .tb-text")].pop() || null;
    return m.querySelector(":scope > .mb > .prose");
  }
  /** @param {HTMLElement} m */
  const textOf = (m) => { const b = m.querySelector(".bubble, .mb > .prose, .tb-answer"); return b ? wordsOf((/** @type {HTMLElement} */ (b))) : ""; };

  /** @param {HTMLElement} m */
  function quoteCard(m) {
    const b = m.querySelector(".bubble");
    if (!b || decoratedBubbles.has(b)) return;
    decoratedBubbles.add(b);
    const tn = [...b.childNodes].find((n) => n.nodeType === 3);
    if (!tn || !/^> /.test(/** @type {string} */ (tn.nodeValue))) {
      const old = b.querySelector(":scope > .mx-qc");
      if (old) { if (old.contains(document.activeElement)) (/** @type {HTMLElement | null} */ (b.querySelector("[data-mx-reply]")))?.focus({ preventScroll: true }); old.remove(); }
      return;
    }
    const lines = (/** @type {string} */ (tn.nodeValue)).split("\n");
    let i = 0; const q = [];
    while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
    const rest = lines.slice(i).join("\n").replace(/^\n+/, "");
    const attribution = q[0].match(/^\*\*(.+?)\*\*(?: \[↩\]\(#xo-message-([^)]+)\))?$/);
    const who = attribution?.[1];
    let source;
    if (attribution?.[2]) {
      try { source = decodeURIComponent(attribution[2]); } catch (error) {
        if (!(error instanceof URIError)) throw error;
      }
    }
    const said = (who ? q.slice(1) : q).join(" ").replace(/\s+/g, " ").trim().replace(/^[“"]|[”"]$/g, "");
    let card = /** @type {HTMLButtonElement | null} */ (b.querySelector(":scope > .mx-qc"));
    if (!card) {
      card = document.createElement("button");
      card.type = "button"; card.className = "mx-qc"; card.title = "Go to the message"; card.dataset.own = "";
      card.innerHTML = `<b></b><span></span>`;
    }
    const legacy = who && said && !attribution?.[2] ? who : "";
    if (source) card.dataset.mxJump = source; else delete card.dataset.mxJump;
    if (legacy) card.dataset.mxQuoteAuthor = legacy; else delete card.dataset.mxQuoteAuthor;
    card.disabled = !source && !legacy;
    card.title = card.disabled ? "" : "Go to the message";
    (/** @type {HTMLElement} */ (card.querySelector("b"))).textContent = who || "Quote";
    (/** @type {HTMLElement} */ (card.querySelector("span"))).textContent = said;
    tn.nodeValue = rest;
    b.insertBefore(card, tn);
  }

  /** @param {HTMLElement} el */
  function decorateRow(el) {
    if (!el.classList.contains("m") && !el.classList.contains("ev")) return;
    const time = timeIn(el);
    if (time) el.dataset.mxTime = time; else delete el.dataset.mxTime;
    if (!el.classList.contains("m")) return;
    el.dataset.noswipe = ""; // a swipe on a message is a reply here; the page's back-swipe starts elsewhere
    const acts = document.createElement("div");
    acts.className = "mx-acts"; acts.dataset.own = "";
    acts.innerHTML = `<button type="button" data-mx-reply title="Reply" aria-label="Reply">${IC.reply}</button><button type="button" data-mx-copy title="Copy" aria-label="Copy">${IC.copy}</button>`;
    quoteCard(el);
    const bub = bubbleOf(el), mb = el.querySelector(":scope > .mb");
    if (bub && !bub.querySelector(":scope > .mx-acts")) bub.append(acts);
    for (const a of el.querySelectorAll(".mx-acts:not(.is-foot)")) {
      if (a.parentElement === bub) continue;
      const f = a.querySelector(":focus");
      if (f) (/** @type {HTMLElement | null} */ ((bub && bub.querySelector(`:scope > .mx-acts > [${f.hasAttribute("data-mx-copy") ? "data-mx-copy" : "data-mx-reply"}]`))))?.focus({ preventScroll: true });
      a.remove();
    }
    if (!bub && !el.querySelector(".mx-stack, .tb-files")) mb?.querySelector(":scope > .mx-acts.is-foot")?.remove();
    if (bub && !el.classList.contains("m-you")) {
      if (mb && !mb.querySelector(":scope > .mx-acts.is-foot")) { const foot = /** @type {HTMLDivElement} */ (acts.cloneNode(true)); foot.classList.add("is-foot"); mb.append(foot); }
    } else if (!bub && el.querySelector(".mx-stack, .tb-files")) {
      el.classList.add("mx-nobub");
      const at = mb || el;
      if (!at.querySelector(":scope > .mx-acts.is-foot")) { const foot = /** @type {HTMLDivElement} */ (acts.cloneNode(true)); foot.classList.add("is-foot"); foot.querySelector("[data-mx-copy]")?.remove(); at.append(foot); }
    }
    const host = (el.classList.contains("m-you") && el.querySelector(".bubble")) || el;
    if (!host.querySelector(":scope > .mx-swipe")) {
      const arrow = document.createElement("span");
      arrow.className = "mx-swipe"; arrow.innerHTML = IC.reply; arrow.setAttribute("aria-hidden", "true"); arrow.dataset.own = "";
      host.append(arrow);
    }

    const t = (/** @type {(HTMLElement & {textContent: string}) | null} */ ((el.querySelector(".bubble") || el.querySelector(".mb > .prose, .tb-answer"))))?.textContent.trim() || "";
    el.classList.toggle("mx-emoji", t.length > 0 && t.length <= 16 && /^(?:\p{Extended_Pictographic}|\p{Emoji_Component}|\u200d|\ufe0f|\s)+$/u.test(t) && !/^[\d#*\s]+$/.test(t));
    if (el.classList.contains("m-turn")) working(el);
    cardSteps(el);
  }

  function decorateList() {
    const kids = [.../** @type {HTMLCollectionOf<HTMLElement>} */ (msgs.children)];
    updateOrder();
    markAuthors(kids);
    updateTails();
    for (const el of kids) {
      if (!el.classList.contains("m")) continue;
      const b = bubbleOf(el);
      if (!b) continue;
      const you = el.classList.contains("m-you");
      const prev = el.previousElementSibling;
      const runStarted = you ? el.classList.contains("cont") : el.classList.contains("cont") || (prev && prev.matches(".m-them") && el.matches(".m-turn + .m-them:not(.mx-other), .m-them + .m-turn"));
      const first = el.classList.contains("m-turn") ? b === el.querySelector(".turn > :first-child") : !(you && el.querySelector(":scope > .mx-stack"));
      const tail = !runStarted && first && !el.classList.contains("mx-emoji") && !el.classList.contains("is-relay");
      b.classList.toggle("mx-tail", tail);
      b.classList.toggle("is-them", tail && !you);
      const next = el.nextElementSibling;
      el.classList.toggle("mx-next-cont", !!next && next.classList.contains("cont") && next.classList.contains(you ? "m-you" : "m-them"));
    }
    projectMarks();
    actionRows(kids);
  }

  /** @param {HTMLElement[]} kids */
  function markAuthors(kids) {
    const view = E.isThread() ? "thread" : (/** @type {HTMLElement} */ (document.getElementById("app"))).dataset.view;
    const theirs = kids.filter((el) => el.classList.contains("m-them") && !el.classList.contains("m-turn") && !el.classList.contains("m-card"));
    const count = new Map();
    const authors = theirs.map((row) => {
      const name = nameIn(row);
      count.set(name, (count.get(name) || 0) + 1);
      return { row, name };
    });
    let main = view === "thread" ? ((/** @type {(HTMLElement & {textContent: string}) | undefined} */ ([...msgs.querySelectorAll(".m-them > .av-t + .mb > .mh b")].pop()))?.textContent.trim() || null) : null;
    if (!main) main = [...count].sort((a, b) => b[1] - a[1])[0]?.[0] || null;
    for (const { row: el, name: author } of authors) {
      const other = !!main && author !== main;
      el.classList.toggle("mx-other", other);
      el.classList.toggle("mx-coord", other && view === "thread" && /coordinator/i.test(author));
      const b = el.querySelector(":scope > .mb > .prose");
      const nm = b && b.querySelector(":scope > .mx-name");
      const want = other && !el.classList.contains("cont") && b;
      if (want && !nm) b.insertAdjacentHTML("afterbegin", `<span class="mx-name" data-own></span>`);
      const label = nm || b?.querySelector(":scope > .mx-name");
      if (want && label && label.textContent !== author) label.textContent = author;
      else if (!want) nm?.remove();
    }
  }

  /** @type {Map<string | undefined, HTMLDivElement>} */
  const ROWS = new Map(); // row key → its action row element
  const RATE_KEY = "xo-msg-rating";
  /** @type {Map<string | undefined, unknown>} */
  const RATED = read(RATE_KEY, (raw) => new Map(Object.entries(JSON.parse(raw))), new Map());
  /** @param {HTMLElement} el */
  function rowFor(el) {
    const k = el.dataset.k;
    let row = ROWS.get(k);
    if (row) return row;
    row = document.createElement("div");
    row.className = "mx-actrow"; row.dataset.own = "";
    const r = RATED.get(k);
    row.innerHTML =
      `<button type="button" data-mx-copy title="Copy" aria-label="Copy">${IC.copy}</button>` +
      `<button type="button" data-mx-reply title="Reply" aria-label="Reply">${IC.reply}</button>` +
      `<button type="button" data-mx-rate="good" title="Good response" aria-label="Good response" aria-pressed="${r === "good"}">${IC.good}</button>` +
      `<button type="button" data-mx-rate="bad" title="Bad response" aria-label="Bad response" aria-pressed="${r === "bad"}">${IC.bad}</button>` +
      `<time></time>`;
    ROWS.set(k, row);
    if (ROWS.size > 800) for (const [key, x] of ROWS) { if (ROWS.size <= 600) break; if (!x.isConnected) ROWS.delete(key); }
    return row;
  }
  /** @param {HTMLElement[]} kids */
  function actionRows(kids) {
    let latest = null;
    for (const el of kids) {
      if (!el.classList.contains("m") || el.classList.contains("m-card") || !el.dataset.k) continue;
      const you = el.classList.contains("m-you");
      const host = you ? el : el.querySelector(":scope > .mb");
      const mine = ROWS.get(el.dataset.k);
      if (you || !host || !bubbleOf(el) || el.classList.contains("is-live") || el.classList.contains("mx-next-cont")) {
        if (mine && host && mine.parentElement === host && !mine.contains(document.activeElement)) mine.remove();
        continue;
      }
      const row = rowFor(el);
      if (row.parentElement !== host) host.append(row);
      const t = el.dataset.mxTime || "";
      const time = (/** @type {HTMLElement} */ (row.querySelector("time")));
      if (time.textContent !== t) time.textContent = t;
      latest = el;
    }
    for (const el of msgs.querySelectorAll(":scope > .mx-latest")) if (el !== latest) el.classList.remove("mx-latest");
    latest?.classList.add("mx-latest");
  }
  /** @param {HTMLElement} m */
  function runText(m) {
    const run = [m];
    for (let x = m; x.classList.contains("cont") && x.previousElementSibling && x.previousElementSibling.matches(".m-them:not(.m-card)"); ) { x = /** @type {HTMLElement} */ (x.previousElementSibling); run.unshift(x); }
    return run.map(textOf).filter(Boolean).join("\n\n");
  }

  /** @param {HTMLElement} btn */
  function rate(btn) {
    const m = (/** @type {HTMLElement | null} */ (btn.closest(".m"))), k = m && m.dataset.k;
    if (!k) return;
    const want = btn.dataset.mxRate, rating = RATED.get(k) === want ? null : want;
    if (rating) RATED.set(k, rating); else RATED.delete(k);
    write(RATE_KEY, JSON.stringify(Object.fromEntries(RATED)));
    for (const b of (/** @type {NodeListOf<HTMLElement>} */ ((/** @type {HTMLElement} */ (btn.closest(".mx-actrow"))).querySelectorAll("[data-mx-rate]")))) b.setAttribute("aria-pressed", String(b.dataset.mxRate === rating));
    const live = document.getElementById("live");
    if (live) { live.textContent = ""; scope.timeout(() => { live.textContent = rating ? `Marked as a ${rating} response.` : "Rating taken back."; }, 40); }
  }

  /** @type {Map<string, number>} */
  const STEPS = new Map();
  /** @param {HTMLElement} row */
  function cardSteps(row) {
    for (const c of row.querySelectorAll(".tcard")) {
      const key = (/** @type {HTMLElement | null} */ (c.querySelector("[data-go]")))?.dataset.go;
      const segs = [...c.querySelectorAll(".tc-segs .sg")];
      wave(c);
      if (!key) continue;
      const done = segs.filter((g) => g.classList.contains("s-done")).length;
      const was = STEPS.get(key);
      if (was != null && done > was && segs[done - 1]) {
        segs[done - 1].classList.add("mx-seg-done");
        segs.find((g) => g.classList.contains("s-doing"))?.classList.add("mx-seg-next");
        scope.timeout(() => { for (const g of c.querySelectorAll(".mx-seg-done,.mx-seg-next")) g.classList.remove("mx-seg-done", "mx-seg-next"); }, 1400);
      }
      STEPS.set(key, done);
    }
  }

  function projectMarks() {
    const pid = E.project?.(), row = document.querySelector(pid ? `#projects .prow[data-go="p:${CSS.escape(pid)}"]` : '#projects .prow.is-on[data-go^="p:"]');
    const view = E.isThread() ? "thread" : (/** @type {HTMLElement} */ (document.getElementById("app"))).dataset.view;
    const ic = (view === "project" || view === "thread") && row && row.querySelector(".pr-ic svg");
    if (!ic) return;
    for (const av of [...msgs.querySelectorAll(".m-them > .av:not(.av-gap):not(.mx-pm)"), ...E.typing.querySelectorAll(".typing > .av:not(.mx-pm)")]) {
      if (!av.querySelector(".xo-mark")) continue;
      av.classList.add("mx-pm");
      av.replaceChildren(ic.cloneNode(true), ...[...av.querySelectorAll(".arc")]);
    }
  }
  const typingFade = () => { const t = E.typing.querySelector(".ty-t"); if (t) t.classList.toggle("mx-fade", t.scrollWidth > t.clientWidth + 1); };
  const typingChanges = new MutationObserver(() => { scheduler.invalidate("list"); wave(E.typing); typingFade(); });
  scope.observe(typingChanges);
  typingChanges.observe(E.typing, { childList: true, subtree: true, characterData: true });
  const typingSize = new ResizeObserver(typingFade);
  scope.observe(typingSize);
  typingSize.observe(E.typing);

  const { working, restoreFocus, updateOrder, updateTails } = createWorkingTurn(E, scope);
  scope.effect(() => scheduler.onFlush("list", decorateList));

  /** @param {Iterable<HTMLElement>} rows */
  function decorateRows(rows) {
    agentNameMemo = null;
    for (const row of rows) decorateRow(row);
    scheduler.invalidate("list");
  }

  const observer = new MutationObserver((records) => {
    const added = new Set(/** @type {HTMLElement[]} */ ([]));
    for (const record of records) for (const node of record.addedNodes) {
      if (node.nodeType === Node.ELEMENT_NODE && node.parentNode === msgs) added.add(/** @type {HTMLElement} */ (node));
    }
    decorateRows(added);
  });
  scope.observe(observer);
  observer.observe(msgs, { childList: true });
  scope.listen(msgs, "redrawn", (event) => {
    const row = /** @type {HTMLElement} */ (event.target);
    if (row.parentNode !== msgs) return;
    for (const bubble of row.querySelectorAll(".bubble")) decoratedBubbles.delete(bubble);
    decorateRows([row]);
    restoreFocus(row);
  });

  const startReply = wireMessageReply(E, scope, { nameIn, textOf, runText, rate });
  wireMessageSwipes(msgs, E.scroller, startReply, scope);

  function decorate() { decorateRows(/** @type {HTMLCollectionOf<HTMLElement>} */ (msgs.children)); }
  decorate();
  mountLatestButton(E, scope);

  return { decorate, conv, msgs, destroy: () => scope.dispose(), get activeEffects() { return scope.size; } };
}
