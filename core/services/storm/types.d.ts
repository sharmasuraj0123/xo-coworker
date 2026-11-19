export type Row = Record<string, any>;
export type Frame = { type: string; id?: string | null; envelope?: Row };
export type StormEvent = Row & { kind: string };
export type Sent = { at: number; seq: number | null };
export type Session = Row & { id: string };
export type Project = Row & { id: string; chatId: string | null };

export interface StormState extends Row {
  projects: Project[];
  threads: Row[];
  loaded: boolean;
  lastSeq: number;
  sessions: Record<string, Session>;
  review: Map<string, Row>;
  runs: Map<string, Row>;
  hops: Map<string, Row>;
  turns: any;
  pools: Record<string, Row>;
}

export type Reducer = (ctx: Ctx, env: Row, d: Row, tid: string | null, type: string) => void;

export interface Watched {
  projects: Set<string>;
  thread: string | null;
  side: string | null;
  session: string | null;
}

/** What the storm parts share: the world's state, its private records, and each part's functions. */
export interface Ctx {
  state: StormState;
  emit: () => void;
  event: (e: StormEvent) => void;
  chatProject: Map<string, string | null>;
  rawThreads: Map<string, Row>;
  watched: Watched;
  trimmed: Set<string>;
  framesBefore: Map<string, number | null>;
  holding: boolean;
  poolsSeen: boolean;

  projectOf: (chatId: string | null | undefined) => string | null;
  chatIdOf: (project: string) => string | null;
  isWatched: (ts: string | null | undefined) => boolean;
  coordinatorOf: (chat: string | null) => Session | null;
  sentAt: () => Sent;
  sessRead: (x: Row | null | undefined, sent: Sent) => Row;
  sessionNow: (sid: string | null, r?: Row | null) => Session | null;
  evidenceOf: (sid: string, runs?: Row[] | null) => Row;
  onTurn: (s: Session | null) => boolean;
  heldOfSession: (s: Session | null, runs?: Row[] | null) => Row | null;
  agentPool: (agent: string | null | undefined) => string | null;
  threadBusy: (r: Row, now: Session | null, runsBy: Map<string, Row[]>) => boolean;
  noteSession: (s: Row, sent?: Sent) => void;

  indexMoves: () => void;
  chatPolicyOf: (chat: string | null) => Row | null;
  uiThread: (r: Row, runsBy?: Map<string, Row[]>) => Row;
  runsBySession: () => Map<string, Row[]>;
  commit: () => void;
  soon: () => void;
  emitSoon: () => void;

  setProjects: (chats: Row[]) => void;
  loadChats: () => Promise<void>;
  maybeChats: () => void;
  loadThreads: (p: Project) => Promise<void>;
  loadStatus: () => Promise<void>;
  poolsSig: () => string;
  refreshRuntimes: () => Promise<void> | null;
  loadRuntimes: () => Promise<void>;
  loadPaid: () => Promise<void>;
  loadPolicies: () => Promise<void>;
  loadAll: () => Promise<void>;
  refetchThread: (chatId: string | null | undefined, ts: string) => Promise<void>;
  scheduleRecover: (ms?: number) => void;
  recover: () => Promise<void>;
  stopTimers: () => void;

  addRows: (project: string, rows: Row[]) => Row[];
  loadTimeline: (project: string) => Promise<void>;
  loadOlder: (project: string) => Promise<void>;
  loadThread: (ts: string) => Promise<void>;
  loadOlderThread: (ts: string) => Promise<void>;
  loadTurns: (session: string) => Promise<void>;
  noteControl: (env: Row, d: Row) => boolean;
  findRows: (project: string, ids: string[], beforeSeq?: number | null) => void;
  clearSought: () => void;

  putHop: (h: Row, extra: Row) => void;
  holdMove: (id: string, st: string) => void;
  hopsSoon: (ts: string) => void;
  hopsOnce: (ts: string) => Promise<void> | undefined;
  loadChatHops: (project: string) => Promise<void>;

  apply: (f: Frame) => void;
  settleAwaiting: (chatId: string | null) => void;
}
