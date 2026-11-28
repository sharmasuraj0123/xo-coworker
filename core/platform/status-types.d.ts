export interface StatusPool {
  id: string;
  state?: string | null;
  resets_at?: string | null;
  reason?: string | null;
  windows?: Record<string, import("./runtime-response-types.d.ts").UsageWindow | null>;
}

export interface EngineStatus {
  pools?: StatusPool[];
}
