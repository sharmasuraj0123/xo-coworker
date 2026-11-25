import type { WorldThread } from "../../core/services/world/state-types.d.ts";
import type { RunsPageDeps } from "./page-types.d.ts";

export interface RunsHost extends Omit<RunsPageDeps, "world" | "announce"> {
  shape: { on(id: string): boolean };
  threadAt(target: Element): WorldThread | null;
}
