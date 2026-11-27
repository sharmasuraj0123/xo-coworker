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
  why_not?: string | null;
  error?: RuntimeError | null;
  limit?: string | null;
  resets_at?: string | null;
  windows?: Record<string, UsageWindow | null>;
}

export interface RuntimeFeature { values?: string[]; support?: string | null; behaviour?: string | null }

export type LifecycleAction = "install" | "update" | "uninstall" | "sign_out" | "sign_in";
export interface Lifecycle {
  name: string;
  state: "not_installed" | "installed" | "signed_in" | "checking" | "installing" | "updating" | "uninstalling" | "failed" | string;
  installed: boolean;
  signed_in: boolean | null;
  actions: string[];
  job?: string | null;
  version?: string | null;
  needs_update?: boolean;
  update?: string | null;
}

export interface Runtime {
  name: string;
  default?: boolean;
  lifecycle?: Lifecycle | null;
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

export interface Policies {
  space?: RuntimePolicy;
  project?: RuntimePolicy | null;
  effective: RuntimePolicy;
}

export interface RuntimeModel {
  id: string;
  name: string | null;
  family?: string | null;
  family_default?: boolean;
  description?: string | null;
  context_window?: number | null;
  is_default?: boolean;
  takes_effort?: boolean;
  efforts?: string[];
  default_effort?: string | null;
}

export interface Router {
  mode?: string;
  decision_model?: string | null;
  abstain_below?: number;
}

export interface RouterModel {
  id: string;
  label: string;
  connected: boolean;
  model?: string;
  docs_url?: string;
}
