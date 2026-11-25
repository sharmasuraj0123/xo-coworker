// @ts-check
import { createScope } from "../../kernel/scope.js";
import { stormSource } from "../storm/index.js";
import { createTurns } from "./turns.js";

/** @typedef {import("./state-types.d.ts").WorldState} State @typedef {import("../storm/types").StormEvent} WorldEvent */

/** Waiting on the person: a question, an approval, or paused by storm's loop breaker (a reply in the thread resumes it). @param {string} s */
export const WAITING = (s) => s === "needs_reply" || s === "needs_approval" || s === "paused";

/** The world the views render: it reads on its own (GETs and the one stream) and writes only when the person acts, through world.act. */
export function createWorld() {
  const scope = createScope();
  const { signal } = scope;
  /** @type {Set<(s: State) => void>} */
  const subs = new Set();
  /** @type {Set<(e: WorldEvent, s: State) => void>} */
  const evs = new Set();
  /** @type {State} */
  const state = {
    projects: [], threads: [], hosts: [], activity: [], busy: {}, loaded: false, error: null, now: Date.now(),
    status: null, statusError: null, runtimes: null, router: null, pools: {},
    advisory: null,
    paidOk: false,
    paidPools: [],
    paid: [],
    policy: null,
    chatPolicy: {},
    controls: {},
    moves: {},
    conn: "connecting", connInfo: null,
    timeline: {},
    hist: {},
    found: {},
    threadMsgs: {},
    threadHist: {},
    sessions: {},
    awaiting: {},
    failed: {},
    routed: {},
    review: new Map(),
    gone: new Map(),
    runs: new Map(),
    hops: new Map(),
    liveRuns: {},
    turns: createTurns(),
    lastSeq: 0,
  };
  const emit = () => {
    if (signal.aborted) return;
    state.now = Date.now();
    for (const f of subs) f(state);
  };
  /** @param {WorldEvent} e */
  const event = (e) => {
    if (signal.aborted) return;
    e.at = e.at || Date.now();
    state.activity.unshift(e);
    state.activity.length = Math.min(state.activity.length, 200);
    for (const f of evs) f(e, state);
  };

  scope.effect(() => () => { subs.clear(); evs.clear(); });
  const act = stormSource(state, emit, event, scope);

  return {
    get state() { return state; },
    /** Every change; at once if already loaded. @param {(s: State) => void} fn */
    subscribe(fn) {
      if (signal.aborted) return () => false;
      subs.add(fn);
      if (state.loaded) fn(state);
      return () => subs.delete(fn);
    },
    /** Discrete events: a state change, a new ask, a message, done. @param {(e: WorldEvent, s: State) => void} fn */
    onEvent(fn) {
      if (signal.aborted) return () => false;
      evs.add(fn);
      return () => evs.delete(fn);
    },
    act,
    dispose: scope.dispose,
    /** @param {string | null | undefined} id */
    thread: (id) => state.threads.find((t) => t.id === id),
    /** @param {string} id */
    project: (id) => state.projects.find((p) => p.id === id),
    waiting: () => state.threads.filter((t) => WAITING(t.state) && !t.frozen),
  };
}
