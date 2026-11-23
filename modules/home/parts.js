// @ts-check

/** @typedef {{ key: string, admitted?: boolean, later?: boolean, held?: boolean, effort?: string, ask?: unknown, group?: string }} HomeNeed */

/** @template {HomeNeed} Need @param {{ pin: string | null }} S @param {{ needItems: () => Need[] }} D @param {{ isBinary: (ask: unknown) => boolean }} Kit */
export function createHomeParts(S, D, Kit) {
  return function homeParts(needs = D.needItems()) {
    const adm = needs.filter((n) => n.admitted);
    const active = adm.filter((n) => !n.later);
    const next = active.find((n) => n.key === S.pin) || active[0] || null;
    S.pin = next ? next.key : null;
    const rest = active.filter((n) => n !== next);
    return { needs, adm, active, next, then: rest.slice(0, 2), more: rest.slice(2), later: adm.filter((n) => n.later), held: needs.filter((n) => n.held), glances: active.filter((n) => n.effort === "glance" && Kit.isBinary(n.ask) && n.group === "routine") };
  };
}
