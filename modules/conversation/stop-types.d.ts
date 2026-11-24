export type Thread = { title: string };
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

type TurnStop = PendingStop & { session: string; turn: string | null };
type Focus = () => HTMLElement | null;

type Notice = {
  kind: "halt" | "stopped";
  text: string;
  sub: string;
  tag?: string;
  back?: Focus[];
  undo?: () => void;
  undoLabel?: string;
};

export type StopDeps = {
  S: { view: string; stops: Map<string, TurnStop>; herald: { tag?: string; until: number } | null };
  world: { act: { turnOf(session: string): string | null; stop(session: string): Promise<{ stopped?: boolean } | null> } };
  Kit: { COMMIT_MS: number };
  PROJ: (id: string | null) => string | null;
  announce: (text: string) => void;
  schedule: () => void;
  chatOf: (view: string) => string | null;
  pendingStops: PendingStop[];
  heraldShow: (notice: Notice, ms: number) => void;
  heraldNext: () => void;
  inUse: (selector: string) => Focus;
  running: (view: string) => Run | null;
  workingRuns: (thread: Thread) => number;
};
