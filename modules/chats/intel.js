// @ts-check

import { space, once } from "../../core/platform/index.js";
import { api } from "../../core/platform/api.js";
import { PHONE } from "../../core/platform/viewport.js";
import { RM } from "../../core/ui/motion.js";
import { rtName } from "../../core/services/runtimes.js";
import { EFFORT_WORD } from "./effort.js";
import { sessionOrder } from "./session-order.js";
import { createIntelCatalog } from "./intel-catalog.js";
import { createIntelReads } from "./intel-reads.js";
import { createIntelView } from "./intel-view.js";
import { bindIntelInput } from "./intel-input.js";

/** @import { Draft, IntelChat, IntelCurrent, IntelError, IntelModel, IntelMove, IntelOptions, IntelPop, IntelState } from "./intel-types.js" */

/** @param {IntelOptions} options */
export function createIntel({ world, PROJ, onChange, record, onMoved, simple = () => false }) {
  /** @type {IntelState} */
  const P = { open: false, gen: 0, session: null, anchor: null, returnTo: null, models: null, err: null, busy: false, rt: null, mv: null, full: false, draft: null, more: false };
  const movedHere = new Set(); // threads this tab continued elsewhere (their stream frame needs no second word)
  const pop = /** @type {IntelPop} */ (document.getElementById("iq-pop"));

  const catalogState = createIntelCatalog(P, { world, PROJ, onChange, simple });
  const {
    kindOf, scopeWord, chatOfSession, threadOf, catalogs, modelOf, nameOf,
    current, running, live, chipHtml, chipTitle, cap, chatPolicy, runtimeChoice, moving, effortsOf, deepPick,
  } = catalogState;
  const { render } = createIntelView(P, { pop, world, simple, catalogState, draftOf, draftChanged, place });
  const reads = createIntelReads(P, catalogState, render, onChange);
  const loadModels = reads.load;

  /** The choice on screen: what you picked while it's open, else what it runs on. {auto, model, effort} @param {string} s @returns {Draft} */
  function draftOf(s) {
    if (P.draft) return P.draft;
    const c = current(s), r = running(s);
    if (threadOf(s)) return { auto: false, model: c.model || (r && r.model) || defaultId(), effort: c.effort || (r && r.effort) || null };
    return c.pinned ? { auto: false, model: c.model, effort: c.effort } : { auto: true, model: null, effort: null };
  }
  /** @param {string} s */
  function draftChanged(s) {
    if (!P.draft) return false;
    const c = current(s), d = P.draft;
    if (!threadOf(s) && d.auto) return c.pinned;
    return d.model !== c.model || (d.effort || null) !== (c.effort || null) || (!threadOf(s) && !c.pinned);
  }
  /** Pick a model: it keeps the depth you had when it can, else takes its own default. @param {string} id */
  function pickModel(id) {
    const s = (/** @type {string} */ (P.session));
    if (!id) { P.draft = { auto: true, model: null, effort: null }; render(); return; }
    const m = modelOf(id), efs = effortsOf(m, s), was = draftOf(s).effort;
    P.draft = { auto: false, model: id, effort: !efs.length ? null : efs.includes((/** @type {string} */ (was))) ? was : (/** @type {IntelModel & { default_effort: string }} */ (m)).default_effort && efs.includes((/** @type {IntelModel & { default_effort: string }} */ (m)).default_effort) ? (/** @type {IntelModel & { default_effort: string }} */ (m)).default_effort : efs[Math.floor((efs.length - 1) / 2)] };
    render();
  }
  /** Continuing elsewhere: a model there, at its own default depth. @param {string} id */
  function pickMove(id) {
    const m = ((/** @type {IntelMove} */ (P.mv)).models || []).find((x) => x.id === id);
    const efs = effortsOf(m, (/** @type {string} */ (P.session)), P.rt);
    (/** @type {IntelMove} */ (P.mv)).model = id; (/** @type {IntelMove} */ (P.mv)).effort = efs.length ? ((/** @type {IntelModel & { default_effort: string }} */ (m)).default_effort && efs.includes((/** @type {IntelModel & { default_effort: string }} */ (m)).default_effort) ? (/** @type {IntelModel & { default_effort: string }} */ (m)).default_effort : efs[Math.floor((efs.length - 1) / 2)]) : null;
    render();
  }
  /** @param {string} e */
  function pickEffort(e) { const d = draftOf((/** @type {string} */ (P.session))); P.draft = { ...d, auto: false, effort: e }; render(); }
  /** Closing applies what is on screen (one change, one record line with Undo). @param {string} s */
  function commit(s) {
    if (!draftChanged(s)) { P.draft = null; return; }
    const d = (/** @type {Draft} */ (P.draft)); P.draft = null;
    if (!d.auto && !(P.models || []).some((m) => m.id === d.model)) return; // picked in another runtime's list
    // closed by a click outside: it applies as it closes; refused, the choice waits for the next opening
    save(s, d, P.gen);
  }
  /** @type {Map<string, Draft>} */
  const failed = new Map(); // session → the choice a refused save left behind (the picker reopens on it)
  const order = sessionOrder(); // every write to a conversation's intelligence, in the order it was asked
  /** @type {Map<string, number>} */
  const asked = new Map(); // session → the number of its latest save: only the latest says what's left behind
  /** @param {string} s @param {Draft} d @param {number} gen */
  function save(s, d, gen) {
    return once(`iq:${s}:${gen}`, () => {
      const n = (asked.get(s) || 0) + 1;
      asked.set(s, n);
      return order(s, () => (d.auto ? toAuto(s) : pin(s, d.model, d.effort))).then((ok) => {
        if (asked.get(s) === n) { if (ok) failed.delete(s); else failed.set(s, d); }
        return ok;
      });
    });
  }
  async function done() {
    // while it saves, Done (and Enter) is that same save: nothing more is asked
    if (P.saving) return;
    const s = (/** @type {string} */ (P.session)), gen = P.gen;
    if (!draftChanged(s)) { close(); return; }
    const d = (/** @type {Draft} */ (P.draft));
    if (!d.auto && !(P.models || []).some((m) => m.id === d.model)) { close(); return; }
    P.saving = true; P.saveErr = null;
    const p = save(s, d, gen);
    render();
    const ok = await p;
    // its result is this opening's only: closed meanwhile, or opened again, it closes and changes nothing there
    if (P.gen !== gen) return;
    P.saving = false;
    if (ok) { P.draft = null; close({ apply: false }); return; }
    failed.delete(s); // it's on screen, with what went wrong
    P.saveErr = "That didn't save, so nothing changed. Your choice is still here: Done tries again.";
    render();
    pop.querySelector("[data-ldone]")?.focus({ preventScroll: true });
  }
  function place() {
    if (!P.anchor) return;
    if (PHONE?.matches) { pop.style.left = pop.style.top = pop.style.width = ""; pop.classList.add("is-sheet"); return; }
    pop.classList.remove("is-sheet");
    const r = P.anchor.getBoundingClientRect();
    // a window's edge keeps --s-3, the chip --s-2 (they were 12 and 10 written here)
    const edge = space("--s-3"), gap = space("--s-2");
    const w = Math.min(360, innerWidth - 2 * edge);
    pop.style.width = `${w}px`;
    pop.style.left = `${Math.max(edge, Math.min(r.right - w + gap, innerWidth - w - edge))}px`;
    pop.style.top = `${Math.max(edge, r.top - pop.offsetHeight - gap)}px`;
  }
  /** A thread looks at continuing on `name`: its models there, read with a deadline (Default never waits). @param {string | null} name */
  function lookAt(name) {
    if (P.mv && P.mv.busy) return;
    P.draft = null;
    const s = (/** @type {string} */ (P.session));
    P.rt = name;
    P.mv = moving(s) ? { model: null, effort: null, models: catalogs.get(name) || null } : null;
    const had = pop.contains(document.activeElement);
    render();
    // the move view takes the runtime choice's place: focus goes to its first choice (a model, or Cancel while
    if (had && P.mv && !pop.contains(document.activeElement)) (pop.querySelector('[data-mvm][tabindex="0"]') || pop.querySelector("[data-mv-cancel]") || pop).focus({ preventScroll: true });
    void reads.move(name);
  }
  function stepBack() {
    P.more = true;
    lookAt(null);
    pop.querySelector(`[data-lrt][aria-checked="true"]`)?.focus({ preventScroll: true });
  }
  /** opts.rt: open a thread's picker looking at continuing on that runtime (the thread menu's way in). @param {string} s @param {HTMLElement | null} anchor @param {{rt?: string}} [opts] */
  async function open(s, anchor, opts = {}) {
    if (!live(s) || reads.effects.signal.aborted) return;
    reads.open();
    P.gen++;
    P.open = true; P.session = s; P.anchor = anchor; P.returnTo = /** @type {HTMLElement | null} */ (document.activeElement); P.err = null; P.models = null; P.busy = false; P.rt = null; P.mv = null; P.full = false; P.draft = null; P.more = false;
    P.saving = false;
    P.saveErr = null;
    if (failed.has(s)) { P.draft = (/** @type {Draft} */ (failed.get(s))); failed.delete(s); P.saveErr = "Your last choice here didn't save. It's still chosen: Done tries again."; }
    pop.hidden = false; pop.classList.remove("is-out");
    if (opts.rt) lookAt(opts.rt); else render();
    anchor?.setAttribute("aria-expanded", "true");
    if (opts.rt) pop.querySelector(`[data-lrt="${CSS.escape(opts.rt)}"]`)?.focus({ preventScroll: true });
    else pop.focus({ preventScroll: true });
    await loadModels(s);
  }
  function close({ restore = true, apply = true } = {}) {
    if (!P.open) return;
    if (apply && !P.mv && !P.saving) commit((/** @type {string} */ (P.session))); else P.draft = null;
    reads.close();
    P.gen++; // and so does a save: its result won't close or change what opens next
    P.rt = null; P.mv = null;
    P.open = false;
    P.anchor?.setAttribute("aria-expanded", "false");
    if (RM.matches) pop.hidden = true;
    else { pop.classList.add("is-out"); reads.hide(() => { pop.hidden = true; pop.classList.remove("is-out"); }); }
    if (restore) (P.returnTo && P.returnTo.isConnected ? P.returnTo : P.anchor)?.focus?.({ preventScroll: true });
  }

  /** @param {string} s @param {object} body */
  async function patch(s, body) {
    const t = threadOf(s);
    if (t) return api.patchThread(t.chatId, t.id, { intelligence: body });
    const c = chatOfSession(s);
    return api.patchChat((/** @type {IntelChat} */ (c)).chatId, body);
  }
  /** @param {string} s @param {object} body @param {object | null} undoBody @param {string} text */
  async function change(s, body, undoBody, text) {
    try {
      await patch(s, body);
      await world.act.refresh?.();
      onChange();
      record(s, { text, undo: undoBody ? async () => { await patch(s, undoBody); await world.act.refresh?.(); onChange(); } : null });
      return true;
    } catch (err) {
      record(s, { text: `Nothing changed: ${(/** @type {IntelError} */ (err)).message}`, refused: true });
      return false;
    }
  }
  // The catalog's "no override" model. Storm stores and runs it as no override, and unlike null it
  const defaultId = () => { const m = (P.models || []).find((x) => x.is_default); return m ? m.id : "default"; };
  /** What to send to put a conversation back exactly as it ran before a change. @param {string} s @param {IntelCurrent} before */
  function restoreBody(s, before) {
    if (kindOf(s) === "thread") {
      // a thread's pin can't be cleared (backend gap): Undo pins what it ran on, the router's choice
      return { model: before.model || defaultId(), ...(before.effort ? { effort: before.effort } : {}) };
    }
    return before.pinned ? { model: before.model || defaultId(), effort: before.effort || null } : { model: defaultId(), effort: null };
  }
  /** @param {string} s @param {string | null | undefined} model @param {string | null | undefined} effort */
  function pin(s, model, effort) {
    const before = current(s);
    const kind = kindOf(s);
    const body = kind === "thread" ? { model, ...(effort ? { effort } : {}) } : { model, effort: effort || null };
    return change(s, body, restoreBody(s, before), `${kind === "thread" ? "This thread" : cap(scopeWord(s))}, next turn: ${nameOf(model)}${effort ? ` · ${EFFORT_WORD[effort] || effort}` : ""}`);
  }
  /** @param {string} s */
  function toAuto(s) {
    const before = current(s);
    if (kindOf(s) === "thread") {
      // the closest a thread can come to "no pin": the CLI's own model at its own effort
      const d = modelOf(defaultId());
      const ef = d && d.takes_effort ? d.default_effort || null : null;
      return change(s, { model: defaultId(), ...(ef ? { effort: ef } : {}) }, restoreBody(s, before), "This thread is back on the CLI's default model");
    }
    return change(s, { model: defaultId(), effort: null }, restoreBody(s, before), `${cap(scopeWord(s))} is back on its default`);
  }
  /** @param {string} s @param {string} id */
  function route(s, id) {
    const c = chatOfSession(s);
    const before = c && c.routing ? c.routing : null;
    const body = id === "space" ? { routing: null } : id === "agent" ? { routing: { mode: "agent" } } : id === "off" ? { routing: { mode: "off" } } : { routing: { mode: "decision", decision_model: id.slice(3) } };
    const label = id === "space" ? "uses the Space's routing" : id === "agent" ? "is routed by its coordinator" : id === "off" ? "refuses new messages: routing is off" : `is routed by ${cap(id.slice(3))}`;
    change(s, body, { routing: before }, `${s === "ws" ? "The Workspace" : PROJ(s.slice(2))} ${label}`);
  }

  const blankPolicy = { allowed: null, default: null, preferences: null, fallback: null };
  /** A project's or the Workspace's runtime: its coordinator (from its next pause) and, for a project, its new threads. @param {string} s @param {string} id */
  async function setRuntime(s, id) {
    P.draft = null;
    const c = chatOfSession(s), kind = kindOf(s);
    if (!c || P.busy || id === runtimeChoice(s).on) return;
    const pin0 = { agent: (c.pin && c.pin.agent) || null, model: (c.pin && c.pin.model) || null, effort: (c.pin && c.pin.effort) || null };
    const pol0 = kind === "project" && chatPolicy(c) ? { ...blankPolicy, ...((/** @type {NonNullable<ReturnType<typeof chatPolicy>>} */ (chatPolicy(c))).project || {}) } : null;
    const agent = id === "auto" ? null : id;
    P.busy = true; render();
    try {
      // A new runtime starts on its own default model.
      await order(s, async () => {
        await api.patchChat(c.chatId, { agent, model: null, effort: null });
        if (pol0) await world.act.setPolicy(c.chatId, { ...pol0, default: agent });
      });
      failed.delete(s); // a choice an earlier save left behind was the old runtime's model: it doesn't carry over
      await world.act.refresh?.();
      const who = kind === "project" ? PROJ(s.slice(2)) : "The Workspace";
      record(s, {
        text: kind === "project" ? (agent ? `${who} runs on ${rtName(agent)}: its coordinator from its next pause, and its new threads` : `${who} is on Auto: its coordinator picks a runtime for each new thread`) : `The Workspace coordinator runs on ${rtName(agent)} from its next pause`,
        undo: async () => {
          await api.patchChat(c.chatId, pin0); if (pol0) await world.act.setPolicy(c.chatId, pol0); await world.act.refresh?.(); onChange();
        },
      });
    } catch (err) { record(s, { text: `Nothing changed: ${(/** @type {IntelError} */ (err)).message}`, refused: true }); }
    P.busy = false;
    onChange();
    if (P.open && P.session === s) { P.models = null; render(); loadModels(s); }
  }
  /** Continue the thread on the runtime it looks at: XO stops it, saves its work, and a linked thread starts there. */
  async function moveGo() {
    const s = (/** @type {string} */ (P.session)), t = threadOf(s), mv = P.mv;
    if (!t || !mv || mv.busy) return;
    mv.busy = true; mv.err = null; mv.rt = P.rt; render();
    movedHere.add(t.id);
    try {
      const r = await api.continueThread(t.chatId, t.id, { agent: P.rt, model: mv.model || null, effort: mv.effort || null });
      const next = r && r.thread_id ? await world.act.fetchThread(t.chatId, r.thread_id).catch(() => null) : null;
      mv.busy = false;
      // its result closes only the picker that started it, still open on it (another opening isn't this one's)
      if (P.open && P.session === s && P.mv === mv) close({ restore: false });
      onMoved && onMoved(next, r.agent || mv.rt || P.rt);
    } catch (err) {
      mv.busy = false;
      mv.retry = (/** @type {IntelError} */ (err)).code === "still_busy" || (/** @type {IntelError} */ (err)).code === "timeout" || (/** @type {IntelError} */ (err)).status === 0;
      mv.err = (/** @type {IntelError} */ (err)).code === "still_busy" ? "The thread didn't stop in time. Nothing moved; try again." : (/** @type {IntelError} */ (err)).message;
      // its failure is said in the picker that started it, if that picker is still open on it
      if (P.open && P.session === s && P.mv === mv) { render(); pop.querySelector("[data-mv-go]")?.focus({ preventScroll: true }); }
    }
  }

  bindIntelInput(P, reads.effects, {
    pop, threadOf, deepPick, save, close, render, lookAt, setRuntime, stepBack, moveGo,
    pickMove, route, done, pickModel, pickEffort, place,
  });

  return {
    current, chipHtml, chipTitle, open, close, activate: reads.activate, dispose: reads.effects.dispose,
    routed: () => null, spawnSetup: () => null, set: () => {}, setRouting: () => {},
    get isOpen() { return P.open; },
    /** Did this tab continue that thread elsewhere (so the stream's frame for it needs no herald)? */
    movedHere: (/** @type {string} */ id) => movedHere.has(id),
    runtimeChoice,
    get session() { return P.session; },
    kindOf, scopeWord,
  };
}
