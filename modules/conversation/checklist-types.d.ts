import type { WorldThread } from "../../core/services/world/state-types.d.ts";

type ChecklistThread = Pick<WorldThread, "id" | "state" | "stop" | "branch" | "checklist" | "sessionId" | "session">;

export type ChecklistNeed = { t: { id: string } };
export type ChecklistHead = HTMLElement;

export type ChecklistDeps = {
  view(): string;
  scope: ReturnType<typeof import("../../core/kernel/scope.js").createScope>;
  SHAPE: { on(key: string): boolean };
  convThread(view: string): ChecklistThread | null;
  places: import("../../core/kernel/types.d.ts").Places;
  schedule(): void;
};

export interface ThreadHead {
  id: string;
  render(thread: ChecklistThread): string;
}
