// @ts-check
import { cardState } from "./card-state.js";

import * as Kit from "./kit.js";
import { createDecisionQueue } from "./queue.js";
import { createNeedItems } from "./needs.js";
import { rank } from "./rank.js";
import { requireHtml, findHtml } from "../../core/platform/dom.js";
import { RM } from "../../core/ui/motion.js";
import { usable, hookOf } from "../../core/ui/a11y/focus.js";
import { itemParts, itemBody, isNo, VERB } from "../../core/services/review.js";
import { clientId as newKey } from "../../core/platform/http.js";
import { commandOf } from "./cardparts.js";
import { wireDecisionKeyboard } from "./keyboard.js";
import { createDecisionCard } from "./card.js";
import { createDecisionToast } from "./toast.js";
import { createCardEvents } from "./card-events.js";
import { createDecisionPanelView } from "./panel-view.js";

/** @import { DecisionControllerDeps, DecisionPanelState, DecisionNeed, DecisionApi, OpenOptions, Transition, DecisionEntry, DecisionItem, CardChoice, DecideOptions, NoteMode, ScopeOption } from "./controller-types.d.ts" */

/** @param {DecisionControllerDeps} options */
export function createDecisions({ world, P, PROJ, announce, render, back, waitSince, onOpenThread, onAllClear, onUndone, onBreak, onSent, onNotSent, onShown, onGone }) {
  const panel = requireHtml("#panel"), stage = requireHtml("#pn-stage");
  const sentKeys = new Map();
  const stoppedDone = new Set();
  const later = new Set();
  /** @type {DecisionEntry[]} */
  const log = [];
  const teach = new Map();
  const noSecret = new Set();
  let logN = 0;
  /** @type {DecisionPanelState} */
  const F = { open: false, parked: false, order: [], items: new Map(), status: new Map(), cur: null, done: false, hold: null, mode: "all", returnTo: null, swap: 0, open0: {}, vig: false };

  const queue = createDecisionQueue({ world, F, log, sentKeys, stoppedDone, noSecret, show: (key, how) => show(key, how), toastRender: () => toastRender(), announce, render, onUndone, onSent, onNotSent });
  const needItems = /** @type {() => DecisionNeed[]} */ (createNeedItems({ world, P, later, waitSince, stoppedDone, sentKeys, queue }));

  const { cardHtml, cardTitle, effTagHtml, leadHtml, chipsHtml } = createDecisionCard({ world, PROJ, F, teach, noSecret });
  /** @param {string} key @param {NoteMode} [mode] */
  function failedWords(key, mode = "back") {
    const e = log.find((d) => d.key === key);
    if (!e || e.status !== "failed") return "";
    return mode === "reply" ? (e.typed ? (/** @type {string} */ (e.said)) || "" : "") : e.note || "";
  }
  const wireCard = createCardEvents({ timeout: queue.timeout, F, PROJ, teach, decide, failedWords, onOpenThread, setLater, laterNow });

  /** @param {string | null} [startKey] @param {OpenOptions} [options] */
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
    requireHtml("#pn-h").textContent = F.mode === "glance" ? "Quick glances" : F.mode === "set" ? "Before you go" : "Needs you";
    show(F.cur, was ? "skip-fwd" : "enter");
    announce(`${requireHtml("#pn-h").textContent}: ${F.order.length}.`);
    render();
    onShown && onShown();
    return true;
  }
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
    (findHtml("#card", undefined, stage) || findHtml("#pn-h"))?.focus({ preventScroll: true });
  }

  function close({ restore = true } = {}) {
    if (!F.open) return;
    F.hold && F.hold.cancel();
    F.cancelAutoClose?.();
    const was = !F.parked;
    F.open = false; F.parked = false;
    P.reviewStop();
    panel.classList.remove("is-in");
    panel.classList.add("is-out");
    document.body.classList.remove("panel-open");
    queue.timeout(() => { if (!F.open) { panel.hidden = true; panel.classList.remove("is-out"); stage.innerHTML = ""; } }, RM.matches ? 0 : 240);
    const r = F.returnTo;
    F.returnTo = null;
    if (restore && was) { if (usable(r)) (/** @type {HTMLElement} */ (r)).focus({ preventScroll: true }); else back && back(/** @type {string[]} */ ([hookOf(r)].filter(Boolean))); }
    toastRender();
    render();
    onGone && onGone();
  }

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
        const order = rank(F.order.map((k) => F.items.get(k)).filter((item) => item !== undefined).concat(n)).map((x) => x.key);
        const at = Math.max(order.indexOf(n.key), F.cur === null ? 0 : F.order.indexOf(F.cur) + 1);
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

  /** @param {string | null} k */
  const pending = (k) => !F.status.has(/** @type {string} */ (k));
  const { show, vigilance, finish, chrome, confirmAll } = createDecisionPanelView({
    F, lifetime: queue, P, PROJ, stage, needItems, cardHtml, wireCard, pending, log, announce, render,
    onBreak, onAllClear, advance, close, allowAllRoutine,
  });
  /** @param {string | null} from */
  function nextPending(from, dir = 1) {
    const n = F.order.length, i0 = F.order.indexOf(/** @type {string} */ (from));
    for (let s = 1; s <= n; s++) {
      const k = F.order[(i0 + dir * s + n * 2) % n];
      if (pending(k) && k !== from) return k;
    }
    return null;
  }
  /** @param {Transition} how */
  function advance(how) {
    const nx = nextPending(F.cur, how === "skip-back" ? -1 : 1);
    if (!nx) { finish(how); return; }
    if (P.tired() && (how === "allow" || how === "back")) { F.cur = nx; vigilance(how); return; }
    F.cur = nx;
    show(nx, how);
  }

  /** @param {DecisionNeed} n @param {CardChoice} choice @param {string} [note] @param {DecideOptions} [options] */
  function decide(n, choice, note = "", { secs = null, inline = false } = {}) {
    note = String(note || "").trim();
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
    const done = !!(choice && (/** @type {{resolve?: boolean}} */ (choice)).resolve);
    const verb = done ? "Done" : choice === "allow" ? "Allowed" : choice === "deny" ? "Sent back" : stopped ? "Asked to retry" : "Answered";
    const said = typeof choice === "object" && !done ? choice.option || choice.text : "";
    /** @type {DecisionEntry} */
    const entry = { id: ++logN, key: n.key, verb, choice: choice === "allow" || choice === "deny" ? choice : "answer", label: n.ask.title, said, typed: !done && typeof choice === "object" && !!choice && choice.text != null, note, taught, project: n.t.project, thread: n.t.title, tid: n.t.id, at: Date.now(), status: "queued", risk: n.risk, lev: n.lev, doneAt: n.t.checklist.done, secs: secs ?? (n.effort === "glance" ? 5 : 40) };
    log.unshift(entry);
    teach.delete(n.key);
    if (F.open) F.status.set(n.key, choice === "deny" ? "back" : "allow");
    queue.push([{ key: n.key, n, t: n.t, ask: n.ask, choice, note, stopped, entry }], { verb, label: done ? n.t.title : said ? `${said}` : n.ask.title, deny: choice === "deny", inline });
    announce(done ? `Done: ${n.t.title} will be resolved. Undo for 3 seconds.` : `${verb}${said ? `: ${said}` : ""}. Undo for 3 seconds.`);
    toastRender();
    render();
    return entry;
  }

  /** @param {DecisionNeed} n @param {CardChoice} choice @param {string} note @param {number | null} secs @param {boolean} inline */
  function decideItem(n, choice, note, secs, inline) {
    const it = /** @type {DecisionItem} */ (n.ask.item);
    const P = itemParts(it);
    if (choice === "allow" && teach.get(n.key)) choice = { scope: P.scopes.find((/** @type {ScopeOption} */ o) => o.id === teach.get(n.key)) };
    let body;
    try { body = itemBody(it, choice, note); } catch (err) { announce((/** @type {Error} */ (err)).message); return null; }
    body.idempotency_key = newKey();
    const no = isNo(body);
    const opt = body.scope === "thread" ? P.scopes.find((/** @type {ScopeOption} */ o) => o.scope === "thread") : body.option ? P.scopes.find((/** @type {ScopeOption} */ o) => o.id === body.option) : null;
    const said = typeof choice === "object" && choice ? (choice.option || choice.text || choice.name || (choice.answers ? "your answers" : "") || (opt ? opt.label : "")) : "";
    const verb = opt ? (opt.scope === "thread" ? "Allowed for this thread" : "Allowed, with a rule") : VERB[body.decision] || "Answered";
    /** @type {DecisionEntry} */
    const entry = { id: ++logN, key: n.key, verb, choice: no ? "deny" : body.decision === "answer" ? "answer" : "allow", label: it.title, said, note, taught: !!opt && opt.scope === "rule", project: n.t.project, thread: n.t.title, tid: n.t.id, at: Date.now(), status: "queued", risk: n.risk, lev: n.lev, doneAt: n.t.checklist.done, secs: secs ?? (n.effort === "glance" ? 5 : 40) };
    log.unshift(entry);
    teach.delete(n.key);
    if (F.open) F.status.set(n.key, no ? "back" : "allow");
    queue.push([{ key: n.key, n, t: n.t, ask: n.ask, choice: { storm: true, body }, note: "", stopped: false, entry }], { verb, label: (Array.isArray(said) ? said.join(", ") : said) || it.title, deny: no, inline });
    announce(`${verb}${said ? `: ${said}` : ""}. Undo for 3 seconds.`);
    toastRender();
    render();
    return entry;
  }

  /** @param {string} key @param {CardChoice} choice @param {string} [note] */
  function decideNow(key, choice, note) {
    const n = needItems().find((x) => x.key === key);
    if (!n) return false;
    if (n.risk === "destructive" && choice === "allow") return false;
    return !!decide(n, choice, note);
  }
  /** @param {string} key */
  function laterNow(key) { later.add(key); announce("Planned for later today. It won't come up as your next move until then."); render(); }
  /** @param {string} key */
  function bringIn(key) { P.bringIn(key); announce("Brought in. It's in today's list now."); render(); }

  /** @param {string[]} keys */
  function allowAllRoutine(keys) {
    const batch = keys.filter(pending).map((k) => F.items.get(k))
      .filter((n) => n !== undefined).filter((n) => n.group === "routine" && Kit.isBinary(n.ask));
    if (!batch.length) return;
    const parts = batch.map(/** @returns {import("./queue-types.d.ts").DecisionPart} */ (n) => {
      /** @type {DecisionEntry} */
      const entry = { id: ++logN, key: n.key, verb: "Allowed", choice: "allow", label: n.ask.title, project: n.t.project, thread: n.t.title, tid: n.t.id, at: Date.now(), status: "queued", risk: n.risk, batch: true, lev: n.lev, doneAt: n.t.checklist.done, secs: 3 };
      log.unshift(entry);
      F.status.set(n.key, "allow");
      return { key: n.key, n, t: n.t, ask: n.ask, choice: "allow", note: "", entry };
    });
    queue.push(parts, { verb: "Allowed", label: `${batch.length} routine asks` });
    announce(`Allowed ${batch.length} routine asks. Undo for 3 seconds.`);
    toastRender(); render();
    if (!pending(F.cur)) advance("allow"); else show(/** @type {string} */ (F.cur), "enter");
  }

  function setLater() {
    const k = /** @type {string} */ (F.cur);
    later.add(k);
    F.status.set(k, "later");
    announce("Planned for later today. Nothing else changes.");
    render();
    advance("skip-fwd");
  }

  function undo() { return !!queue.undo(); }

  /** @param {number} dir */
  function skip(dir) {
    if (F.busy || F.done || F.vig) return;
    const nx = nextPending(F.cur, dir);
    if (!nx) return;
    const fr = findHtml("#card");
    if (fr) cardState(fr).quietOff?.();
    F.cur = nx; show(nx, dir > 0 ? "skip-fwd" : "skip-back");
  }

  requireHtml("#pn-foot").addEventListener("click", (/** @type {MouseEvent} */ e) => {
    const nav = /** @type {(HTMLElement & {dataset: {nav: string}}) | null} */ ((/** @type {Element} */ (e.target)).closest("[data-nav]"));
    if (nav) skip(+nav.dataset.nav);
    if ((/** @type {Element} */ (e.target)).closest("[data-all]")) confirmAll();
  });
  requireHtml("#pn-x", "button").addEventListener("click", () => close());

  const toastRender = createDecisionToast(queue);

  /** @type {DecisionApi} */
  const api = {
    needItems,
    decisions: () => log.filter((d) => d.status !== "failed" && d.status !== "gone"),
    notSent: () => log.filter((d) => d.status === "gone"),
    failedNote: (key, mode) => failedWords(key, mode),
    isOpen: () => F.open && !F.parked,
    park, unpark,
    current: () => (F.open && !F.done && !F.vig ? F.cur : null),
    open, close, sync, undo, decide, decideNow, laterNow, bringIn,
    recall: (key) => later.delete(key),
    recallAll: () => later.clear(),
    cardHtml, cardTitle, wireCard,
    cardKeys: wireDecisionKeyboard({ panel, stage, F, undo, onOpenThread, close, confirmAll, setLater, skip }),
    parts: { effTagHtml, leadHtml, chipsHtml },
    queued: (key) => queue.has(key),
    pendingKey: (key) => queue.has(key),
  };
  return api;
}
