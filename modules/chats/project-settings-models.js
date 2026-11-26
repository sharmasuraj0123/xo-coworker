// @ts-check

import { allowedOf, isInstalled, healthOf, windowsOf, rtName } from "../../core/services/runtimes.js";
import { EFFORT_WORD } from "./effort.js";

/** @import { IntelWorld, Routing } from "./intel-types.js" */

/** @import { PsCatalog, PsCoordinator, PsPolicy, PsState, PsThreads } from "./project-settings-types.js" */

/** @type {PsPolicy} */
export const BLANK = { allowed: null, default: null, preferences: null, fallback: null };

/** @typedef {{ world: IntelWorld, cat: PsCatalog, PROJ: (p: string) => string, state: PsState }} PsModelDeps */

/** What each page of Project settings shows, read from the world. @param {PsModelDeps} deps */
export function psModels({ world, cat, PROJ, state }) {
  const session = () => `p:${state.project}`;
  const name = () => PROJ(/** @type {string} */ (state.project));

  /** @param {Routing | null | undefined} own */
  function routes(own) {
    const space = world.state.router || { mode: "agent" };
    const spaceLine = space.mode === "decision" ? `${cat.cap(space.decision_model)} routes, as set in Settings › Routing.`
      : space.mode === "off" ? "Routing is off for the whole Space." : "Its coordinator decides, as set in Settings › Routing.";
    const opts = [
      { id: "space", label: "The Space's", on: !own, line: spaceLine },
      { id: "agent", label: "Coordinator", on: own?.mode === "agent", line: "Its coordinator reads each message and decides." },
      ...state.dms.filter((m) => m.connected).map((m) => ({
        id: `dm:${m.id}`, label: m.label.replace(/^\S+ /, ""), on: own?.mode === "decision" && own.decision_model === m.id,
        line: `${m.label} routes its messages; the coordinator decides when it isn't sure.`,
      })),
      { id: "off", label: "Off", on: own?.mode === "off", line: "New messages to it are refused. Its threads still take your replies." },
    ];
    return { routes: opts, routeLine: (opts.find((o) => o.on) || opts[0]).line };
  }

  /** @returns {PsCoordinator} */
  function coordinator() {
    const s = session(), c = cat.current(s), rc = cat.runtimeChoice(s), list = state.models;
    const on = list ? list.find((m) => m.id === c.model) : null;
    const auto = !c.pinned || !!(on && on.is_default);
    const rt = (world.state.runtimes || []).find((r) => r.name === cat.runtimeOf(s));
    const h = rt ? healthOf(rt) : null, w = rt ? windowsOf(rt)[0] : null;
    const rtNote = rt && h && h.tone === "warn" && w && w.utilization != null
      ? `${rtName(rt.name)} is at ${Math.round(w.utilization * 100)}% of its usage window.` : "";
    return {
      name: name(), busy: state.busy, runtime: rc.on, runtimes: rc.list, rtNote,
      models: list ? cat.shown(list) : null, auto, model: c.model, effort: c.effort,
      efforts: auto || !on ? [] : cat.effortsOf(on, s).filter((e) => EFFORT_WORD[e]),
      ...routes(c.ownRouting ? c.routing : null), notes: state.notes,
    };
  }

  /** @returns {PsThreads} */
  function threads() {
    const c = cat.chatOfSession(session()), pol = c ? cat.chatPolicy(c) : null, rts = world.state.runtimes || [];
    if (!pol || !world.state.runtimes) {
      return { name: name(), ready: false, busy: state.busy, own: BLANK, allowed: [], installed: [],
        spaceDefault: null, spaceFallback: false, spacePref: null, pref: "", notes: state.notes };
    }
    const own = { ...BLANK, ...(pol.project || {}) }, space = { ...BLANK, ...(pol.space || {}) };
    return {
      name: name(), ready: true, busy: state.busy, own, allowed: allowedOf(pol.effective || own, rts),
      installed: rts.filter(isInstalled).map((r) => r.name),
      spaceDefault: space.default, spaceFallback: !!space.fallback, spacePref: space.preferences,
      pref: state.pref ?? own.preferences ?? "", notes: state.notes,
    };
  }

  return { session, coordinator, threads };
}
