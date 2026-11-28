import type { RunRecord } from "../platform/run-response-types.d.ts";

export type Run = RunRecord;

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
