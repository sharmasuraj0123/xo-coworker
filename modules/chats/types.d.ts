import type { SetupState } from "./setup-types";
import type { Sent } from "../../core/services/storm/types.d.ts";
import type { Runtime } from "../../core/services/runtime-types.d.ts";
export type { Runtime } from "../../core/services/runtime-types.d.ts";
export interface Session {
  id: string;
  role?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
  retired_at?: string | null;
  native_id?: string | null;
  cwd?: string | null;
  agent?: string | null;
  model?: string | null;
  effort?: string | null;
  permission_mode?: string | null;
  statusAt?: number;
  statusSeq?: number | null;
}
export interface Prompt {
  id: string;
  at: number;
  text: string;
  status?: string;
  err?: string;
  errTitle?: string;
  /** Sent while a turn ran: that turn's id; the prompt waits until it ends. */
  waits?: string;
}
interface PromptBody {
  text: string;
  client_id: string;
  agent?: string;
  session_id?: string;
  model?: string;
  effort?: string;
  permission_mode?: string;
  cwd?: string;
  delivery?: "now" | "add";
  confirm_stop_runs?: number;
}
export interface LocalPrompt extends Prompt { cid: string; body: PromptBody }
export interface History {
  loading?: boolean;
  loaded?: boolean;
  turns?: boolean;
  again?: boolean;
  tried?: string | null;
  retry?: { native: string | null; at: number };
  user?: Prompt[];
  error?: string | null;
}

type Held = import("../../core/services/world/held.js").Hold;
type Turns = import("../../core/services/types.d.ts").Turns;
interface World {
  state: {
    sessions: Record<string, Session>;
    runtimes?: Runtime[] | null;
    projects: { id: string; name: string; kind: string }[];
    turns?: Turns;
  };
  ui?: { tbOpen?: Record<string, boolean> };
  project: (path: string) => { name?: string } | null | undefined;
  subscribe?: (callback: () => void) => (() => void) | void;
  onEvent: (callback: (event: { kind: string; session?: string; wakes?: string[] }) => void) => (() => void) | void;
  act: {
    sentAt: () => Sent;
    noteSession: (session: Session, sent: Sent) => void;
    sessionHeld?: (id: string) => Held | null;
    sessionBusy?: (id: string) => boolean;
    onTurn?: (id: string) => boolean;
    turnOf?: (id: string) => string | null;
    sessionState?: (id: string) => string | null;
    takeTrimmed?: (id: string) => boolean;
    loadTurns?: (id: string) => unknown;
    agentHeld?: (id: string | null) => ReturnType<typeof import("../../core/services/world/sessions.js").heldOf>;
  };
}
export interface ChatDeps {
  world: World;
  announce: (words: string) => void;
  heraldShow: (notice: { kind: string; text: string; sub?: string; undo?: () => boolean | undefined; undoLabel?: string }, ms: number) => void;
  go: (view: string) => void;
  schedule: () => void;
  view?: () => string;
  listRoot?: Element;
  transcriptOpen?: () => Readonly<Record<string, boolean>>;
  restore?: (text: string, options?: { force?: boolean }) => boolean;
  workspace?: () => WorkspaceSummary;
}
/** The Workspace as Chats shows it: how many projects it runs, how many threads work, whether its coordinator does. */
export interface WorkspaceSummary { projects: number; working: number; coordinator: boolean }
export interface Conversation {
  turnHtml: (turn: Turn, blocks: unknown[], options: { view: string; open?: Record<string, boolean> }) => string;
  turnAv: (turn: Turn, blocks: unknown[]) => string;
  chatOrder: (prompts: Prompt[], turns: Turn[]) => ({ kind: "you"; m: Prompt } | { kind: "turn"; t: Turn })[];
  cliName: (name?: string | null) => string;
  heldShort: (held: Held) => string;
  heldBadge: (held: Held) => string;
  rowTime: (iso: string) => string;
}
export interface ChatState extends SetupState {
  list: boolean | null;
  loading: boolean;
  err: string | null;
  hist: Map<string, History>;
  local: Map<string, LocalPrompt[]>;
  confirm: Map<string | null, { local: LocalPrompt; sid: string | null; count: number }>;
}
