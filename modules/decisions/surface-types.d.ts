import type { WorldState } from "../../core/services/world/state-types.d.ts";
import type { DecisionControllerDeps } from "./controller-types.d.ts";
import type { createDecisionFeedback } from "./feedback.js";

type ControllerOptions = Omit<DecisionControllerDeps, "P" | "world" | "onOpenThread" | "onNotSent" | "onAllClear" | "onBreak">;

export interface DecisionSurfaceOptions extends ControllerOptions {
  params: URLSearchParams;
  scope: Parameters<typeof createDecisionFeedback>[1];
  showNotice: Parameters<typeof createDecisionFeedback>[0];
  world: Omit<DecisionControllerDeps["world"], "state"> & { state: Pick<WorldState, keyof DecisionControllerDeps["world"]["state"]> };
  conversationOf(project: string): string;
  go(view: string): void;
}
