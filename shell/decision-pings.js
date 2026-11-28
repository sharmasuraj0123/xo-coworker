// @ts-check

/** @import { PingNeed, DecisionPingDeps } from "./decision-pings-types.d.ts" */

/** @template {PingNeed} N @param {DecisionPingDeps<N>} options */
export function createDecisionPings({ view, P, PROJ, askShort, heraldShow }) {
  /** @type {Set<string> | undefined} */
  let seen;
  /** @param {N[]} needs */
  return function pings(needs) {
    if (!seen) { seen = new Set(needs.map((n) => n.key)); return; }
    const current = view();
    for (const n of needs) {
      if (seen.has(n.key)) continue;
      seen.add(n.key);
      if (n.group === "stopped" || !P.mayPing(n)) continue;
      // never the same ask twice on one screen: Home lists it, and its own thread shows it above the composer
      if (current === "home" || current === `t:${n.t.id}`) continue;
      heraldShow({ kind: "ping", text: `${PROJ(n.t.project)} · worth a look`, sub: askShort(n), decide: n.key }, 7000);
    }
  };
}
