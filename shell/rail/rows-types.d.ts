export type Hold = NonNullable<Parameters<typeof import("../../core/services/world/held.js").heldWords>[0]>;

interface SideThread {
  project: string;
  state: string;
  host?: boolean;
  held?: Hold | null;
  busy?: boolean;
}

export interface SideNeed {
  admitted?: boolean;
  later?: boolean;
  group: string;
  risk?: string;
  t: Pick<SideThread, "project" | "host">;
}

export interface SideRowsDeps<N extends SideNeed> {
  view: () => string;
  world: {
    state: { threads: SideThread[] };
    act: { coordinatorBusy: (project: string) => unknown; coordinatorHeld?: (project: string) => Hold | null };
  };
  CH: { isChats: (view: string) => boolean };
  D: { needItems: () => N[] };
  projects: () => { id: string; name: string }[];
  convThread: (view: string) => { project: string } | null | undefined;
  isBusy: (thread: SideThread) => boolean;
  isHeld: (thread: SideThread) => boolean;
  askShort: (need: N) => string;
  projectIcon: (project: string) => string;
  folded: () => boolean;
}
