export interface Run {
  id: string;
  state: string;
  title?: string;
  kind: string;
  agent_type?: string;
  last_activity_at?: string;
  last_tool?: string;
  summary?: string;
  tool_calls?: number;
  tokens?: number;
  started_at?: string;
  ended_at?: string;
  can_stop?: boolean;
  children?: Run[];
}

export interface RunCounts { running?: number; waiting?: number; done?: number; failed?: number; stopped?: number }

export interface Said { key: string; kind: string; text: string; sub?: string }

export interface SheetStop { key: string; what: string }

export interface Ancestry {
  chat?: { kind?: string; name?: string; project_pid?: string } | null;
  thread?: { title?: string } | null;
  runs?: Run[];
}

export interface TranscriptItem {
  id: string;
  type: string;
  text?: string;
  call_id?: string;
  kind?: string;
  status?: string;
  steps?: string[];
  duration_ms?: number;
  title?: string;
  tool?: string;
  target?: string;
  plan?: { state: string; text?: string }[];
  truncated?: boolean;
  bytes?: number;
}
