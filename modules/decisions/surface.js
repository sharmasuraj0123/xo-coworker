// @ts-check

import { createDecisionPings } from "../../shell/decision-pings.js";
import * as Kit from "./kit.js";
import { EFFORT, evidenceFor } from "./rank.js";
import { askTitle, askShort } from "./ask-label.js";
import { createDecisions } from "./controller.js";
import { createDecisionFeedback } from "./feedback.js";
import { createPacing } from "./pacing.js";

/** @import { DecisionSurfaceOptions } from "./surface-types.d.ts" */

/** @param {DecisionSurfaceOptions} options */
export function createDecisionSurface({ bus, view, scope, showNotice, conversationOf, go, ...controller }) {
  const pacing = createPacing();
  const waitSince = new Map();
  const decisions = createDecisions({
    ...controller,
    ...createDecisionFeedback(showNotice, scope),
    P: pacing, waitSince, onUndone: (key) => bus.emit("app:decision-undone", key),
    onOpenThread(id) {
      const host = controller.world.state.hosts?.find((entry) => entry.id === id);
      if (!host) go("t:" + id);
      else if (host.chatId) go(conversationOf(host.project));
      else if (host.plainSession) go("c:" + host.plainSession);
      else showNotice({ kind: "calm", text: "It isn't tied to a conversation", sub: host.title }, 3600);
    },
  });
  /** @type {Parameters<typeof createDecisionPings<import("./controller-types").DecisionNeed>>[0]} */
  const pingOptions = { view, P: pacing, PROJ: controller.PROJ, askShort, heraldShow: showNotice };
  /** @type {import("../../core/kernel/types").ModuleDef} */
  const module = {
    manifest: { id: "xo.decision-model", version: "1.0.0", kernel: "^1.1.0", core: true, provides: ["decisionPresentation"] },
    activate(ctx) { ctx.provide("decisionPresentation", { D: decisions, EFFORT, askTitle, Kit, evidenceFor }); },
  };
  return { decisions, waitSince, pings: createDecisionPings(pingOptions), module };
}
