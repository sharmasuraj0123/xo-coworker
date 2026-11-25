export type { Run } from "../../core/services/run-types.d.ts";
export type { Ancestry, RunCounts, TranscriptItem } from "../../core/platform/run-response-types.d.ts";

export interface Said { key: string; kind: string; text: string; sub?: string }

export interface SheetStop { key: string; what: string }
