// @ts-check

import { createDecisions } from "./controller.js";
import { createDecisionFeedback } from "./feedback.js";
import { createPacing } from "./pacing.js";

/** @import { DecisionSurfaceOptions } from "./surface-types.d.ts" */

/** @param {DecisionSurfaceOptions} options */
export function createDecisionSurface({ params, scope, showNotice, conversationOf, go, ...controller }) {
  const pacing = createPacing({ params });
  const decisions = createDecisions({
    ...controller,
    ...createDecisionFeedback(showNotice, scope),
    P: pacing,
    onOpenThread(id) {
      const host = controller.world.state.hosts?.find((entry) => entry.id === id);
      if (!host) go("t:" + id);
      else if (host.chatId) go(conversationOf(host.project));
      else if (host.plainSession) go("c:" + host.plainSession);
      else showNotice({ kind: "calm", text: "It isn't tied to a conversation", sub: host.title }, 3600);
    },
  });
  return { decisions, pacing };
}
