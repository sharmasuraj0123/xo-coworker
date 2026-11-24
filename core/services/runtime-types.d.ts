export interface RuntimeError {
  code?: string;
  message?: string;
}

export interface UsageWindow {
  state?: string;
  utilization?: number | null;
  resets_at?: string | null;
}

export interface RuntimeHealth {
  installed?: boolean;
  logged_in?: boolean;
  cli_version?: string | null;
  checked_at?: string | null;
  account?: string | null;
  pool?: string | null;
  usable?: boolean;
  why_not?: string;
  error?: RuntimeError | null;
  limit?: string;
  resets_at?: string | null;
  windows?: Record<string, UsageWindow | null>;
}

export interface RuntimeFeature { values?: string[]; support?: string; behaviour?: string | null }

export interface Runtime {
  name: string;
  default?: boolean;
  cli?: { version?: string | null; logged_in?: boolean; account?: string | null } | null;
  health?: RuntimeHealth | null;
  features?: { features?: Record<string, RuntimeFeature | undefined> };
  error?: RuntimeError | string | null;
}

export interface RuntimePolicy {
  allowed?: string[] | null;
  default?: string | null;
  fallback?: boolean | null;
  preferences?: string | null;
}

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
