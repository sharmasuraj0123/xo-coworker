import type { ReviewQuestion, ReviewRecord } from "../platform/review-response-types.d.ts";

export type ToolName = string | string[] | { server?: string; tool?: string };

export interface ReviewDetail {
  questions?: ReviewQuestion[];
  kind?: string;
  command?: string;
  paths?: string[];
  url?: string;
  mcp?: ToolName;
  diff?: string;
  plan?: string;
  changes?: { path?: string; diff?: string }[];
  more?: number;
  schedule?: string;
  job?: { agent?: string; model?: string };
  first_task?: string;
}

export interface ReviewDescription extends Pick<ReviewRecord, "options" | "title" | "risk" | "origin" | "parked" | "risk_reasons"> {
  kind?: string;
  detail?: ReviewDetail;
  why?: string | null;
  risk_groups?: { kind?: string | null; text: string; count?: number }[];
  limit?: { threads?: unknown[] };
}
