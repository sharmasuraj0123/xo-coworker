// @ts-check

/** @typedef {{ key: string, admitted?: boolean, later?: boolean, held?: boolean, effort?: string, ask?: unknown, group?: string }} HomeNeed */

/** @typedef {Pick<ReturnType<typeof import("./selection.js").createHomeSelection>, "current" | "select">} HomeSelect */

/** @template {HomeNeed} Need @param {HomeSelect} selection @param {() => Need[]} needItems @param {(ask: unknown) => boolean} isBinary */
export function createHomeParts(selection, needItems, isBinary) {
  return function homeParts(needs = needItems()) {
    const adm = needs.filter((n) => n.admitted);
    const active = adm.filter((n) => !n.later);
    const pinned = selection.current();
    const next = active.find((n) => n.key === pinned) || active[0] || null;
    selection.select(next?.key ?? null);
    const rest = active.filter((n) => n !== next);
    return {
      needs, adm, active, next, then: rest.slice(0, 2), more: rest.slice(2),
      later: adm.filter((n) => n.later),
      held: needs.filter((n) => n.held),
      glances: active.filter((n) => n.effort === "glance" && isBinary(n.ask) && n.group === "routine"),
    };
  };
}
