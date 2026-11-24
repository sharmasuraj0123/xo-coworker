export type ToolName = string | string[] | { server?: string; tool?: string };

export interface ReviewDetail {
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

export interface ReviewDescription {
  kind: string;
  detail?: ReviewDetail;
  why?: string;
  risk_groups?: { kind?: string | null; text: string; count?: number }[];
  limit?: { threads?: unknown[] };
}
