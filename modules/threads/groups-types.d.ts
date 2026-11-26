import type { WorldThread } from "../../core/services/world/state-types.d.ts";

export type ThreadGroup = "needs" | "working" | "waiting" | "done";
type ThreadRowFields = "id" | "project" | "state" | "lastAt" | "title" | "busy" | "frozen" | "held" | "stop" | "summary" | "branch";
export type ThreadInfo = Pick<WorldThread, ThreadRowFields | "sessionId" | "session">;

export interface ThreadNeed {
  t: { id: string, project?: string, host?: boolean };
  admitted?: boolean;
  group?: string;
}

export interface MapAgent {
  go: string;
  doing: string;
  since: number | null;
  color?: string;
}

export interface ThreadRow {
  go: string;
  title: string;
  state: ThreadGroup;
  word: string;
  sub: string;
  since: number | null;
  color?: string;
  on: boolean;
  coord?: boolean;
  mark?: string;
  summary?: string | null;
  branch?: string | null;
  at?: string;
}

export interface ThreadGroupDeps<N extends ThreadNeed> {
  world: { state: { threads: ThreadInfo[] } };
  D: { needItems: () => N[] };
  MAP: { agents: (view: string) => MapAgent[] };
  convProject: (view: string) => string | null | undefined;
  PROJ?: (project: string) => string;
  askShort: (need: N) => string;
  threadMark: (thread: ThreadInfo) => string;
  isBusy: (thread: ThreadInfo) => boolean;
  isHeld: (thread: ThreadInfo) => boolean;
}
export type GroupLabels = Record<ThreadGroup, string>;

declare module "../../core/kernel/types" {
  interface Services { threadGroups: ReturnType<typeof import("./groups.js").createThreadGroups> }
}
