export interface RunRecord {
  id: string;
  state: string;
  kind: string;
  title?: string | null;
  agent_type?: string | null;
  last_activity_at?: string | null;
  last_tool?: string | null;
  summary?: string | null;
  tool_calls?: number | null;
  tokens?: number | null;
  started_at?: string | null;
  ended_at?: string | null;
  can_stop?: boolean;
  children?: RunRecord[];
  parent_run_id?: string | null;
  spawn_call_id?: string | null;
  background?: boolean;
  depth?: number;
}

export interface RunCounts {
  running?: number;
  waiting?: number;
  done?: number;
  failed?: number;
  stopped?: number;
  lost?: number;
  total?: number;
  tokens?: number;
}

export interface RunList {
  runs: RunRecord[];
  counts?: RunCounts;
  next_after_seq?: number | null;
}

export interface Ancestry {
  chat?: { kind?: string | null; name?: string | null; project_pid?: string | null } | null;
  thread?: { title?: string | null } | null;
  runs?: RunRecord[];
}

export interface RunDetail extends RunRecord {
  ancestry?: Ancestry | null;
}

export interface TranscriptItem {
  id: string;
  type: string;
  text?: string | null;
  call_id?: string | null;
  kind?: string | null;
  status?: string | null;
  steps?: string[];
  duration_ms?: number | null;
  title?: string | null;
  tool?: string | null;
  target?: string | null;
  plan?: { state: string; text?: string | null }[];
  truncated?: boolean;
  bytes?: number | null;
}

export interface RunTranscript {
  items: TranscriptItem[];
  next?: string | null;
}

export interface RunStopResult {
  stopping?: boolean | string[] | null;
}
