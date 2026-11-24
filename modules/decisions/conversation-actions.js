// @ts-check

/** @import { ActionDeps, DecisionError, OpenOptions } from "./conversation-actions-types.d.ts" */

/** @param {ActionDeps} options */
export function createConversationDecisionActions({ S, D, world, tdock, convThread, schedule, announce }) {
  /** @param {string} key @param {OpenOptions} [opts] */
  function decideKey(key, opts) {
    const t = convThread(S.view);
    const n = D.needItems().find((x) => x.key === key);
    if (t && n && n.t.id === t.id && !D.isOpen() && !opts) {
      delete S.dockFold[key];
      if (n.later) S.later.delete(key);
      if (n.held) D.bringIn(key);
      schedule();
      requestAnimationFrame(() => requestAnimationFrame(() => (/** @type {HTMLElement | null} */ (tdock.querySelector(".card")))?.focus({ preventScroll: true })));
      return;
    }
    D.open(key, opts);
  }

  /** @param {string} id @param {string} decision */
  async function decideLimit(id, decision) {
    S.limitBusy = id; S.limitErr = null; schedule();
    try {
      await world.act.decideItem(id, { decision });
      announce(decision === "move" ? "Moving the waiting threads. Each one says where it went." : "They wait for the limit to open.");
    } catch (err) { S.limitErr = { id, text: (/** @type {DecisionError} */ (err)).gone ? "It was already decided, or the limit opened." : (/** @type {DecisionError} */ (err)).message }; }
    S.limitBusy = null; schedule();
  }

  return { decideKey, decideLimit };
}
