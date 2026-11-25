export type { Runtime, RuntimeError, RuntimeHealth, RuntimePolicy } from "../platform/runtime-response-types.d.ts";

export interface UsageItem {
  kind?: string;
  title?: string;
  why?: string;
  detail?: {
    limit?: string;
    move_to?: string | null;
    resets_at?: string | null;
    threads?: { chat_id: string }[];
  } | null;
  options?: { decision?: string; label?: string }[];
}
