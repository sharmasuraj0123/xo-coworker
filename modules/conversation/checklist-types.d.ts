import type { WorldThread } from "../../core/services/world/state-types.d.ts";

type ChecklistThread = Pick<WorldThread, "id" | "state" | "stop" | "branch" | "checklist" | "sessionId" | "session">;

export type ChecklistNeed = { t: { id: string } };
export type ChecklistHead = HTMLElement;

export type ChecklistDeps = {
  view(): string;
  scope: Pick<import("../../core/kernel/types").ModuleContext, "timeout" | "effect">;
  SHAPE: { on(key: string): boolean };
  convThread(view: string): ChecklistThread | null;
  places: Pick<import("../../core/kernel/types.d.ts").Places, "entries" | "watch">;
  schedule(): void;
};

export interface ThreadHead {
  id: string;
  render(thread: ChecklistThread): string;
}

declare module "../../core/kernel/types" {
  interface Services { checklist: ReturnType<typeof import("./checklist.js").createChecklistRenderer> }
}

declare module "../../core/kernel/types" {
  interface PlaceEntries { "thread.head": ThreadHead }
}
