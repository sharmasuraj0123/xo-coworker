import type { WorldState } from "../../core/services/world/state-types.d.ts";
import type { DecisionControllerDeps } from "./controller-types.d.ts";
import type { createDecisionFeedback } from "./feedback.js";

type ControllerOptions = Omit<DecisionControllerDeps, "onUndone" | "waitSince" | "P" | "world" | "onOpenThread"
  | "onNotSent" | "onAllClear" | "onBreak">;

export interface DecisionPresentation {
  D: ReturnType<typeof import("./controller.js").createDecisions>;
  Kit: typeof import("./kit.js");
  evidenceFor: typeof import("./rank.js").evidenceFor;
  EFFORT: typeof import("./rank.js").EFFORT;
  askTitle: typeof import("./ask-label.js").askTitle;
  askShort: typeof import("./ask-label.js").askShort;
  waitSince: Map<string, number>;
}
declare module "../../core/kernel/types" {
  interface Services { decisionPresentation: DecisionPresentation }
}

export interface DecisionSurfaceOptions extends ControllerOptions {
  view(): string;
  bus: import("../../core/kernel/types").Bus;
  scope: Parameters<typeof createDecisionFeedback>[1];
  showNotice: Parameters<typeof createDecisionFeedback>[0]
    & ((notice: { kind: "ping"; text: string; sub: string; decide: string }, ms: number) => void);
  world: Omit<DecisionControllerDeps["world"], "state"> & { state: Pick<WorldState, keyof DecisionControllerDeps["world"]["state"]> };
  conversationOf(project: string): string;
  go(view: string): void;
}
