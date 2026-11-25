import type { Router } from "./runtime-response-types.d.ts";

export interface CursorPage {
  next_after_seq?: number | null;
  next_before_seq?: number | null;
}

export interface Pin {
  agent?: string | null;
  model?: string | null;
  effort?: string | null;
}

export interface Seen {
  seen_at: string;
  seen_seq?: number | null;
}

export interface ChatRecord {
  id: string;
  kind?: string;
  project_pid?: string | null;
  project?: string | null;
  created_at?: string | null;
  retired_at?: string | null;
  settings?: Record<string, unknown>;
  routing?: Router | null;
  pin?: Pin | null;
  seen?: Seen | null;
}

export interface SessionFields extends Pin {
  state?: string;
  busy?: boolean;
  live_runs?: number;
  paused?: unknown;
  waiting?: unknown;
}

export interface SessionRecord extends SessionFields {
  id: string;
  chat_id?: string | null;
  thread_ts?: string | null;
  role?: string;
  preset?: string;
  pool?: string | null;
  cwd?: string | null;
  native_id?: string | null;
  epoch?: number;
  seq?: number;
  retired_at?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface ThreadRecord {
  ts: string;
  chat_id?: string;
  title?: string | null;
  label?: string | null;
  resolved_at?: string | null;
  session_id?: string | null;
  session?: SessionFields | null;
  cwd?: string | null;
  branch?: string | null;
  worktree_path?: string | null;
  base_commit?: string | null;
  status_md?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  summary?: string | null;
  state?: string;
  busy?: boolean;
  can_delete?: boolean;
  pin?: Pin | null;
}

export interface MessageRecord {
  id: string;
  seq?: number;
  chat_id?: string;
  thread_ts?: string | null;
  author_kind?: string;
  author_id?: string;
  author_session_id?: string | null;
  client_id?: string | null;
  text?: string;
  reply_to?: string | null;
  extra?: Record<string, unknown> | null;
  created_at?: string;
}

export interface ObservedMessage {
  id: string;
  time_created: string;
  data?: { role?: string };
  parts?: { data?: { type?: string; text?: string } }[];
}

export interface ObservedPage {
  total?: number;
  offset?: number;
  messages: ObservedMessage[];
}

export interface PromptReceipt {
  session_id: string;
  turn_id?: string | null;
  stream_id?: string;
}

export interface AbortReceipt {
  session_id: string;
  turn_id?: string | null;
  stopped: boolean;
}

export interface ThreadDeletion {
  deleted: true;
  undo_until?: string;
}

export interface ThreadContinuation {
  thread_id: string;
  agent?: string | null;
}

export interface StoredFrame {
  type: string;
  id?: string | null;
  seq?: number | null;
  ts?: string | null;
  chat_id?: string | null;
  session_id?: string | null;
  thread_ts?: string | null;
  turn_id?: string | null;
  run_id?: string | null;
  data?: Record<string, unknown> | null;
}

export interface ActiveTurn {
  session_id: string;
  turn_id: string;
  chat_id?: string | null;
  thread_ts?: string | null;
  started_at?: string | null;
  origin?: string | null;
  agent?: string | null;
  role?: string | null;
}

export interface HopRecord {
  id: string;
  chat_id?: string;
  thread_ts?: string | null;
  kind?: string | null;
  from_role?: string | null;
  to_role?: string | null;
  from_session?: string | null;
  to_session?: string | null;
  state?: string | null;
  via?: string[];
  message_ids?: string[];
  created_at?: string | null;
  delivered_at?: string | null;
  answered_at?: string | null;
  note?: string | null;
  cause?: string | null;
  wake_id?: string | null;
  seq?: number | null;
}
