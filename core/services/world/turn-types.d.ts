import type { SharedFile } from "../media/types.d.ts";

export type TurnStep = {
  kind: string;
  status: string;
  waiting?: boolean;
  pending?: boolean;
  tool?: string;
  target?: string;
  line?: string;
  summary?: string;
  call_id?: string;
  output?: string;
  progress?: { tool_calls?: number; duration_ms?: number };
};

export type TurnBlock = {
  id: string;
  type: string;
  done?: boolean;
  header?: string;
  started_at?: string;
  steps?: string[];
  rows?: TurnStep[];
  items?: { state: string; text?: string }[];
  files?: SharedFile[];
  caption?: string;
  text?: string;
  seq?: number | null;
};

export type StoredTurnBlock = TurnBlock & { index?: number | null; n: number };

export type Turn = {
  id: string;
  session: string | null;
  chat: string | null;
  thread: string | null;
  seq: number | null;
  at: string | null;
  origin: string | null;
  wakes: string[];
  status: string;
  end: { wall_ms?: number; reason?: string; error?: unknown } | null;
  blocks: Map<string, StoredTurnBlock>;
  lastSeq: number;
  held?: string[];
  selfEnded?: boolean;
  stopped?: { by?: string; last_step?: string } | null;
};
