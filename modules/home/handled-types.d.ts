export interface HeldNeed {
  key: string;
  t: { project: string };
  heldWhy?: string;
}

export interface HandledParts<N extends HeldNeed> { held: N[] }

export type WorkingThread = Pick<import("../../core/services/world/state-types.d.ts").WorldThread,
  "id" | "project" | "title" | "checklist" | "state" | "busy" | "session" | "sessionId">;

export interface HandledDeps<N extends HeldNeed> {
  world: { state: { threads: WorkingThread[] } };
  homeParts: () => HandledParts<N>;
  isBusy: (thread: WorkingThread) => boolean;
  num: (value: number) => string;
  PROJ: (project: string) => string;
  threadMark: (thread: WorkingThread, options: { lead: boolean }) => string;
  askTitle: (need: N) => string;
}
