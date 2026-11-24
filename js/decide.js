import * as Kit from "../modules/decisions/kit.js";
import { createNeedItems } from "../modules/decisions/needs.js";
import * as K from "../core/platform/keys.js";
import { rank } from "../modules/decisions/rank.js";
import { $, RM, sound } from "./ui.js";
import { usable, hookOf } from "./focusview.js";
import { itemParts, itemBody, isNo, VERB } from "../core/services/review.js";
import { clientId as newKey } from "../core/platform/http.js";
import { commandOf } from "../modules/decisions/cardparts.js";
import { radioKeys } from "./keynav.js";
import { createDecisionCard } from "../modules/decisions/card.js";
import { createDecisionToast } from "../modules/decisions/toast.js";
import { createCardEvents } from "../modules/decisions/card-events.js";
import { createDecisionPanelView } from "../modules/decisions/panel-view.js";

export { riskLabel } from "../modules/decisions/needs.js";
export function createDecisions({ world, P, PROJ, announce, render, back, later, waitSince, onOpenThread, onAllClear, onUndone, onBreak, onSent, onNotSent, onShown, onGone }) {
  const panel = $("#panel"), stage = $("#pn-stage");
  const sentKeys = new Map();
  const stoppedDone = new Set();
  const log = [];
  const teach = new Map();
  const noSecret = new Set(); // items XO wouldn't carry a secret answer to (secret_needs_a_call)
  let logN = 0;

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

  const needItems = createNeedItems({ world, P, later, waitSince, stoppedDone, sentKeys, queue });

  // ── panel state ───────────────────────────────────────────────────────────
  const F = { open: false, parked: false, order: [], items: new Map(), status: new Map(), cur: null, done: false, hold: null, mode: "all", returnTo: null, swap: 0, open0: {}, vig: false };
  const { cardHtml, effTagHtml, leadHtml, chipsHtml } = createDecisionCard({ world, PROJ, F, teach, noSecret });
  /** The words of the newest try on this ask that failed to send, kept for the next try: a Send back's note, or
   *  (mode "reply") an answer you typed; "" once something newer happened to it. */
  function failedWords(key, mode = "back") {
    const e = log.find((d) => d.key === key);
    if (!e || e.status !== "failed") return "";
    return mode === "reply" ? (e.typed ? e.said || "" : "") : e.note || "";
  }
  const wireCard = createCardEvents({ F, PROJ, teach, decide, failedWords, onOpenThread, setLater, laterNow });
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
  const { show, vigilance, finish, chrome, confirmAll } = createDecisionPanelView({ F, P, PROJ, stage, needItems, cardHtml, wireCard, pending, log, announce, render, onBreak, onAllClear, advance, close, allowAllRoutine });
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

  $("#pn-foot").addEventListener("click", (e) => {
    const nav = e.target.closest("[data-nav]");
    if (nav) skip(+nav.dataset.nav);
    if (e.target.closest("[data-all]")) confirmAll();
  });
  $("#pn-x").addEventListener("click", () => close());

  const toastRender = createDecisionToast(queue);

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
