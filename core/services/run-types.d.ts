export interface Run {
  id: string;
  state: string;
  title?: string;
  kind: string;
  agent_type?: string;
  last_activity_at?: string;
  last_tool?: string;
  summary?: string | null;
  tool_calls?: number;
  tokens?: number;
  started_at?: string;
  ended_at?: string;
  can_stop?: boolean;
  children?: Run[];
}

export interface StoredRun extends Run {
  session: string;
  parent?: string | null;
  background?: boolean;
  depth?: number;
  model?: string | null;
  spawn?: string | null;
  hidden?: boolean;
  stopping?: boolean;
  status?: string | null;
  stopped_by?: string | null;
  seen?: number;
  seenSeq?: number | null;
}
