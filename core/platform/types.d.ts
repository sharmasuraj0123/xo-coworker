export interface SSEFrame { event: string; data: string; id: string | null; lastId: string | null }
export interface StreamFrame { type: string; id: string | null; envelope: unknown }
export type StreamState = "connecting" | "live" | "reconnecting" | "down" | "closed";
export type StateInfo = { code: string; message: string; status?: number } | { reset: string } | null;
export interface Reset { reason?: string; from_seq?: number | string | null }
export interface StreamOptions {
  headers?: () => Record<string, string>;
  lastId?: string | null;
  onFrame?: (frame: StreamFrame) => void;
  onState?: (state: StreamState, info: StateInfo) => void;
  onReset?: (reset: Reset) => Promise<unknown> | void;
  onError?: (error: unknown) => void;
  fetchImpl?: typeof fetch;
}
