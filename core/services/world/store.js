// @ts-check
import { stormSource } from "../storm/index.js";

/** @typedef {import("../storm/types").StormState} State @typedef {import("../storm/types").StormEvent} WorldEvent @typedef {import("../storm/types").Row} Row */

/** Waiting on the person: a question, an approval, or paused by storm's loop breaker (a reply in the thread resumes it). @param {string} s */
export const WAITING = (s) => s === "needs_reply" || s === "needs_approval" || s === "paused";

/** The world the views render: it reads on its own (GETs and the one stream) and writes only when the person acts, through world.act. */
export function createWorld() {
  /** @type {Set<(s: State) => void>} */
  const subs = new Set();
  /** @type {Set<(e: WorldEvent, s: State) => void>} */
  const evs = new Set();
  /** @type {State} */
  const state = /** @type {any} */ ({ projects: [], threads: [], activity: [], busy: {}, loaded: false, error: null, now: Date.now() });
  const emit = () => { state.now = Date.now(); for (const f of subs) f(state); };
  /** @param {WorldEvent} e */
  const event = (e) => {
    e.at = e.at || Date.now();
    state.activity.unshift(e);
    state.activity.length = Math.min(state.activity.length, 200);
    for (const f of evs) f(e, state);
  };

  const source = stormSource(state, emit, event);

  return {
    get state() { return state; },
    /** Every change; at once if already loaded. @param {(s: State) => void} fn */
    subscribe(fn) { subs.add(fn); if (state.loaded) fn(state); return () => subs.delete(fn); },
    /** Discrete events: a state change, a new ask, a message, done. @param {(e: WorldEvent, s: State) => void} fn */
    onEvent(fn) { evs.add(fn); return () => evs.delete(fn); },
    act: source.act,
    /** @param {string} id */
    thread: (id) => state.threads.find((t) => t.id === id),
    /** @param {string} id */
    project: (id) => state.projects.find((p) => p.id === id),
    waiting: () => state.threads.filter((t) => WAITING(t.state) && !t.frozen),
  };
}
