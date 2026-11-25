export interface ReviewOption {
  decision: string;
  id?: string;
  label?: string;
  scope?: string;
  sentence?: string;
  hold_to_confirm?: boolean;
  note?: boolean;
  why?: string | null;
  answer?: string;
}

export interface QuestionOption {
  label: string;
  description?: string;
  cost?: string;
  recommended?: boolean;
}

export interface ReviewQuestion {
  id?: string;
  header?: string;
  question?: string;
  options?: QuestionOption[];
  multi?: boolean;
  secret?: boolean;
}

export type DecisionBody = {
  decision: string;
  option?: string;
  answer?: string | Record<string, string | string[]>;
  note?: string;
  scope?: string;
  rule_sentence?: string;
  idempotency_key?: string;
};

export interface ReviewRecord {
  id: string;
  state: string;
  kind?: string;
  origin?: string | null;
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
  detail?: Record<string, unknown> & {
    questions?: ReviewQuestion[];
    limit?: string;
    move_to?: string | null;
    resets_at?: string | null;
    threads?: { chat_id: string; ts?: string; title?: string }[];
  };
  options?: ReviewOption[];
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
