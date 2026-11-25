export interface ReviewRecord {
  id: string;
  state: string;
  kind?: string;
  created_at?: string | null;
  expires_at?: string | null;
  title?: string | null;
  why?: string | null;
  risk?: string | null;
  chat_id?: string | null;
  thread_ts?: string | null;
  session_id?: string | null;
  run_id?: string | null;
  turn_id?: string | null;
  seq?: number;
  epoch?: number | null;
  blocking?: boolean;
  parked?: boolean;
  detail?: Record<string, unknown>;
  options?: Record<string, unknown>[];
  annotations?: { by: string; note: string }[];
  risk_reasons?: string[];
  risk_groups?: { kind?: string | null; text: string; count?: number }[];
  decision?: { decision?: string; idempotency_key?: string } | null;
}

export interface ReviewPage {
  items: ReviewRecord[];
  next_after_seq?: number | null;
}

export interface Rule {
  id: string;
  sentence?: string;
  scope?: string;
  project_pid?: string | null;
  thread_ts?: string | null;
  effect?: string;
  tier?: string | null;
  uses?: number;
  created_at?: string;
  revoked_at?: string | null;
}

export interface RuleBatch {
  rules: Rule[];
  defaults?: Rule[];
  next_after_seq?: number | null;
}
