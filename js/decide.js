import * as Kit from "../modules/decisions/kit.js";
import { createDecisionQueue } from "../modules/decisions/queue.js";
import { createNeedItems } from "../modules/decisions/needs.js";
import { rank } from "../modules/decisions/rank.js";
import { $, RM, sound } from "./ui.js";
import { usable, hookOf } from "./focusview.js";
import { itemParts, itemBody, isNo, VERB } from "../core/services/review.js";
import { clientId as newKey } from "../core/platform/http.js";
import { commandOf } from "../modules/decisions/cardparts.js";
import { wireDecisionKeyboard } from "../modules/decisions/keyboard.js";
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
  const F = { open: false, parked: false, order: [], items: new Map(), status: new Map(), cur: null, done: false, hold: null, mode: "all", returnTo: null, swap: 0, open0: {}, vig: false };

  const queue = createDecisionQueue({ world, F, log, sentKeys, stoppedDone, noSecret, show: (key, how) => show(key, how), toastRender: () => toastRender(), announce, render, onUndone, onSent, onNotSent });
  const needItems = createNeedItems({ world, P, later, waitSince, stoppedDone, sentKeys, queue });

  // ── panel state ───────────────────────────────────────────────────────────
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

  api.cardKeys = wireDecisionKeyboard({ panel, stage, F, undo, onOpenThread, close, confirmAll, setLater, skip });
  return api;
}
