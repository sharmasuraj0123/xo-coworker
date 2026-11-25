import type { WorldState, WorldThread } from "../world/state-types.d.ts";
import type { ChatRecord, MessageRecord, SessionRecord } from "../../platform/chat-response-types.d.ts";

export type Row = import("../world/sessions.js").Row;
export type MessageRow = Omit<MessageRecord, "seq"> & { seq?: number | null };
export type HopRow = import("../world/hop-types.d.ts").Hop;
export type Frame = { type: string; id?: string | null; envelope?: Row };
export interface StormEvent {
  kind: string;
  at?: number;
  project?: string | null;
  thread?: string | null;
  text?: string;
  session?: string;
  author?: string | null;
  answered?: boolean;
  id?: string | null;
  slug?: string | null;
  change?: string | null;
  version?: string | null;
  wakes?: string[];
  runs?: number;
  to?: string;
  agent?: string;
  by?: string | null;
  type?: string;
  data?: Record<string, unknown>;
  value?: unknown;
}
export type Sent = { at: number; seq: number | null };
export type Session = Omit<SessionRecord, "seq"> & {
  seq?: number | null;
  statusAt?: number;
  statusSeq?: number | null;
  frameSeq?: number | null;
  readAt?: number;
  sub?: boolean;
  permission_mode?: string | null;
};
export type Project = Pick<ChatRecord, "id" | "pin"> & { chatId: string; hasChat?: boolean };
export type ClosedReview = { state: "withdrawn" | "expired"; reason: string | null; why: string; at: number };

export type Reducer = (ctx: Ctx, env: Row, d: Row, tid: string | null, type: string) => void;

export interface Watched {
  projects: Set<string>;
  thread: string | null;
  side: string | null;
  session: string | null;
}

/** What the storm parts share: the world's state, its private records, and each part's functions. */
export interface Ctx {
  noteMessageEdit: (key: string, data: Row, at: string | null, reaction: boolean) => void;
  state: WorldState;
  scope: ReturnType<typeof import("../../kernel/scope.js").createScope>;
  readonly reads: Ctx["scope"];
  renewReads: () => Ctx["scope"];
  emit: () => void;
  event: (e: StormEvent) => void;
  chatProject: Map<string, string | null>;
  rawThreads: ReadonlyMap<string, Row>;
  threadRecords: ReturnType<typeof import("./thread-reads.js").createThreadRecords>;
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
  uiThread: (r: Row, project: string, runsBy?: Map<string, Row[]>) => WorldThread;
  runsBySession: () => Map<string, Row[]>;
  commit: () => void;
  soon: () => void;
  emitSoon: () => void;

  noteChat: (chat: Row) => void;
  loadChats: () => Promise<void>;
  maybeChats: () => void;
  loadThreads: (p: Project) => Promise<void>;
  loadStatus: () => Promise<void>;
  poolsSig: () => string;
  refreshRuntimes: () => Promise<void> | null;
  loadRuntimes: () => Promise<void>;
  loadPaid: () => Promise<void>;
  loadSpacePolicy: () => Promise<void>;
  loadChatPolicy: (chat: string | null | undefined, fresh?: boolean) => Promise<void> | null;
  loadPolicies: () => Promise<void>;
  loadActive: () => Promise<void>;
  loadAll: () => Promise<void>;
  refetchThread: (chatId: string | null | undefined, ts: string) => Promise<void>;
  fillSession: (chatId: string | null | undefined, ts: string) => Promise<void>;
  scheduleRecover: (ms?: number) => void;
  recover: () => Promise<void>;
  addRows: (project: string, rows: MessageRow[]) => MessageRow[];
  loadTimeline: (project: string) => Promise<void>;
  loadOlder: (project: string) => Promise<void>;
  loadThread: (ts: string) => Promise<void>;
  loadOlderThread: (ts: string) => Promise<void>;
  loadTurns: (session: string) => Promise<void>;
  noteControl: (env: Row, d: Row) => boolean;
  findRows: (project: string, ids: string[], beforeSeq?: number | null) => void;
  clearSought: () => void;

  putHop: (h: HopRow, extra: Row) => void;
  holdMove: (id: string, st: string) => void;
  hopsSoon: (ts: string) => void;
  hopsOnce: (ts: string) => Promise<void> | undefined;
  loadChatHops: (project: string) => Promise<void>;

  apply: (f: Frame) => void;
  settleAwaiting: (chatId: string | null) => void;
}
