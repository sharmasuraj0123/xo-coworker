import type { DockDeps, Mount } from "./dock-types";
import type { ActionDeps } from "./conversation-actions-types";

export type DockSurface = Omit<DockDeps, "folds" | "dockGestures" | "askShort"> & Omit<ActionDeps, "unfold" | "tdock">
  & Pick<Mount, "region"> & { on: import("../../core/kernel/types").Bus["on"] };

declare module "../../core/kernel/types" {
  interface Services { decisionDock: ReturnType<typeof import("./dock-surface.js").mountDecisionDock> }
}
