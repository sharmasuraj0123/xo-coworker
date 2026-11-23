import { esc, WAITING } from "./world.js";
import * as Kit from "../modules/decisions/kit.js";
import * as K from "../core/platform/keys.js";
import { EFFORT, effortOf, rank, evidenceFor, leverageOf, estLine } from "../modules/decisions/rank.js";
import { ICON, stepMark, xi, $, RM, clock, sound, dial, wait, morph, expand } from "./ui.js";
import { usable, hookOf } from "./focusview.js";
import { renderMarkdown, renderInline, excerptMarkdown } from "./markdown.js";
import { highlight } from "./highlight.js";
import { itemParts, itemBody, questionsOf, evidenceOf, itemEffort, isNo, VERB } from "../core/services/review.js";
import { clientId as newKey } from "../core/platform/http.js";
import { KINDS, kindOf, commandOf, headOf, whyOf, stripOf, chipsOf, optionsOf, pickKeys, actsOf, isOnePress } from "./cardparts.js";
import { radioKeys } from "./keynav.js";
import { resetWords, rtName } from "../core/services/runtimes.js";
import { paidHtml } from "../modules/decisions/cards/paid.js";
import { redraw } from "./redraw.js";

export const riskLabel = (r) => ({ destructive: "Destructive", notable: "Notable", routine: "Routine", stopped: "Stopped" })[r] || "Notable";
const BIG_CHECK = ICON.stampAllow;
const BIG_BACK = ICON.stampBack;
export function createDecisions({ world, P, PROJ, announce, render, back, later, waitSince, onOpenThread, onAllClear, onUndone, onBreak, onSent, onNotSent, onShown, onGone }) {
  const panel = $("#panel"), stage = $("#pn-stage");
  const firstSeen = new Map();
  let seq = 0;
  const sentKeys = new Map();
  const stoppedDone = new Set();
  const log = [];
  const teach = new Map();
  const noSecret = new Set(); // items XO wouldn't carry a secret answer to (secret_needs_a_call)
  let logN = 0, cardN = 0;
  /** The Allow button's words: the item's own label, or the reach chosen (its sentence shows below). */
  const scopeWords = (P, id) => {
    const o = id && P.scopes.find((x) => x.id === id);
    return !o ? (P.primary ? P.primary.label : "Allow") : o.scope === "thread" ? "Allow for this thread" : "Allow + rule";
  };

  // ── the needs-you list: every ask, with effort, leverage, idleness, suggestion ──
  function needItems() {
    const out = [];
    for (const t of [...world.state.threads, ...(world.state.hosts || [])]) {
      // a thread that stopped, was answered and later stops again must come back (P1-7)
      if (t.state !== "failed") stoppedDone.delete(t.id);
      if (t.state === "failed") {
        const key = `stop|${t.id}`;
        if (stoppedDone.has(t.id) || queue.has(key)) continue;
        // a stop someone meant (storm's activity "stopped": the owner's, or the coordinator's on the owner's word)
        // is no failure and asks nothing: the thread says who stopped it, and the owner's next message resumes it.
        // Only a real failure (activity "failed", or an older backend's bare "failed") offers Try again
        if (!t.stop) out.push({ key, t, ask: { kind: "stopped", title: t.title, detail: String(t.happened || "").replace(/^Stopped:\s*/i, "Stopped: "), risk: "stopped" }, group: "stopped", risk: "stopped" });
        // its open review items (an integrity report, a schedule to approve) still need their own answer
        for (const a of Kit.asksOf(t)) {
          if (!a.item) continue;
          const k = Kit.askKey(t, a);
          if (queue.has(k) || sentKeys.has(k)) continue;
          out.push({ key: k, t, ask: a, group: Kit.groupOf(t, a), risk: Kit.riskOf(a) });
        }
        continue;
      }
      // a finished thread can still hold an open item (an integrity report arrives after its turn)
      if ((t.state === "done" || t.state === "resolved") && !(t.asks || []).some((a) => a.item)) continue;
      for (const a of Kit.asksOf(t)) {
        const key = Kit.askKey(t, a);
        if (queue.has(key) || sentKeys.has(key)) continue;
        out.push({ key, t, ask: a, group: Kit.groupOf(t, a), risk: Kit.riskOf(a) });
      }
    }
    const now = Date.now();
    for (const n of out) {
      if (!firstSeen.has(n.key)) firstSeen.set(n.key, { seq: ++seq, at: now });
      n.since = firstSeen.get(n.key).seq;
      n.waitSince = waitSince.get(n.key) ?? waitSince.get(n.t.id) ?? firstSeen.get(n.key).at;
      n.effort = n.ask.item ? itemEffort(n.ask.item) : effortOf(n);
      n.lev = leverageOf(n);
      // idle: its agent isn't working, so nothing moves until you answer. Live threads say so by their
      // session (a "working" thread whose session sits warm is idle); an item with no thread is idle.
      n.idle = WAITING(n.t.state) || n.group === "stopped" || !!n.t.host || (n.t.live && n.t.busy === false);
      n.later = later.has(n.key);
    }
    P.classify(out);
    return rank(out);
  }

  /** Was the item decided by this very request (same idempotency key)? */
  const ownDecision = (part, err) => {
    const k = part.choice && part.choice.body && part.choice.body.idempotency_key;
    return !!k && !!(err.item && err.item.decision && err.item.decision.idempotency_key === k);
  };
  /** A title as a sentence: one full stop, never "token?." */
  const stop = (t) => { t = String(t || "").trim(); return /[.?!…]$/.test(t) ? t : `${t}.`; };
  /** Why a decision wasn't sent: the item had already left the list (decided, withdrawn, expired). */
  function goneWhy(err) {
    const d = err.item && err.item.decision && err.item.decision.decision;
    if (err.gone === "already_decided" || err.gone === "decided") return `It was already decided elsewhere${d && VERB[d] ? ` (${VERB[d].toLowerCase()})` : ""}.`;
    if (err.gone === "withdrawn") return "It was withdrawn before your answer arrived.";
    if (err.gone === "expired") return "It had expired, and the agent was told.";
    return "It's no longer waiting for you.";
  }
  /** The same, short, for the herald. */
  function failShort(err) {
    if (err && err.code === "secret_needs_a_call") return "XO can't carry a secret here. Give it outside XO, then tell the thread.";
    if (err && err.code === "rule_sentence_mismatch") return "The rule's wording changed. It's back in your list.";
    if (err && err.status >= 400 && err.status < 500 && err.message) return `${stop(err.message)} It's back in your list.`;
    return "It didn't reach the agent. It's back in your list.";
  }
  /** A decision XO refused: the server's reason, and whether it can simply be tried again. */
  function failLine(part, err) {
    const t = stop(part.ask.title);
    if (err && err.code === "secret_needs_a_call") return `Not sent: ${t} XO can't pass a secret to this question. Don't paste it into the thread: give it to the agent outside XO, then tell the thread it's done.`;
    if (err && err.code === "rule_sentence_mismatch") return `Not sent: ${t} The rule's wording has changed; read it again and decide. It's back in your list.`;
    if (err && err.status >= 400 && err.status < 500 && err.message) return `Not sent: ${t} ${stop(err.message)} It's back in your list.`;
    return `Didn't reach the agent: ${t} It's back in your list.`;
  }

  // ── commit window (3 s, Undo) ─────────────────────────────────────────────
  const queue = Kit.createCommitQueue({
    exec: (p) => Promise.resolve(p.choice && p.choice.resolve ? world.act.resolve(p.t.id, true) : p.stopped ? world.act.reply(p.t.id, p.choice.text) : p.choice && p.choice.storm ? world.act.decideItem(p.ask.item.id, p.choice.body) : Kit.answer(world, p.t, p.ask, p.choice, p.note)).then(() => {
      // a held ask on a thread that kept working: the answer closes it
      if (p.t.state === "working" && p.t.asks.length) { p.t.asks = []; p.t.needsYou = ""; }
    }),
    onChange(type, item, results) {
      if (type === "undone") {
        for (const p of item.parts) { const i = log.indexOf(p.entry); if (i >= 0) log.splice(i, 1); F.status.delete(p.key); }
        announce("Undone. Nothing was sent; the ask is back.");
        if (F.open) {
          const p = item.parts[0];
          clearTimeout(F.autoT);
          F.done = false; F.cur = p.key; F.items.set(p.key, p.n);
          if (!F.order.includes(p.key)) F.order.unshift(p.key);
          show(F.cur, "undo");
        }
        onUndone && onUndone(item.parts[0].key);
      }
      if (type === "sending") for (const p of item.parts) p.entry.status = "sending";
      if (type === "settled") {
        for (const { part, ok, err } of results) {
          if (ok) {
            part.entry.status = "sent";
            if (part.stopped) stoppedDone.add(part.t.id); else sentKeys.set(part.key, Date.now());
            onSent && onSent(part);
          } else if (err && err.gone && ownDecision(part, err)) {
            // it was this very decision (sent before an error said otherwise): it counts as sent
            part.entry.status = "sent";
            sentKeys.set(part.key, Date.now());
            onSent && onSent(part);
          } else if (err && err.gone) {
            // refused because the item had already left: never counted as made (UI-reference §4.3 #7)
            part.entry.status = "gone";
            part.entry.why = goneWhy(err);
            sentKeys.set(part.key, Date.now());
            announce(`Not sent: ${stop(part.ask.title)} ${part.entry.why}`);
            onNotSent && onNotSent(part.ask.title, part.entry.why);
          } else {
            part.entry.status = "failed";
            F.status.delete(part.key);
            if (err && err.code === "secret_needs_a_call" && part.ask.item) noSecret.add(part.ask.item.id);
            if (part.choice && part.choice.resolve) {
              // Done that didn't land: the thread stays open and its card comes back
              announce(`Couldn't resolve ${part.t.title}: ${err && err.message ? stop(err.message) : "XO didn't answer."} It's back in your list.`);
              onNotSent && onNotSent(`Couldn't resolve ${part.t.title}`, `${err && err.message ? stop(err.message) : "XO didn't answer."} It's back in your list.`);
              continue;
            }
            announce(failLine(part, err));
            onNotSent && onNotSent(part.ask.title, failShort(err));
          }
        }
      }
      toastRender();
      render();
    },
  });

  // ── panel state ───────────────────────────────────────────────────────────
  const F = { open: false, parked: false, order: [], items: new Map(), status: new Map(), cur: null, done: false, hold: null, mode: "all", returnTo: null, swap: 0, open0: {}, vig: false };
  /** The words of the newest try on this ask that failed to send, kept for the next try: a Send back's note, or
   *  (mode "reply") an answer you typed; "" once something newer happened to it. */
  function failedWords(key, mode = "back") {
    const e = log.find((d) => d.key === key);
    if (!e || e.status !== "failed") return "";
    return mode === "reply" ? (e.typed ? e.said || "" : "") : e.note || "";
  }
  const api = {
    needItems,
    decisions: () => log.filter((d) => d.status !== "failed" && d.status !== "gone"),
    /** Decisions XO refused because the item had already left, with why (for the conversation). */
    notSent: () => log.filter((d) => d.status === "gone"),
    /** The note of the newest decision on this ask that failed to send (its words are kept for the retry). */
    failedNote: (key, mode) => failedWords(key, mode), // only while that failure is the latest word on it
    isOpen: () => F.open && !F.parked,
    park, unpark,
    current: () => (F.open && !F.done && !F.vig ? F.cur : null),
    open, close, sync, undo, decide, decideNow, laterNow, bringIn,
    cardHtml, wireCard,
    /** The parts Home's next card shares with this one. */
    parts: { effTagHtml, leadHtml, chipsHtml },
    queued: (key) => queue.has(key),
    pendingKey: (key) => queue.has(key),
  };

  function open(startKey, { only = null, teach: teachScope = null } = {}) {
    let needs = needItems();
    const start = startKey && needs.find((n) => n.key === startKey);
    if (start && start.held) { P.bringIn(start.key); needs = needItems(); }
    needs = needs.filter((n) => n.admitted);
    if (only === "glance") needs = needs.filter((n) => n.effort === "glance" && !n.later);
    else if (Array.isArray(only)) needs = needs.filter((n) => only.includes(n.key));
    if (!needs.length) return false;
    if (!F.open) F.returnTo = document.activeElement;
    F.mode = only === "glance" ? "glance" : Array.isArray(only) ? "set" : "all";
    F.order = needs.map((n) => n.key);
    F.items = new Map(needs.map((n) => [n.key, n]));
    F.status = new Map();
    F.cur = startKey && F.order.includes(startKey) ? startKey : (needs.find((n) => !n.later) || needs[0]).key;
    if (teachScope && startKey) teach.set(startKey, teachScope);
    F.done = false; F.vig = false;
    const was = F.open && !F.parked;
    F.open = true; F.parked = false;
    P.reviewStart();
    panel.hidden = false;
    document.body.classList.add("panel-open");
    if (!was) { panel.classList.remove("is-in"); void panel.offsetWidth; panel.classList.add("is-in"); }
    $("#pn-h").textContent = F.mode === "glance" ? "Quick glances" : F.mode === "set" ? "Before you go" : "Needs you";
    show(F.cur, was ? "skip-fwd" : "enter");
    announce(`${$("#pn-h").textContent}: ${F.order.length}.`);
    render();
    onShown && onShown();
    return true;
  }
  /** Steps aside, kept as it was, while another card has the edge; unpark brings it back with focus. */
  function park() {
    if (!F.open || F.parked) return;
    F.parked = true; panel.hidden = true;
    document.body.classList.remove("panel-open");
    render();
  }
  function unpark() {
    if (!F.open || !F.parked) return;
    F.parked = false; panel.hidden = false;
    document.body.classList.add("panel-open");
    render();
    ($("#card") || panel).focus({ preventScroll: true });
  }

  function close({ restore = true } = {}) {
    if (!F.open) return;
    F.hold && F.hold.cancel();
    clearTimeout(F.autoT);
    const was = !F.parked;
    F.open = false; F.parked = false;
    P.reviewStop();
    panel.classList.remove("is-in");
    panel.classList.add("is-out");
    document.body.classList.remove("panel-open");
    setTimeout(() => { if (!F.open) { panel.hidden = true; panel.classList.remove("is-out"); stage.innerHTML = ""; } }, RM.matches ? 0 : 240);
    // back to what opened it. Still here, it takes focus now (a redraw keeps the control it's on). Redrawn while the
    // panel was open (Home's card shows "Open in the panel" meanwhile, so its Details was taken away), the same control
    // takes it in the draw that brings it back, else the place: never the page, as the hidden Close leaves it (the
    // controls grader on 05d76ca, S142: BODY at 450 ms, for Enter, Space and a press, four cells)
    const r = F.returnTo;
    F.returnTo = null;
    if (restore && was) { if (usable(r)) r.focus({ preventScroll: true }); else back && back([hookOf(r)].filter(Boolean)); }
    toastRender();
    render();
    onGone && onGone();
  }

  /** On every app render: fold newly admitted asks in, mark vanished ones. Held asks never join by themselves. */
  function sync() {
    if (!F.open) return;
    if (F.mode === "set") { for (const k of F.order) if (!F.status.has(k) && !queue.has(k) && !needItems().some((n) => n.key === k)) F.status.set(k, "gone"); return; }
    let needs = needItems().filter((n) => n.admitted);
    if (F.mode === "glance") needs = needs.filter((n) => n.effort === "glance");
    const live = new Set(needs.map((n) => n.key));
    let changed = false;
    for (const n of needs) {
      F.items.set(n.key, n);
      if (!F.order.includes(n.key) && !F.done) {
        const order = rank(F.order.map((k) => F.items.get(k)).filter(Boolean).concat(n)).map((x) => x.key);
        const at = Math.max(order.indexOf(n.key), F.order.indexOf(F.cur) + 1);
        F.order.splice(at, 0, n.key);
        changed = true;
      }
      if (F.status.get(n.key) === "gone") { F.status.delete(n.key); changed = true; }
    }
    for (const k of F.order) {
      if (!F.status.has(k) && !live.has(k) && !queue.has(k)) { F.status.set(k, "gone"); changed = true; if (k === F.cur && !F.done && !F.vig) advance("skip-fwd"); }
    }
    if (changed) chrome();
  }

  const pending = (k) => !F.status.has(k);
  function nextPending(from, dir = 1) {
    const n = F.order.length, i0 = F.order.indexOf(from);
    for (let s = 1; s <= n; s++) {
      const k = F.order[(i0 + dir * s + n * 2) % n];
      if (pending(k) && k !== from) return k;
    }
    return null;
  }
  function advance(how) {
    const nx = nextPending(F.cur, how === "skip-back" ? -1 : 1);
    if (!nx) { finish(how); return; }
    // the vigilance cap: at a natural break (between asks), never mid-card
    if (P.tired() && (how === "allow" || how === "back")) { F.cur = nx; vigilance(how); return; }
    F.cur = nx;
    show(nx, how);
  }

  // ── deciding ──────────────────────────────────────────────────────────────
  function decide(n, choice, note = "", { secs = null, inline = false } = {}) {
    note = String(note || "").trim();
    // one decision per ask: a second press (a double-click, a key during the card's exit) does nothing
    if (queue.has(n.key) || sentKeys.has(n.key) || (F.open && /^(allow|back)$/.test(F.status.get(n.key) || ""))) return null;
    if (n.ask.item) return decideItem(n, choice, note, secs, inline);
    let taught = false, scope = null;
    if (choice === "allow" && teach.get(n.key)) {
      const cmd = commandOf(n.ask);
      scope = teach.get(n.key);
      const sentence = Kit.teachSentence(PROJ(n.t.project), scope === "prefix" ? Kit.prefixOf(cmd) : cmd);
      note = note ? `${note} ${sentence}` : sentence;
      taught = true;
    }
    const stopped = n.group === "stopped";
    const done = !!(choice && choice.resolve);
    const verb = done ? "Done" : choice === "allow" ? "Allowed" : choice === "deny" ? "Sent back" : stopped ? "Asked to retry" : "Answered";
    const said = typeof choice === "object" && !done ? choice.option || choice.text : "";
    const entry = { id: ++logN, key: n.key, verb, choice: choice === "allow" || choice === "deny" ? choice : "answer", label: n.ask.title, said, typed: !done && typeof choice === "object" && !!choice && choice.text != null, note, taught, project: n.t.project, thread: n.t.title, tid: n.t.id, at: Date.now(), status: "queued", risk: n.risk, lev: n.lev, doneAt: n.t.checklist.done, secs: secs ?? (n.effort === "glance" ? 5 : 40) };
    log.unshift(entry);
    teach.delete(n.key);
    if (F.open) F.status.set(n.key, choice === "deny" ? "back" : "allow");
    queue.push([{ key: n.key, n, t: n.t, ask: n.ask, choice, note, stopped, entry }], { verb, label: done ? n.t.title : said ? `${said}` : n.ask.title, deny: choice === "deny", inline });
    sound.play(choice === "deny" ? "back" : "allow");
    announce(done ? `Done: ${n.t.title} will be resolved. Undo for 3 seconds.` : `${verb}${said ? `: ${said}` : ""}. Undo for 3 seconds.`);
    toastRender();
    render();
    return entry;
  }

  /** A storm item: the request body is built now (so a bad choice is refused before the window). */
  function decideItem(n, choice, note, secs, inline) {
    const it = n.ask.item;
    const P = itemParts(it);
    if (choice === "allow" && teach.get(n.key)) choice = { scope: P.scopes.find((o) => o.id === teach.get(n.key)) };
    let body;
    try { body = itemBody(it, choice, note); } catch (err) { announce(err.message); return null; }
    // one key per decision, so a resend of this same decision is the same request
    body.idempotency_key = newKey();
    const no = isNo(body);
    const opt = body.scope === "thread" ? P.scopes.find((o) => o.scope === "thread") : body.option ? P.scopes.find((o) => o.id === body.option) : null;
    const said = typeof choice === "object" && choice ? (choice.option || choice.text || choice.name || (choice.answers ? "your answers" : "") || (opt ? opt.label : "")) : "";
    const verb = opt ? (opt.scope === "thread" ? "Allowed for this thread" : "Allowed, with a rule") : VERB[body.decision] || "Answered";
    const entry = { id: ++logN, key: n.key, verb, choice: no ? "deny" : body.decision === "answer" ? "answer" : "allow", label: it.title, said, note, taught: !!opt && opt.scope === "rule", project: n.t.project, thread: n.t.title, tid: n.t.id, at: Date.now(), status: "queued", risk: n.risk, lev: n.lev, doneAt: n.t.checklist.done, secs: secs ?? (n.effort === "glance" ? 5 : 40) };
    log.unshift(entry);
    teach.delete(n.key);
    if (F.open) F.status.set(n.key, no ? "back" : "allow");
    queue.push([{ key: n.key, n, t: n.t, ask: n.ask, choice: { storm: true, body }, note: "", stopped: false, entry }], { verb, label: said || it.title, deny: no, inline });
    sound.play(no ? "back" : "allow");
    announce(`${verb}${said ? `: ${said}` : ""}. Undo for 3 seconds.`);
    toastRender();
    render();
    return entry;
  }

  /** For Home and the thread's own card: decide one ask without the panel. */
  function decideNow(key, choice, note) {
    const n = needItems().find((x) => x.key === key);
    if (!n) return false;
    if (n.risk === "destructive" && choice === "allow") return false; // only ever via the hold
    return !!decide(n, choice, note);
  }
  function laterNow(key) { later.add(key); announce("Planned for later today. It won't come up as your next move until then."); render(); }
  function bringIn(key) { P.bringIn(key); announce("Brought in. It's in today's list now."); render(); }

  /** keys: exactly the asks the question listed ("Allow 2" allows those 2): an ask that arrives while it's open
   *  isn't swept in (Astra: it confirmed 3). Each must still be pending and routine. */
  function allowAllRoutine(keys) {
    const batch = keys.filter(pending).map((k) => F.items.get(k)).filter((n) => n && n.group === "routine" && Kit.isBinary(n.ask));
    if (!batch.length) return;
    const parts = batch.map((n) => {
      const entry = { id: ++logN, key: n.key, verb: "Allowed", choice: "allow", label: n.ask.title, project: n.t.project, thread: n.t.title, tid: n.t.id, at: Date.now(), status: "queued", risk: n.risk, batch: true, lev: n.lev, doneAt: n.t.checklist.done, secs: 3 };
      log.unshift(entry);
      F.status.set(n.key, "allow");
      return { key: n.key, n, t: n.t, ask: n.ask, choice: "allow", note: "", entry };
    });
    queue.push(parts, { verb: "Allowed", label: `${batch.length} routine asks` });
    sound.play("allow");
    announce(`Allowed ${batch.length} routine asks. Undo for 3 seconds.`);
    toastRender(); render();
    if (!pending(F.cur)) advance("allow"); else show(F.cur, "enter");
  }

  function setLater() {
    const k = F.cur;
    later.add(k);
    F.status.set(k, "later");
    announce("Planned for later today. Nothing else changes.");
    render();
    advance("skip-fwd");
  }

  function undo() { return !!queue.undo(); }

  // ── the card (shared by the panel and the thread's own decision) ─────────
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

  function detailsHtml(n, ev) {
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

  function waitingDetailsHtml(n) {
    const t = n.t, a = n.ask;
    const { md, more } = excerptMarkdown(a.full || a.detail || "", 600);
    const items = [...t.checklist.items].sort((x, y) => (x.state === "done") - (y.state === "done"));
    const ck = items.map((i) => `<li class="ck ck-${esc(i.state)}"><span class="ck-m" aria-hidden="true">${stepMark(i.state)}</span><span>${renderInline(i.text || "", true)}</span></li>`).join("");
    const main = md ? `<div class="prose dt-ex${more ? " is-more" : ""}">${renderMarkdown(md)}</div>${more ? `<button type="button" class="dt-more" data-act="thread" title="Open the thread${K.hint("open")}">The rest is in the thread ${ICON.chevron}</button>` : ""}` : `<p class="dt-why">Open the thread to see what it needs.</p>`;
    return `<div class="dt"><div class="dt-main">${main}</div>` +
      (items.length ? `<div class="dt-side"><h4>Checklist <span>${t.checklist.done} of ${t.checklist.total}</span></h4><ol class="ck-list">${ck}</ol>${t.branch ? `<p class="ev-br">${ICON.branch}<code>${esc(t.branch)}</code></p>` : ""}</div>` : "") + `</div>`;
  }

  /** An answer button. A preview, when there is one, sits in a small swatch so the button never looks disabled. */
  function optHtml(o, i, ev) {
    const pv = ev.preview ? ev.preview.find((p) => p.label === o) : null;
    return `<button type="button" class="b b-opt${pv ? " has-pv" : ""}" data-opt="${i}" title="Answer “${esc(o)}” (${i + 1})">${pv ? `<span class="o-pv" aria-hidden="true"><span class="o-s" style="${esc(pv.css)}">${esc(pv.sample || o)}</span></span>` : ""}<span class="o-l">${esc(o)}</span></button>`;
  }

  /** A storm item's evidence: the exact detail the server sent, never our prose. */
  function itemDetailsHtml(n) {
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

  /** A usage limit (F5): when it opens again, and the threads waiting on it (a link each). */
  function limitHtml(it) {
    const L = it.limit;
    const when = L.resetsAt ? resetWords(L.resetsAt) : "";
    return `<div class="lim">${when ? `<p class="lim-when">${ICON.clock}<span>Opens again ${esc(when)}</span></p>` : ""}` +
      `<ul class="lim-ts" aria-label="Waiting threads">${L.threads.map((x) => `<li><button type="button" class="rt-go" data-go="t:${esc(x.ts)}" title="Open “${esc(x.title || "the thread")}”"><b>${esc(x.title || "A thread")}</b></button>${x.stays ? `<span class="lim-stay">stays: its project doesn't allow ${esc(rtName(L.moveTo))}</span>` : ""}</li>`).join("")}</ul></div>`;
  }

  /** A button from the card's parts (js/cardparts.js actsOf): its key, its icon, the item's own words. */
  function actHtml(b, n, scope) {
    const it = n.ask.item;
    const keyed = (cls, icon, title, key) => `<button type="button" class="b ${cls}" data-act="${b.act}" title="${esc(title)}${K.hint(key)}" aria-keyshortcuts="${K.label(key)}"><span class="b-l">${icon}${esc(b.label)}</span></button>`;
    switch (b.act) {
      case "allow": return `<button type="button" class="b b-allow${n.risk === "notable" ? " arming" : ""}" data-act="allow" title="${esc(b.label)}${K.hint("allow")}" aria-keyshortcuts="${K.label("allow")}"><span class="b-l">${ICON.check}<span class="al-t">${esc(it ? scopeWords(itemParts(it), scope) : scope ? "Allow + rule" : b.label)}</span></span></button>`;
      case "hold": return `<button type="button" class="b b-hold" data-act="hold" title="Press and hold for 1.2 s (hold Enter)" aria-label="${esc(b.label)}: ${esc(n.ask.title)}. Press and hold for 1.2 seconds."><span class="hold-fill" aria-hidden="true"></span><span class="b-l"><span class="hold-ic">${ICON.lock}</span><span class="hold-txt" data-label="${esc(b.label)}">${esc(b.label)}</span></span></button>`;
      case "submit": return `<button type="submit" class="b b-allow"><span class="b-l">${ICON.check}${esc(b.label)}</span></button>`;
      case "back": return keyed("b-back", ICON.rewind, "Send back with a note", "back");
      case "back-now": return keyed("b-back", ICON.rewind, b.label, "back");
      case "reply": return keyed("b-reply", ICON.edit, "Reply in your words", "reply");
      case "note-reply": return keyed("b-back", ICON.edit, b.label, "reply");
      case "retry": return keyed("b-allow", ICON.retry, b.label, "allow");
      case "done": return keyed("b-done", ICON.check, "It's finished: resolve the thread", "done");
      case "thread": return keyed("b-reply", ICON.arrow, "Open the thread", "open");
      case "later": return keyed("b-ghost b-later", ICON.clock, "Plan for later today", "later");
      default: return "";
    }
  }
  /** The card's one row of buttons: the yes and the no at equal width, Later beside them. */
  const rowHtml = (acts, n, scope) => acts.length ? `<div class="c-btns">${acts.map((b) => actHtml(b, n, scope)).join("")}</div>` : "";

  /** An answer's grey line: "Suggested · " on the one the agent recommends, its reason, and what it costs. */
  const optLine = (o, tag) => o.description || o.cost || o.recommended
    ? `<${tag} class="o-d">${o.recommended ? `<span class="o-rec">Suggested · </span>` : ""}${[o.description && esc(o.description), o.cost && `<span class="o-cost">${esc(o.cost)}</span>`].filter(Boolean).join(" · ")}</${tag}>` : "";

  /** A question's answers, one per row: one press each for a plain choice, else the form (several, multi, secret) with its Send. */
  function questionHtml(n, id, acts) {
    const it = n.ask.item, qs = questionsOf(it);
    if (isOnePress(n)) {
      const os = optionsOf(qs[0]), keys = pickKeys(os);
      return `<div class="c-opts is-list" role="group" aria-label="Answers">${os.map((o, i) => `<button type="button" class="b b-opt${o.recommended ? " is-rec" : ""}" data-iopt="${o.index}"${keys[i] ? ` data-pick="${keys[i]}"` : ""} title="Answer “${esc(o.label)}”${keys[i] ? ` (${keys[i]})` : ""}"><span class="o-l">${esc(o.label)}</span>${optLine(o, "span")}</button>`).join("")}</div>` + rowHtml(acts, n);
    }
    return `<form class="c-qs" data-qform novalidate>${qs.map((q, qi) => {
      const name = `q${id}-${qi}`;
      // a lone question that is the card's own title isn't said twice (its label stays for screen readers)
      const same = qs.length === 1 && !q.header && q.question === it.title;
      const head = same ? `<legend class="sr-only">${esc(q.question)}</legend>` : `<legend>${esc(q.header || q.question)}</legend>${q.header && q.question ? `<p class="c-q-q">${esc(q.question)}</p>` : ""}`;
      if (q.secret) return `<fieldset class="c-q">${head}<input type="password" class="c-q-in" name="${name}" data-qid="${esc(q.id)}" autocomplete="off" aria-label="${esc(q.question)}"><p class="c-q-s">Goes to the agent only; XO keeps it as [secret].</p></fieldset>`;
      if (!q.options.length) return `<fieldset class="c-q">${head}<input class="c-q-in" name="${name}" data-qid="${esc(q.id)}" autocomplete="off" aria-label="${esc(q.question)}"></fieldset>`;
      const os = optionsOf(q), keys = qs.length === 1 ? pickKeys(os) : os.map(() => 0);
      return `<fieldset class="c-q">${head}<div class="c-q-opts">${os.map((o, i) => `<label class="c-q-o${o.recommended ? " is-rec" : ""}"><input type="${q.multi ? "checkbox" : "radio"}" name="${name}" data-qid="${esc(q.id)}" value="${esc(o.label)}"${keys[i] ? ` data-pick="${keys[i]}"` : ""}><span><b>${esc(o.label)}</b>${optLine(o, "em")}</span></label>`).join("")}</div></fieldset>`;
    }).join("")}${rowHtml(acts, n)}</form>`;
  }

  /** How far an Allow reaches: the switch, and under it the choices with the exact sentence each adds. */
  function ruleHtml(n) {
    const it = n.ask.item, scope = teach.get(n.key);
    if (it) {
      const P = itemParts(it);
      if (!P.scopes.length) return "";
      const cur = P.scopes.find((o) => o.id === scope) || P.scopes[0];
      return `<div class="c-rule"><button type="button" class="teach-tog" data-act="teach" aria-pressed="${!!scope}" title="Allow more than once${K.hint("rule")}"><span class="sw" aria-hidden="true"></span>${P.scopes.some((o) => o.scope === "rule") ? "Make it a rule" : "Allow for this thread"}</button></div>` +
        `<div class="teach-body"${scope ? "" : " hidden"}><div class="teach-in"><div class="teach-scope is-list" role="radiogroup" aria-label="How far it reaches">${P.scopes.map((o) => `<button type="button" role="radio" data-iscope="${esc(o.id)}" aria-checked="${o.id === (scope || cur.id)}">${esc(o.scope === "thread" ? o.label : (o.sentence || o.label))}</button>`).join("")}</div>` +
        `<p class="teach-q"><span>${cur.scope === "rule" ? "Added to your rules, word for word:" : "For this thread only:"}</span><q>${esc(cur.sentence || cur.label)}</q></p></div></div>`;
    }
    const cmd = commandOf(n.ask);
    if (n.ask.kind !== "permission" || n.risk === "destructive" || !cmd) return "";
    return `<div class="c-rule"><button type="button" class="teach-tog" data-act="teach" aria-pressed="${!!scope}" title="Make it a rule${K.hint("rule")}"><span class="sw" aria-hidden="true"></span>Make it a rule</button></div>` +
      `<div class="teach-body"${scope ? "" : " hidden"}><div class="teach-in"><div class="teach-scope" role="radiogroup" aria-label="Rule scope"><button type="button" role="radio" data-scope="exact" aria-checked="${scope !== "prefix"}">Exactly this command</button><button type="button" role="radio" data-scope="prefix" aria-checked="${scope === "prefix"}">Any “${esc(Kit.prefixOf(cmd))}”</button></div><p class="teach-q"><span>Added to your rules, word for word:</span><q>${esc(Kit.teachSentence(PROJ(n.t.project), scope === "prefix" ? Kit.prefixOf(cmd) : cmd))}</q></p></div></div>`;
  }

  // code wraps only after a slash or a space; a piece breaks inside itself only when it is wider than the strip
  const codeHtml = (text) => String(text).replace(/[^\s/]*\/+|[^\s/]+|\s+/g, (m) => (/^\s/.test(m) ? m : `<span class="ev-w">${esc(m)}</span>`));

  /** The card's one strip of evidence (cardparts stripOf), drawn: mono for a command, an address, a tool or files. */
  function stripHtml(s) {
    if (!s) return "";
    const tag = s.tag ? `<span class="ev-tag">${esc(s.tag)}</span>` : "";
    if (s.type === "diff") return `<div class="c-ev is-diff">${s.lines.map((l) => `<code class="${l.sign === "+" ? "dl-add" : "dl-del"}">${esc(l.sign + l.text)}</code>`).join("")}</div>`;
    if (s.type === "plan") return `<div class="c-ev is-plan${s.more ? " is-more" : ""}">${tag}<p class="ev-plan">${esc(s.text.replace(/^#+\s*/gm, ""))}</p></div>`;
    if (s.type === "paths") return `<ul class="c-ev is-paths">${s.items.map((p) => `<li><code>${esc(p.path)}</code>${p.add ? `<span class="dl-add">+${p.add}</span>` : ""}${p.del ? `<span class="dl-del">−${p.del}</span>` : ""}</li>`).join("")}${s.more ? `<li class="ev-more">${s.more} more</li>` : ""}</ul>`;
    if (s.type === "error") return `<p class="c-ev is-error">${esc(s.text)}</p>`;
    if (s.type === "files") return `<ul class="c-ev is-files">${s.items.map((p) => `<li><code>${codeHtml(p)}</code></li>`).join("")}${s.more ? `<li class="ev-more">${s.more} more</li>` : ""}</ul>`;
    return `<p class="c-ev is-mono">${tag}<code>${codeHtml(s.text)}</code></p>`;
  }

  /** The top row's first two: how long it takes, and a tag only when it is destructive or stopped. */
  function effTagHtml(n) {
    const E = EFFORT[n.effort];
    const tag = n.risk === "destructive" ? `<span class="risk r-destructive">${ICON.lock}Destructive</span>` : kindOf(n) === "stopped" ? `<span class="risk r-stopped">Stopped</span>` : "";
    return `<span class="eff e-${n.effort}">${dial(n.effort)}<b>${E.label}</b><span>${E.time}</span></span>${tag}`;
  }

  /** The headline in words, its one line of why, a parked note, the one strip, then what it costs. */
  function leadHtml(n, idp, h) {
    const head = headOf(n), line = whyOf(n), it = n.ask.item;
    return `<${h} class="c-h" id="${idp}-h">${head.verb ? `<span class="h-verb">${esc(head.verb)}</span> ` : ""}${head.md ? renderInline(head.text, true) : esc(head.text)}</${h}>` +
      (line ? `<p class="c-line" id="${idp}-why">${esc(line)}</p>` : "") +
      (it && it.parked ? `<p class="c-park">${ICON.pause}<span>Parked: the agent was told to wait; an answer wakes it</span></p>` : "") +
      stripHtml(stripOf(n)) + (it && it.limit ? limitHtml(it) : paidHtml(it));
  }

  /** The facts as chips, the estimate last. */
  function chipsHtml(n) {
    const estT = n.risk !== "destructive" && !n.ask.stopByYou ? estLine(n) : "";
    return chipsOf(n).map((c) => `<li class="chip${c.tone ? ` t-${c.tone}` : ""}">${esc(c.text)}${c.count > 1 ? `<b>${c.count}</b>` : ""}</li>`).join("") +
      (estT ? `<li class="chip is-est" title="${n.t.live ? "From its checklist: the steps not done yet." : "An estimate: the steps left that wait on this answer × a typical step time."}">${ICON.hourglass}${esc(estT)}</li>` : "");
  }

  /** surface: "panel" | "dock" */
  function cardHtml(n, surface = "panel") {
    const id = ++cardN;
    const a = n.ask, t = n.t, it = a.item, kind = kindOf(n);
    const openEv = !!F.open0[n.key]?.ev && surface === "panel";
    const scope = teach.get(n.key);
    const refused = !!(it && kind === "secret" && noSecret.has(it.id));
    const acts = actsOf(n, { canResolve: !!world.act.resolve, refused });

    let act = "";
    if (refused) {
      // XO refused to carry a secret to this question (secret_needs_a_call): it can't be answered here
      act += `<p class="c-iwhy">${ICON.lock}<span>XO can't pass a secret to this question. Don't paste it into the thread: XO keeps what's written there. Give it to the agent outside XO (for example in its environment), then tell the thread it's done; your reply replaces this question.</span></p>` + rowHtml(acts, n);
    } else if (it && KINDS[kind].acts === "answer") {
      act += questionHtml(n, id, acts);
    } else {
      if (!it && Array.isArray(a.options) && a.options.length && KINDS[kind].acts === "answer") {
        const ev = evidenceFor(n);
        act += `<div class="c-opts n${Math.min(a.options.length, 3)}" role="group" aria-label="Answers">${a.options.map((o, i) => optHtml(o, i, ev)).join("")}</div>`;
      }
      if (it && kind === "create_project" && itemParts(it).primary?.answer === "name") act += `<label class="c-name"><span>Project name</span><input class="c-name-in" data-name value="${esc((it.detail && it.detail.name) || "")}" maxlength="80" autocomplete="off"></label>`;
      act += ruleHtml(n);
      const why = it && itemParts(it).why;
      if (why) act += `<p class="c-iwhy">${ICON.lock}<span>${esc(why)}</span></p>`;
      act += rowHtml(acts, n, scope);
    }
    act += `<div class="c-note" hidden><label for="c-note-${id}" class="c-note-l"></label><textarea id="c-note-${id}" class="c-note-in" rows="2"></textarea>` +
      `<div class="c-note-row"><button type="button" class="b b-sm b-go" data-act="note-send"></button><button type="button" class="b b-sm b-ghost" data-act="note-cancel" title="Cancel (Esc)">Cancel</button></div></div>`;

    const where = t.host
      ? `<button type="button" class="c-where" data-act="thread" title="${t.asker ? (surface === "dock" ? `Its coordinator asks, in this chat` : `Open ${esc(PROJ(t.project))}, where its coordinator asks`) : "Open where it was asked"}">${t.asker ? `${esc(PROJ(t.project))}<span aria-hidden="true">›</span><b>${esc(t.title)}</b>` : esc(t.title)}</button>`
      : `<button type="button" class="c-where" data-act="thread" title="${surface === "dock" ? "Open the thread" : `Open the thread beside this${K.hint("open")}`}">${esc(PROJ(t.project))}<span aria-hidden="true">›</span><b>${esc(t.title)}</b></button>`;

    return `<div class="card-in" data-key="${esc(n.key)}">` +
      `<div class="c-body">` +
      `<div class="c-top">${effTagHtml(n)}${where}</div>` +
      leadHtml(n, `card-${id}`, "h3") +
      `<div class="dis${openEv ? " is-open" : ""}" data-dis="ev"><div class="c-chips"><ul class="chips" aria-label="About this">${chipsHtml(n)}</ul><button type="button" class="dis-h" aria-expanded="${openEv}" aria-controls="dt-${id}" title="Details${K.hint("details")}">${ICON.chevron}<span>Details</span></button></div>` +
      `<div class="dis-b" id="dt-${id}"${openEv ? "" : " hidden"}><div class="dis-in">${it ? itemDetailsHtml(n) : a.live ? waitingDetailsHtml(n) : detailsHtml(n, evidenceFor(n))}</div></div></div>` +
      `</div>` +
      `<div class="c-act">${act}<p class="c-hint" aria-live="polite"></p></div></div>`;
  }

  /** The panel's frame stays; its contents change. how: enter | allow | back | skip-fwd | skip-back | undo */
  async function show(key, how) {
    const n = F.items.get(key);
    if (!n) return;
    F.vig = false;
    const my = ++F.swap;
    // words being typed on this card (a note, an answer) when it goes without the person deciding it (withdrawn,
    // answered elsewhere): the card that takes its place starts with its letter keys paused, or the next letter
    // typed would decide it. Sending a note (Enter, Send back) is deciding: the next card's keys stay on.
    const ae = document.activeElement, cur = $("#card");
    const typing = how !== "allow" && how !== "back" && !!(cur && ae && cur.contains(ae) && ae.matches("textarea, input, [contenteditable]"));
    clearTimeout(F.autoT);
    F.hold && F.hold.cancel();
    let frame = $("#card");
    if (!frame) {
      stage.innerHTML = `<article class="card" id="card" tabindex="-1" aria-roledescription="decision"><div class="stamp stamp-allow" aria-hidden="true">${BIG_CHECK}</div><div class="stamp stamp-back" aria-hidden="true">${BIG_BACK}</div></article>`;
      frame = $("#card");
    }
    const old = frame.querySelector(".card-in");
    F.busy = true;
    if (old && !RM.matches) {
      if (how === "allow" || how === "back") { frame.classList.add(`st-${how}`); await wait(190); }
      old.classList.add(`out-${how}`);
      await wait(how === "allow" || how === "back" ? 150 : 120);
      frame.classList.remove("st-allow", "st-back");
    }
    if (my !== F.swap) return;
    const fresh = needItems().find((x) => x.key === key) || n;
    const tpl = document.createElement("template");
    tpl.innerHTML = cardHtml(fresh, "panel").trim();
    const inner = tpl.content.firstElementChild;
    inner.classList.add(`in-${how}`);
    morph(frame, () => {
      old && old.remove();
      frame.className = `card r-${fresh.risk} e-${fresh.effort}`;
      frame.appendChild(inner);
    }, { duration: 300 });
    frame.setAttribute("aria-labelledby", inner.querySelector(".c-h").id);
    const why = inner.querySelector(".c-line");
    if (why) frame.setAttribute("aria-describedby", why.id); else frame.removeAttribute("aria-describedby");
    if (typing) { frame._quiet = true; frame._quietWhy = "The ask you were writing to went away; this is the next one."; }
    wireCard(frame, inner, fresh, { surface: "panel", after: (h) => advance(h) });
    F.busy = false;
    // focus the card itself: never an answer, never the suggestion
    frame.focus({ preventScroll: true });
    chrome();
  }

  function hint(el, text) {
    const h = el.querySelector(".c-hint");
    h.textContent = text;
    h.classList.remove("show"); void h.offsetWidth; h.classList.add("show");
  }

  /** Details: a continuous height change with a cross-fade (expand()). */
  function toggleDis(inner, which, n, onStep) {
    const d = inner.querySelector(`[data-dis="${which}"]`);
    if (!d) return;
    const on = !d.classList.contains("is-open");
    d.querySelector(".dis-h").setAttribute("aria-expanded", String(on));
    const dock = d.closest(".card.is-dock");
    expand(d, d.querySelector(".dis-b"), on, { onStep, frame: dock || null });
    if (which === "ev") F.open0[n.key] = { ...(F.open0[n.key] || {}), ev: on };
    if (on && !d.closest(".is-dock")) setTimeout(() => d.scrollIntoView({ block: "nearest", behavior: RM.matches ? "auto" : "smooth" }), 340);
  }

  /** Wire one card. ctx.after(how) runs after a decision (panel: advance; dock: settle). */
  function wireCard(frame, el, n, ctx) {
    const q = (s) => el.querySelector(s);
    const note = q(".c-note"), noteIn = q(".c-note-in");
    const shownAt = performance.now();
    const ready = () => performance.now() - shownAt >= Kit.READ_MS;
    const secs = () => Math.max(2, Math.round((performance.now() - shownAt) / 1000));
    // decide, then move on: only when a decision was queued (a repeat press or a refused choice stays put)
    // the thread's own card says what it did, with its own Undo, in place: no second box (the toast) for it
    // every decision this card makes goes through here, so the 300 ms re-arm covers them all: Allow, a stopped
    // card's Try again, Done, an option or an answer, Send back now (a hold takes 1.2 s, a note is typed)
    const go = (choice, how, note = "") => {
      if (!ready()) { if (n.risk === "notable") hint(el, "A beat to read it first."); return null; }
      const entry = decide(n, choice, note, { secs: secs(), inline: ctx.surface === "dock" }); if (entry) ctx.after(how); return entry;
    };
    let noteMode = null;
    const body = frame;
    const step = ctx.onStep || null;
    const openNote = (mode) => {
      noteMode = mode;
      q(".c-note-l").textContent = mode === "reply" ? (n.group === "stopped" ? "What should it try?" : "Your answer, in your words") : "What should it do instead? (optional)";
      const no = n.ask.item ? itemParts(n.ask.item).back : null;
      q('[data-act="note-send"]').innerHTML = mode === "reply" ? "Send" : `${ICON.rewind}${esc((no && no.label) || "Send back")}`;
      noteIn.placeholder = mode === "reply" ? (n.group === "stopped" ? "e.g. use the read replica for this step" : "Type your answer") : "e.g. what it should try instead";
      // a try that failed to send keeps its words for this one (Astra DEC-NOTE-LOSS/S167)
      if (!noteIn.value) noteIn.value = failedWords(n.key, mode);
      morph(body, () => { note.hidden = false; el.classList.add("noting"); }, { duration: 280, fade: note });
      if (step) step();
      noteIn.focus({ preventScroll: true });
    };
    const closeNote = () => { morph(body, () => { note.hidden = true; noteMode = null; el.classList.remove("noting"); }, { duration: 260 }); frame.focus({ preventScroll: true }); };
    const sendNote = () => {
      const v = noteIn.value.trim();
      if (noteMode === "reply") { if (!v) { noteIn.focus(); return; } go({ text: v }, "allow"); }
      else { go("deny", "back", v); }
    };
    noteIn.addEventListener("keydown", (e) => {
      // a word being composed (an IME) owns its keys: its Enter finishes the word (never sends: some browsers
      // only say keyCode 229), its Escape cancels it (never closes the note) (Astra SRC-MAIN-IME-1)
      if (e.isComposing || e.keyCode === 229) return;
      if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.stopPropagation(); sendNote(); }
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); closeNote(); }
    });
    frame._openNote = openNote; frame._closeNote = closeNote; frame._noting = () => !note.hidden;

    const tryAllow = () => {
      if (n.risk === "destructive") { hint(el, "Destructive asks are never one key: press and hold the button."); return; }
      if (n.group === "stopped") { go({ text: "Please try again from the failing step." }, "allow"); return; }
      if (n.ask.item) {
        if (n.ask.item.kind === "question") { hint(el, "Pick an answer, or answer in words."); return; }
        if (itemParts(n.ask.item).hold) { hint(el, "This one needs a press and hold."); return; }
        el.querySelector('[data-act="allow"]')?.classList.add("pressed");
        const nameIn = el.querySelector("[data-name]");
        go(nameIn ? { name: nameIn.value } : "allow", "allow");
        return;
      }
      if (!Kit.isBinary(n.ask)) { hint(el, "Pick an answer, reply in words, or send it back."); return; }
      el.querySelector('[data-act="allow"]')?.classList.add("pressed");
      go("allow", "allow");
    };
    frame._allow = tryAllow;
    frame._hint = (text) => hint(el, text);
    // a pause carries over to the card that takes this one's place: words still being typed must never land on
    // it as keys (an item withdrawn or decided elsewhere mid-sentence); the new card says why its keys are paused
    const carried = !!frame._quiet;
    frame._quiet = false;
    // the card's letter keys paused (see cardKeys): the reason stays on the card until they are back
    frame._quietOn = (text) => {
      frame._quiet = true;
      const h = el.querySelector(".c-hint");
      h.textContent = `${text} Its keys are paused while you type: press Esc or click the card to use them again.`;
      h.classList.remove("show"); h.classList.add("stay");
    };
    frame._quietOff = () => {
      if (!frame._quiet) return false;
      frame._quiet = false;
      const h = el.querySelector(".c-hint");
      h.classList.remove("stay"); h.textContent = "";
      return true;
    };
    if (!frame._quietWired) {
      // once per frame (it outlives its cards): each call reaches the current card's _quietOff
      frame._quietWired = true;
      frame.addEventListener("pointerdown", () => frame._quietOff && frame._quietOff());
      frame.addEventListener("focusout", (e) => { if (!frame.contains(e.relatedTarget) && frame._quietOff) frame._quietOff(); });
    }
    if (carried) frame._quietOn(frame._quietWhy || "A new ask took this one's place.");
    frame._quietWhy = null;
    frame._n = n;

    const qform = el.querySelector("[data-qform]");
    /** The form's answers as a choice, or null (and, unless quiet, says what's missing). */
    const formChoice = (quiet = false) => {
      const qs = questionsOf(n.ask.item);
      const answers = {};
      for (const q of qs) {
        const ins = [...qform.querySelectorAll(`[data-qid="${CSS.escape(q.id)}"]`)];
        let v;
        if (q.options.length && !q.secret) { const on = ins.filter((x) => x.checked).map((x) => x.value); v = q.multi ? on : on[0]; }
        else v = (ins[0] && ins[0].value.trim()) || "";
        if (!v || (Array.isArray(v) && !v.length)) { if (!quiet) { hint(el, "Answer every question first."); (ins[0] || qform).focus(); } return null; }
        answers[q.id] = v;
      }
      return qs.length === 1 && !qs[0].multi && !qs[0].secret && !qs[0].options.length ? { text: answers[qs[0].id] } : qs.length === 1 && !qs[0].multi && !qs[0].secret ? { option: answers[qs[0].id] } : { answers };
    };
    if (qform) qform.addEventListener("submit", (e) => {
      e.preventDefault();
      if (qform.querySelector('[data-act="hold"]')) { hint(el, "This one needs a press and hold."); return; }
      const c = formChoice();
      if (c) go(c, "allow");
    });
    el.addEventListener("click", (e) => {
      const io = e.target.closest("[data-iopt]");
      if (io) { io.classList.add("pressed"); go({ option: questionsOf(n.ask.item)[0].options[+io.dataset.iopt].label }, "allow"); return; }
      const isc = e.target.closest("[data-iscope]");
      if (isc) { teach.set(n.key, isc.dataset.iscope); paintItemScope(); return; }
      const b = e.target.closest("[data-act],[data-opt],[data-scope],.dis-h");
      if (!b) return;
      if (b.classList.contains("dis-h")) { toggleDis(el, b.closest("[data-dis]").dataset.dis, n, step); return; }
      if (b.dataset.opt != null) { b.classList.add("pressed"); go({ option: n.ask.options[+b.dataset.opt] }, "allow"); return; }
      if (b.dataset.scope) { teach.set(n.key, b.dataset.scope); paintTeach(); return; }
      const act = b.dataset.act;
      if (act === "allow") tryAllow();
      else if (act === "back") openNote("back");
      else if (act === "back-now") { go("deny", "back"); }
      else if (act === "reply" || act === "note-reply") openNote("reply");
      else if (act === "note-send") sendNote();
      else if (act === "note-cancel") closeNote();
      else if (act === "retry") { go({ text: "Please try again from the failing step." }, "allow"); }
      else if (act === "thread") onOpenThread && onOpenThread(n.t.id, ctx.surface);
      else if (act === "done") { b.classList.add("pressed"); go({ resolve: true }, "allow"); }
      else if (act === "teach") toggleTeach();
      else if (act === "later") { if (ctx.surface === "panel") setLater(); else { laterNow(n.key); ctx.after("later"); } }
    });

    const paintTeach = () => {
      const tog = q('[data-act="teach"]');
      if (!tog) return;
      const scope = teach.get(n.key);
      tog.setAttribute("aria-pressed", String(!!scope));
      const tb = q(".teach-body");
      if (tb.hidden === !!scope) expand(tb, tb, !!scope, { onStep: step, frame: frame.classList.contains("is-dock") ? frame : null });
      const cmd = commandOf(n.ask);
      for (const r of el.querySelectorAll("[data-scope]")) r.setAttribute("aria-checked", String(r.dataset.scope === (scope || "exact")));
      q(".teach-q q").textContent = Kit.teachSentence(PROJ(n.t.project), scope === "prefix" ? Kit.prefixOf(cmd) : cmd);
      const al = q('[data-act="allow"] .al-t');
      if (al) al.textContent = scope ? "Allow + rule" : "Allow";
    };
    // a storm item's scopes: this thread, or a rule in the server's own words
    const paintItemScope = () => {
      const P = itemParts(n.ask.item);
      const id = teach.get(n.key);
      const tog = q('[data-act="teach"]');
      if (tog) tog.setAttribute("aria-pressed", String(!!id));
      const tb = q(".teach-body");
      if (tb && tb.hidden === !!id) expand(tb, tb, !!id, { onStep: step, frame: frame.classList.contains("is-dock") ? frame : null });
      const cur = P.scopes.find((o) => o.id === id) || P.scopes[0];
      for (const r of el.querySelectorAll("[data-iscope]")) r.setAttribute("aria-checked", String(r.dataset.iscope === (id || cur.id)));
      const qq = q(".teach-q");
      if (qq && cur) { qq.querySelector("span").textContent = cur.scope === "rule" ? "Added to your rules, word for word:" : "For this thread only:"; qq.querySelector("q").textContent = cur.sentence || cur.label; }
      const al = q('[data-act="allow"] .al-t');
      if (al) al.textContent = scopeWords(P, id);
    };
    const toggleTeach = () => {
      if (!q('[data-act="teach"]')) return;
      if (n.ask.item) { const P = itemParts(n.ask.item); if (teach.get(n.key)) teach.delete(n.key); else teach.set(n.key, (P.scopes[0] || {}).id); paintItemScope(); return; }
      if (teach.get(n.key)) teach.delete(n.key); else teach.set(n.key, "exact"); paintTeach();
    };
    frame._teach = toggleTeach;
    frame._dis = (which) => toggleDis(el, which, n, step);

    const hold = q('[data-act="hold"]');
    let holder = null;
    if (hold) {
      holder = Kit.holdButton(hold, {
        ready: () => (!ready() ? "Read it first: the hold starts after a moment." : qform && !formChoice(true) ? "Answer every question first." : true),
        onConfirm: () => {
          hold.classList.add("locked");
          hold.querySelector(".hold-txt").textContent = n.ask.item ? (VERB[(itemParts(n.ask.item).primary || {}).decision] || "Done") : "Allowed";
          sound.play("lock");
          const nameIn = el.querySelector("[data-name]");
          const c = qform ? formChoice() : nameIn ? { name: nameIn.value } : "allow";
          setTimeout(() => { if (c) go(c, "allow"); }, RM.matches ? 0 : 220);
        },
        onRefuse: (why) => { hint(el, why); hold.classList.remove("nope"); void hold.offsetWidth; hold.classList.add("nope"); },
        onRelease: () => hint(el, "Released early. Nothing was sent."),
      });
    }
    if (ctx.surface === "panel") F.hold = holder;
    frame._hold = holder;
  }

  // ── the vigilance cap: a break at a natural pause, the queue held ────────
  async function vigilance(how) {
    F.vig = true;
    const frame = $("#card");
    const old = frame && frame.querySelector(".card-in");
    if (old && !RM.matches) {
      frame.classList.add(`st-${how}`); await wait(190);
      old.classList.add(`out-${how}`); await wait(150);
      frame.classList.remove("st-allow", "st-back");
    }
    const left = F.order.filter(pending).length;
    const m = Math.round(P.reviewMin());
    const inner = document.createElement("div");
    inner.className = "card-in in-enter vig";
    inner.innerHTML = `<div class="c-body"><div class="vig-ic">${ICON.pause}</div>` +
      `<h3 class="c-h" id="vig-h">${m} minutes of deciding.</h3>` +
      `<p class="c-line">Attention dips after about 25. ${left} left, nothing urgent; they'll hold.</p></div>` +
      `<div class="c-act"><div class="c-btns"><button type="button" class="b b-back" data-vig="rest"><span class="b-l">${ICON.pause}Take a break</span></button><button type="button" class="b b-back" data-vig="go"><span class="b-l">Keep going</span></button></div></div>`;
    morph(frame, () => { old && old.remove(); frame.className = "card r-vig"; frame.appendChild(inner); }, { duration: 280 });
    frame.setAttribute("aria-labelledby", "vig-h");
    frame.focus({ preventScroll: true });
    announce(`${m} minutes of deciding. A break is a good idea; the rest will hold.`);
    inner.addEventListener("click", (e) => {
      const b = e.target.closest("[data-vig]");
      if (!b) return;
      if (b.dataset.vig === "go") { P.keepGoing(); show(F.cur, "enter"); }
      else { P.rested(); close(); onBreak && onBreak(left); }
    });
    chrome();
  }

  // ── that's everything ─────────────────────────────────────────────────────
  async function finish(how) {
    F.done = true;
    const my = ++F.swap;
    const frame = $("#card");
    const old = frame && frame.querySelector(".card-in");
    if (old && !RM.matches) {
      if (how === "allow" || how === "back") { frame.classList.add(`st-${how}`); await wait(190); }
      old.classList.add(`out-${how}`);
      await wait(150);
      frame.classList.remove("st-allow", "st-back");
    }
    if (my !== F.swap || !frame) return;
    const runLog = log.filter((d) => F.order.includes(d.key));
    const c = (k) => runLog.filter((d) => d.choice === k).length;
    const laterN = F.order.filter((k) => F.status.get(k) === "later").length;
    const skipped = F.order.filter((k) => !F.status.has(k)).length;
    const freed = 0;
    const parts = [c("allow") && `${c("allow")} allowed`, c("answer") && `${c("answer")} answered`, c("deny") && `${c("deny")} sent back`, laterN && `${laterN} for later`].filter(Boolean);
    const inner = document.createElement("div");
    inner.className = "card-in in-enter done";
    inner.setAttribute("role", "status");
    inner.innerHTML = `<div class="done-ring">${BIG_CHECK}</div><h3>${F.mode === "glance" ? "Glances cleared." : "That's everything."}</h3><p>${parts.join(" · ") || "Nothing decided"}${skipped ? ` · ${skipped} still waiting` : ""}</p>` +
      "";
    morph(frame, () => { old && old.remove(); frame.className = "card r-done"; frame.appendChild(inner); }, { duration: 300 });
    frame.focus({ preventScroll: true });
    chrome();
    sound.play("done");
    announce(`${F.mode === "glance" ? "Glances cleared" : "That's everything"}. ${parts.join(", ")}.`);
    onAllClear && onAllClear(parts.join(" · "), freed);
    F.autoT = setTimeout(() => { if (F.open && F.done) close(); }, RM.matches ? 1400 : 2000);
  }

  // ── rail, count, footer ───────────────────────────────────────────────────
  function chrome() {
    const rail = $("#pn-rail");
    let html = "", apart = null;
    F.order.forEach((k) => {
      const n = F.items.get(k);
      const d = n && n.risk === "destructive";
      if (apart !== null && apart !== d) html += `<i class="rail-gap"></i>`;
      apart = d;
      const st = F.status.get(k);
      html += `<i class="rs r-${n ? n.risk : "notable"}${k === F.cur && !F.done && !F.vig ? " is-cur" : ""}${st ? " s-" + st : ""}"></i>`;
    });
    rail.innerHTML = html;
    const i = F.order.indexOf(F.cur) + 1, total = F.order.length;
    const left = F.order.filter(pending).length;
    $("#pn-count").innerHTML = F.done ? `All ${total} seen` : F.vig ? `${left} held` : `<b>${i}</b> of ${total}`;
    const routine = F.order.filter(pending).map((k) => F.items.get(k)).filter((n) => n && n.group === "routine" && Kit.isBinary(n.ask));
    const foot = $("#pn-foot");
    // in place: Previous, Allow all and Skip stay the same nodes as asks come and go, so a press on one still clicks
    redraw(foot, F.done || F.vig ? "" :
      `<button type="button" class="pn-nav" data-nav="-1" title="Previous${K.hint("prev")}" aria-label="Previous ask"${total < 2 ? " disabled" : ""}>${ICON.back}</button>` +
      (routine.length >= 2 ? `<button type="button" class="pn-all" data-all>Allow all ${routine.length} routine</button>` : `<span class="pn-tip">Skip freely; nothing here is forced first.</span>`) +
      `<button type="button" class="pn-nav" data-nav="1" title="Skip ahead${K.hint("next")}" aria-label="Skip to the next ask"${total < 2 ? " disabled" : ""}>${ICON.right}</button>`);
    render();
  }

  function skip(dir) {
    if (F.busy || F.done || F.vig) return;
    const nx = nextPending(F.cur, dir);
    if (!nx) return;
    // moving on is the person's own act: the next card's keys are on (a pause carries over only when an
    // item leaves under them)
    const fr = $("#card");
    if (fr && fr._quietOff) fr._quietOff();
    F.cur = nx; show(nx, dir > 0 ? "skip-fwd" : "skip-back");
  }

  function confirmAll() {
    const batch = F.order.filter(pending).map((k) => F.items.get(k)).filter((n) => n && n.group === "routine" && Kit.isBinary(n.ask));
    if (!batch.length || F.done || stage.querySelector(".confirm")) return;
    const el = document.createElement("div");
    el.className = "confirm";
    el.setAttribute("role", "alertdialog");
    el.setAttribute("aria-labelledby", "cf-h");
    el.innerHTML = `<h3 id="cf-h" tabindex="-1">Allow all ${batch.length} routine asks?</h3><p>Read-only or reversible. Never includes notable or destructive asks.</p>` +
      `<ul>${batch.map((n) => `<li><span class="cf-p">${esc(PROJ(n.t.project))}</span><code>${esc(commandOf(n.ask) || n.ask.title)}</code></li>`).join("")}</ul>` +
      `<div class="c-btns"><button type="button" class="b b-allow" data-cf="yes"><span class="b-l">${ICON.check}Allow ${batch.length}</span></button><button type="button" class="b b-back" data-cf="no" title="Cancel (Esc)"><span class="b-l">Cancel</span></button></div>`;
    stage.appendChild(el);
    el.querySelector("h3").focus();
    el.addEventListener("click", (e) => {
      const b = e.target.closest("[data-cf]");
      if (!b) return;
      el.remove();
      if (b.dataset.cf === "yes") allowAllRoutine(batch.map((n) => n.key)); else $("#card")?.focus();
    });
  }

  $("#pn-foot").addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) skip(+nav.dataset.nav);
    if (e.target.closest("[data-all]")) confirmAll();
  });
  $("#pn-x").addEventListener("click", () => close());

  // ── undo toast ────────────────────────────────────────────────────────────
  const toast = $("#toast");
  let toastItem = null;
  function toastRender() {
    const it = [...queue.queued].reverse().find((x) => !x.meta.inline);
    if (!it) {
      if (toastItem) { toast.classList.add("bye"); setTimeout(() => { if (!queue.queued.length) { toast.hidden = true; toast.classList.remove("bye"); } }, 200); }
      toastItem = null;
      return;
    }
    if (toastItem === it) return;
    toastItem = it;
    const deny = !!it.meta.deny;
    const left = Math.max(0, it.due - Date.now());
    toast.className = `toast t-${deny ? "back" : "allow"}`;
    toast.hidden = false;
    toast.innerHTML = `<span class="t-ic">${deny ? ICON.rewind : ICON.check}</span><span class="t-m"><b>${esc(it.meta.verb)}</b> <span>${esc(it.meta.label)}</span></span>` +
      `<button type="button" class="t-undo" title="Undo">${xi("undo-countdown", "t-ring").replace("<path ", `<path pathLength="1" style="animation-duration:${left}ms" `)}Undo</button>`;
    toast.querySelector(".t-undo").addEventListener("click", () => queue.undo(it.id));
  }

  // ── keys on a card (panel or dock) ────────────────────────────────────────
  function cardKeys(e, card, { onEsc, inPanel }) {
    if (e.isComposing || e.keyCode === 229) return false; // a word being composed owns every key, Escape too
    const inField = e.target.matches?.("textarea, input");
    if (e.key === "Escape") {
      if (card && card._quietOff && card._quietOff()) { e.preventDefault(); e.stopPropagation(); return true; }
      if (card && card._noting && card._noting()) { e.preventDefault(); e.stopPropagation(); card._closeNote(); return true; }
      if (onEsc) { e.preventDefault(); e.stopPropagation(); onEsc(); return true; }
      return false;
    }
    if (inField || e.metaKey || e.ctrlKey || e.altKey) return false;
    if (e.target.closest?.(".b-hold") && (e.key === "Enter" || e.key === " ")) return false;
    // a key held down repeats: a repeat never decides anything (holding A must not approve card after card)
    if (e.repeat && card && card._n) { e.preventDefault(); e.stopPropagation(); return true; }
    const n = card && card._n;
    if (!n) return false;
    const k = e.key;
    const own = () => { e.preventDefault(); e.stopPropagation(); };
    // after a refused key (someone starting to type where no text box opened), the card's letter keys
    // stay off until a deliberate reset (Esc, a click on the card, or leaving it), so typed words can
    // never land as a decision, however long the pause between them
    if (card._quiet && k.length === 1) { own(); return true; }
    const refuse = (text) => card._quietOn(text);
    const it = n.ask.item;
    if (K.is(e, "allow")) { own(); card._allow(); }
    else if (K.is(e, "back")) {
      own();
      // a storm item says "no" only through its own "no" option (Deny, Send back, Can't, Wait…)
      if (it) { const b = card.querySelector('[data-act="back"], [data-act="back-now"]'); if (b) b.click(); else refuse("This one has no way to say no."); }
      else if (n.group === "stopped" || n.ask.replyOnly) card._openNote("reply"); else card._openNote("back");
    }
    else if (K.is(e, "reply")) {
      // words answer only a question; anything else is answered with its buttons
      if (it ? it.kind === "question" && card.querySelector('[data-act="reply"]') : !Kit.isBinary(n.ask)) { own(); card._openNote("reply"); }
      else if (it) { own(); const P = itemParts(it); refuse(`This one is answered with its buttons${P.primary ? `: ${[P.primary.label, P.back && P.back.label].filter(Boolean).join(" or ")}` : ""}.`); }
    }
    else if (K.is(e, "done")) {
      own();
      const b = card.querySelector('[data-act="done"]');
      if (b) b.click(); else refuse("Done is for a thread that replied and waits; this one is answered with its buttons.");
    }
    else if (K.is(e, "details")) { own(); card._dis("ev"); }
    else if (K.is(e, "rule")) { own(); card._teach(); }
    else if (K.is(e, "undo")) { own(); undo(); }
    else if (inPanel && K.is(e, "open")) { own(); onOpenThread && onOpenThread(n.t.id, "panel"); }
    else if (/^[1-9]$/.test(k) && it && it.kind === "question") {
      // a storm question: the k-th answer as shown, or (in a form) the k-th choice of a lone question; never the recommended one
      const b = card.querySelector(`button[data-pick="${k}"]`);
      const r = !b ? card.querySelector(`[data-qform] input[data-pick="${k}"]`) : null;
      if (b) { own(); b.click(); } else if (r) { own(); r.checked = r.type === "checkbox" ? !r.checked : true; r.focus(); } else return false;
    }
    else if (/^[1-9]$/.test(k) && Array.isArray(n.ask.options) && !Kit.isBinary(n.ask)) {
      const o = n.ask.options[+k - 1];
      if (o != null) { own(); card.querySelector(`[data-opt="${+k - 1}"]`)?.click(); }
    } else return false;
    return true;
  }
  api.cardKeys = cardKeys;

  radioKeys(panel);
  panel.addEventListener("keydown", (e) => {
    if (!F.open || e.isComposing || e.keyCode === 229) return; // a composing word's keys close nothing
    const card = $("#card");
    if (e.key === "Escape") {
      const cf = stage.querySelector(".confirm");
      if (cf) { e.preventDefault(); e.stopPropagation(); cf.remove(); card?.focus(); return; }
      if (cardKeys(e, card, {})) return;
      e.preventDefault(); e.stopPropagation(); close(); return;
    }
    if (e.target.matches?.("textarea, input") || e.metaKey || e.ctrlKey || e.altKey) return;
    if (F.done || F.busy || F.vig || stage.querySelector(".confirm")) return;
    // inside a choice of options (a rule's scope), the arrows move between its options (radioKeys), not to the
    // next ask (Astra: ArrowRight on the scope went to the next ask)
    if (/^Arrow/.test(e.key) && e.target.closest?.('[role="radiogroup"]')) return;
    const n = F.items.get(F.cur);
    if (!card || !n) return;
    const k = e.key;
    const own = () => { e.preventDefault(); e.stopPropagation(); };
    if (card._quiet && k.length === 1) { own(); return; }
    if (K.is(e, "allowAll")) { own(); confirmAll(); return; }
    if (K.is(e, "later") && n.effort === "think") { own(); setLater(); return; }
    if (K.is(e, "next") || k === "ArrowRight") { own(); skip(1); return; }
    if (K.is(e, "prev") || k === "ArrowLeft") { own(); skip(-1); return; }
    cardKeys(e, card, { inPanel: true });
  });

  return api;
}
