export type ThreadGroup = "needs" | "working" | "waiting" | "done";
type Hold = Parameters<typeof import("../../core/services/world/held.js").heldWords>[0];
type Stop = Parameters<typeof import("../../core/services/world/conversation.js").stopWords>[0];

export interface ThreadInfo {
  id: string;
  project: string;
  state: string;
  lastAt: number;
  title: string;
  busy?: boolean;
  frozen?: boolean;
  held?: Hold;
  stop?: Stop;
  summary?: string;
  branch?: string;
}

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
  summary?: string;
  branch?: string;
  at?: string;
}

export interface ThreadGroupDeps {
  world: { state: { threads: ThreadInfo[] } };
  D: { needItems: () => ThreadNeed[] };
  MAP: { agents: (view: string) => MapAgent[] };
  convProject: (view: string) => string | null | undefined;
  askShort: (need: ThreadNeed) => string;
  threadMark: (thread: ThreadInfo) => string;
  isBusy: (thread: ThreadInfo) => boolean;
  isHeld: (thread: ThreadInfo) => boolean;
}
