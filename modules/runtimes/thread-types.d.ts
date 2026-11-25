import type { canMove } from "../../core/services/runtimes.js";

type Hold = NonNullable<Parameters<typeof import("../../core/services/world/held.js").heldWords>[0]>;

type Session = Pick<import("../../core/services/world/state-types.d.ts").WorldSession, "agent" | "model" | "effort">;
export type AgentThread = { sessionId?: string | null; session?: Session | null };

export interface RuntimeThread extends AgentThread {
  state?: string;
  busy?: boolean;
  project: string;
  held?: Hold | null;
  limits?: { limit?: { resetsAt?: string | null } }[];
  movedTo?: object | string | null;
}

export interface ThreadRuntimeDeps {
  world: {
    state: { sessions: Record<string, Session>; runtimes: Parameters<typeof canMove>[2] };
    act: { storm?: boolean; policyFor?: (project: string) => Parameters<typeof canMove>[1] };
  };
  SHAPE: { on: (feature: string) => boolean };
  isHeld: (thread: RuntimeThread) => thread is RuntimeThread & { held: Hold };
}
