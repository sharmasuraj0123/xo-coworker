import type { canMove } from "../../core/services/runtimes.js";

type Hold = NonNullable<Parameters<typeof import("../../core/services/world/held.js").heldWords>[0]>;

interface Session {
  agent?: string;
  model?: string;
  effort?: string;
}

export interface RuntimeThread {
  sessionId?: string;
  session?: Session | null;
  project: string;
  held?: Hold | null;
  limits?: { limit?: { resetsAt?: string } }[];
  movedTo?: string | null;
}

export interface ThreadRuntimeDeps {
  world: {
    state: { sessions: Record<string, Session>; runtimes: Parameters<typeof canMove>[2] };
    act: { storm?: boolean; policyFor?: (project: string) => Parameters<typeof canMove>[1] };
  };
  SHAPE: { on: (feature: string) => boolean };
  isHeld: (thread: RuntimeThread) => thread is RuntimeThread & { held: Hold };
}
