import type { ClosedReview, HopRow, MessageRow, Project, Row, Session, StormEvent } from "../storm/types.d.ts";
import type { EngineStatus, StatusPool } from "../../platform/status-types.d.ts";
import type { createTurns } from "./turns.js";
import type { tasksOf } from "./checklist.js";
import type { stopOf, stormAsks } from "./threads.js";
import type { Hold } from "./held.js";
import type { Runtime, RuntimePolicy } from "../runtime-types.d.ts";
import type { accountRows, heldModes } from "./paid.js";
import type { uiMsg } from "./rows.js";
import type { StoredRun } from "../run-types.d.ts";

export interface WorldRouter { mode?: string; decision_model?: string | null; abstain_below?: number }
interface Policy { space?: RuntimePolicy; project?: RuntimePolicy; effective?: RuntimePolicy }
type AccountSources = Parameters<typeof accountRows>[0];

interface WorldProject extends Project {
  name: string;
  kind: string;
  pid?: string | null;
  routing: WorldRouter | null;
}

export interface WorldThread extends Row {
  id: string;
  project: string;
  title: string;
  state: string;
  chatId: string;
  branch: string | null;
  worktree: string | null;
  cwd: string | null;
  sessionId: string | null;
  session: Pick<WorldSession, "agent" | "model" | "effort"> & { live_runs?: number } | null;
  busy: boolean;
  held: Hold | null;
  frozen: boolean;
  loaded: boolean;
  lastAt: number;
  createdAt: number;
  checklist: ReturnType<typeof tasksOf>;
  stop: ReturnType<typeof stopOf>;
  asks: ReturnType<typeof stormAsks>;
  messages: ReturnType<typeof uiMsg>[];
  summary: string | null;
  label: string | null;
  happened: string;
  runs: { running?: number; waiting?: number; total?: number } | null;
}

export interface DecisionHost extends Row {
  id: string;
  project: string;
  title: string;
  state: "needs_approval";
  host: true;
  chatId: string | null;
  plainSession: string | null;
  asks: ReturnType<typeof stormAsks>;
  lastAt: number;
  createdAt: number;
  checklist: ReturnType<typeof tasksOf>;
}

export interface WorldSession extends Session {
  agent?: string | null;
  model?: string | null;
  effort?: string | null;
  role?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
}

interface MessageHistory {
  all?: boolean;
  loading?: boolean;
  loaded?: boolean;
  error?: string | null;
  before?: number | null;
  older?: boolean;
  olderError?: string | null;
  paged?: boolean;
}

export interface WorldState {
  projects: WorldProject[];
  threads: WorldThread[];
  hosts: DecisionHost[];
  activity: StormEvent[];
  error: string | null;
  errorCode?: string | null;
  now: number;
  router: WorldRouter | null;
  runtimes: Runtime[] | null;
  policy: Policy | null;
  chatPolicy: Record<string, Policy>;
  advisory: AccountSources["advisory"];
  paidPools: NonNullable<AccountSources["served"]>;
  paid: Parameters<typeof heldModes>[0];
  paidOk: boolean;
  sessions: Record<string, WorldSession>;
  hops: Map<string, HopRow>;
  runs: Map<string, StoredRun>;
  turns: ReturnType<typeof createTurns>;
  hist: Record<string, MessageHistory | undefined>;
  threadHist: Record<string, MessageHistory | undefined>;
  timeline: Record<string, MessageRow[] | undefined>;
  found: Record<string, Map<string, MessageRow> | undefined>;
  routed: Record<string, { chat: string; messageId: string }[] | undefined>;
  controls: Record<string, { action: string; at: string; seq?: number | null; by?: string; reason?: string }[] | undefined>;
  busy: Record<string, boolean>;
  status: EngineStatus | null;
  pools: Record<string, Omit<StatusPool, "id"> & { pool: string }>;
  loaded: boolean;
  lastSeq: number;
  review: Map<string, Row>;
  gone: Map<string, ClosedReview>;
  statusError: string | null;
  statusCode?: string | null;
  conn: string;
  connInfo: unknown;
  threadMsgs: Record<string, MessageRow[] | undefined>;
  moves: Record<string, { to?: string; at: string; text?: string } | undefined>;
  awaiting: Record<string, { id: string; at: number } | undefined>;
  failed: Record<string, { id: string; at: number; error: string } | undefined>;
  liveRuns: Record<string, { running: number; waiting: number; tokens: number; at: number; seq: number | null }>;
}
