import type { Activity, ActivityRow, FileMark, Folder, Turns } from "../../core/services/types";
type Hold = Parameters<typeof import("../../core/services/world/held.js").heldWords>[0];

export interface MapThread {
  id: string;
  title: string;
  project: string;
  state: string;
  sessionId?: string | null;
  held?: Hold;
  worktree?: string | null;
  cwd?: string | null;
}

export interface MapStep extends ActivityRow {
  line?: string;
  tool?: string;
}

export interface MapAgent {
  id: string;
  title: string;
  go: string;
  project: string;
  fold: Omit<Folder, "projectRoot"> | null;
  act: Activity;
  now: MapStep | null;
  liveFile: FileMark | null;
  path: string | null;
  spots: string[];
  prev: string | null;
  busy: boolean;
  waiting: boolean;
  since: number | null;
  color: string;
  held?: Hold;
  coord?: boolean;
}

export interface MapAgentDeps {
  world: {
    thread(id: string): MapThread | null | undefined;
    state: { turns?: Turns | null, projects: { id: string }[], threads: MapThread[] };
    act: { coordinatorBusy?: (project: string) => string | null | undefined };
  };
  isBusy: (thread: MapThread) => boolean;
  stepLineHtml: (text: string, kind: string) => string;
}

declare module "../../core/kernel/types" {
  interface Services { mapAgents: ReturnType<typeof import("./agents.js").createMapAgents> }
}
