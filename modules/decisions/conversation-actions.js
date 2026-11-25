// @ts-check

import { pressEntry, valuePress } from "../../shell/conversation-press.js";
import { ApiError } from "../../core/platform/http.js";
import { requestFailureMessage } from "../../core/services/notices/failures.js";

/** @import { ActionDeps, OpenOptions } from "./conversation-actions-types.d.ts" */

/** @param {ActionDeps} options */
export function createConversationDecisionActions({ view, unfold, scope, D, world, tdock, convThread, schedule, announce }) {
  /** @type {Map<string, { busy: boolean, error?: string }>} */
  const pendingLimits = new Map();
  /** @param {string} key @param {OpenOptions} [opts] */
  function decideKey(key, opts) {
    const t = convThread(view());
    const n = D.needItems().find((x) => x.key === key);
    if (t && n && n.t.id === t.id && !D.isOpen() && !opts) {
      unfold(key);
      if (n.later) D.recall(key);
      if (n.held) D.bringIn(key);
      schedule();
      const current = view();
      scope.frame(() => scope.frame(() => {
        const card = tdock.querySelector(".card");
        if (view() === current && card instanceof HTMLElement) card.focus({ preventScroll: true });
      }));
      return;
    }
    D.open(key, opts);
  }

  /** @param {string} id @param {string} decision */
  async function decideLimit(id, decision) {
    if (scope.signal.aborted || pendingLimits.get(id)?.busy) return;
    pendingLimits.set(id, { busy: true });
    schedule();
    try {
      await world.act.decideItem(id, { decision });
      if (scope.signal.aborted) return;
      pendingLimits.delete(id);
      announce(decision === "move" ? "Moving the waiting threads. Each one says where it went." : "They wait for the limit to open.");
    } catch (error) {
      if (scope.signal.aborted) return;
      const text = error instanceof ApiError && "gone" in error
        ? "It was already decided, or the limit opened." : requestFailureMessage(error, "Couldn't send the decision.");
      pendingLimits.set(id, { busy: false, error: text });
    }
    schedule();
  }

  const routes = [
    pressEntry("decide", valuePress("data-decide", (key) => decideKey(key))),
    pressEntry("limit", (target) => {
      const button = target.closest("[data-limit]");
      const id = button?.getAttribute("data-limit"), decision = button?.getAttribute("data-limit-d");
      if (!id || !decision) return false;
      void decideLimit(id, decision);
      return true;
    }),
  ];
  return { routes, decideKey, decideLimit, limitStatus: pendingLimits.get.bind(pendingLimits) };
}
