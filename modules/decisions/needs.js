// @ts-check

import { WAITING } from "../../core/services/world/store.js";
import { itemEffort } from "../../core/services/review.js";
import * as Kit from "./kit.js";
import { effortOf, leverageOf, rank } from "./rank.js";

/** @typedef {{id: string, title: string, state: string, checklist: {total: number, done: number}, stop?: unknown, happened?: string, asks?: {item?: object}[], host?: boolean, live?: boolean, busy?: boolean}} Thread */

/** @typedef {{seq: number, at: number}} Seen */

/** @typedef {{item?: object, kind?: string, title?: string, risk?: string, detail?: string}} Ask */

/** @typedef {{key: string, t: Thread, ask: Ask, group: string, risk: string}} UnrankedNeedFields */

/** @typedef {{since: number, waitSince: number, effort: import("./rank.js").Effort, lev: {min: number, steps: number}, idle: boolean, later: boolean}} RankFields */

/** @typedef {UnrankedNeedFields & Partial<RankFields>} UnrankedNeed */

/** @typedef {UnrankedNeedFields & RankFields & import("./pacing.js").Paced} RankedNeed */

/** @param {string} r */
export const riskLabel = (r) => ({ destructive: "Destructive", notable: "Notable", routine: "Routine", stopped: "Stopped" })[/** @type {"destructive" | "notable" | "routine" | "stopped"} */ (r)] || "Notable";

/** @param {{world: {state: {threads: Thread[], hosts?: Thread[]}}, P: Pick<ReturnType<typeof import("./pacing.js").createPacing>, "classify">, later: Set<string>, waitSince: Map<string, number>, stoppedDone: Set<string>, sentKeys: Map<string, number>, queue: {has(key: string): boolean}}} options */
export function createNeedItems({ world, P, later, waitSince, stoppedDone, sentKeys, queue }) {
  /** @type {Map<string, Seen>} */
  const firstSeen = new Map();
  let seq = 0;

  function needItems() {
    /** @type {UnrankedNeed[]} */
    const out = [];
    for (const t of [...world.state.threads, ...(world.state.hosts || [])]) {
      // A thread that fails again after its answer gets a new card.
      if (t.state !== "failed") stoppedDone.delete(t.id);
      if (t.state === "failed") {
        const key = `stop|${t.id}`;
        if (stoppedDone.has(t.id) || queue.has(key)) continue;
        // Only a failed run offers Try again.
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
      n.since = (/** @type {Seen} */ (firstSeen.get(n.key))).seq;
      n.waitSince = waitSince.get(n.key) ?? waitSince.get(n.t.id) ?? (/** @type {Seen} */ (firstSeen.get(n.key))).at;
      n.effort = n.ask.item ? itemEffort(n.ask.item) : effortOf(n);
      n.lev = leverageOf(n);
      // A warm session is idle even if its thread is working.
      n.idle = WAITING(n.t.state) || n.group === "stopped" || !!n.t.host || (n.t.live && n.t.busy === false);
      n.later = later.has(n.key);
    }
    P.classify(/** @type {RankedNeed[]} */ (out));
    return rank(/** @type {RankedNeed[]} */ (out));
  }

  return needItems;
}
