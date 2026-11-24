// @ts-check

/** @import { PingNeed, DecisionPingDeps } from "./decision-pings-types.d.ts" */

/** @template {PingNeed} N @param {DecisionPingDeps<N>} options */
export function createDecisionPings({ S, P, PROJ, askShort, heraldShow }) {
  /** @param {N[]} needs */
  return function pings(needs) {
    if (!S.seen) { S.seen = new Set(needs.map((n) => n.key)); return; }
    for (const n of needs) {
      if (S.seen.has(n.key)) continue;
      S.seen.add(n.key);
      if (n.group === "stopped" || n.ask.stopByYou || !P.mayPing(n)) continue;
      // never the same ask twice on one screen: Home lists it, and its own thread shows it above the composer
      if (S.view === "home" || S.view === `t:${n.t.id}`) continue;
      heraldShow({ kind: "ping", text: `${PROJ(n.t.project)} · worth a look`, sub: askShort(n), decide: n.key }, 7000);
    }
  };
}
