import type { Run } from "../../core/services/run-types.d.ts";
export type { Run } from "../../core/services/run-types.d.ts";

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
