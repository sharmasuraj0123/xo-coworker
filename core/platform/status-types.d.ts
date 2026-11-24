export interface StatusPool {
  id: string;
  state?: string | null;
  resets_at?: string | null;
  reason?: string | null;
}

export interface EngineStatus {
  pools?: StatusPool[];
}
