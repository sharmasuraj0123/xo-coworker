export type Thread = Pick<import("../../core/services/world/state-types.d.ts").WorldThread, "title" | "sessionId" | "session">;
export type Run =
  | { kind: "thread"; t: Thread; session: string }
  | { kind: "chat"; session: string }
  | { kind: "coord"; conv: string; session: string };

type PendingStop = {
  what: string;
  until: number;
  cancelled: boolean;
  sent: boolean;
  interrupt?: boolean;
};

export type TurnStop = PendingStop & { session: string; turn: string | null };
type Focus = () => HTMLElement | null;

type Notice = {
  kind: "halt" | "stopped";
  text: string;
  sub: string;
  tag?: string;
  back?: Focus[];
  undo?: () => void;
  undoLabel?: string;
  undoUntil?: number;
  undoMs?: number;
};

export type StopDeps = {
  world: { act: { turnOf(session: string): string | null; stop(session: string): Promise<{ stopped?: boolean } | null> } };
  Kit: { COMMIT_MS: number };
  PROJ: (id: string | null) => string | null;
  announce: (text: string) => void;
  schedule: () => void;
  chatOf: (view: string) => string | null;
  pendingStops: Pick<ReturnType<typeof import("../../core/services/run-stops.js").createPendingRunStops>, "pending" | "remove">;
  heraldShow: (notice: Notice, ms: number) => void;
  dismissStops: () => void;
  inUse: (selector: string) => Focus;
  running: (view?: string) => Run | null;
  workingRuns: (thread: Parameters<typeof import("../../core/services/world/run-count.js").workingRunCount>[0]
    & { sessionId?: string | null }) => number;
};
