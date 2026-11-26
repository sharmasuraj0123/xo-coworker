export type { Runtime, RuntimeError, RuntimeHealth, RuntimePolicy } from "../platform/runtime-response-types.d.ts";

export interface UsageItem {
  kind?: string;
  title?: string | null;
  why?: string | null;
  detail?: {
    limit?: string;
    move_to?: string | null;
    resets_at?: string | null;
    threads?: { chat_id: string }[];
  } | null;
  options?: { decision?: string; label?: string }[];
}

export type LivePools = Record<string, { state?: string | null; resets_at?: string | null; windows?: RuntimeHealth["windows"] }>;
export interface SessionThread { id: string; title: string; where: string; go: string | null }
export interface SessionsState {
  threads: { id: string; title: string; project: string; sessionId?: string | null }[];
  projects?: { id: string; name: string; sessionId?: string | null }[];
}
