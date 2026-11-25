import type { DockDeps, Mount } from "./dock-types";
import type { ActionDeps } from "./conversation-actions-types";

export type DockSurface = Omit<DockDeps, "folds" | "dockGestures" | "askShort"> & Omit<ActionDeps, "unfold" | "tdock">
  & Pick<Mount, "region"> & { bus: import("../../core/kernel/types").Bus };
