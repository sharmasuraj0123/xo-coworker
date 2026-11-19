export interface SSEFrame { event: string; data: string; id: string | null; lastId: string | null }
export interface StreamFrame { type: string; id: string | null; envelope: any }
export type StreamState = "connecting" | "live" | "reconnecting" | "down" | "closed";
export type StateInfo = { code: string; message: string; status?: number } | { reset: string } | null;
export interface Reset { reason?: string; from_seq?: number | string | null }
