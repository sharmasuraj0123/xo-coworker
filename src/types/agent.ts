/** Agent schemas — mirrors backend app/schemas/agent.py */

export interface PermissionRule {
  action: "allow" | "deny" | "ask";
  pattern: string;
}

export interface Ruleset {
  rules: PermissionRule[];
}

export type AgentBackend = "openclaw" | "claude_code" | "hermes";

/**
 * BE writes `metadata.backend` for every agent in the list response and
 * `metadata.hermes_profile` for hermes ones. Everything else is free-form
 * (workspace, display_name, ...). Cast through `AgentMetadata` for type
 * safety on the discriminator without re-typing every BE field.
 */
export interface AgentMetadata {
  backend?: AgentBackend;
  hermes_profile?: string;
  display_name?: string;
  workspace?: string;
  /** Authoritative session count from the backend's source-of-truth store
   *  (state.db / sessions.json). Use this in lists instead of grouping
   *  loaded sessions, which only counts what's been paginated in. */
  sessions_count?: number;
  [key: string]: unknown;
}

export interface AgentInfo {
  name: string;
  description: string;
  mode: "primary" | "subagent" | "hidden";
  tools: string[];
  permissions: Ruleset;
  system_prompt?: string | null;
  temperature?: number | null;
  metadata: AgentMetadata;
}

/** POST /api/agents — OpenClaw bridge */
export interface CreateAgentRequest {
  name: string;
  id?: string;
  description?: string;
  workspace?: string;
  backend?: AgentBackend;
}

/** GET/PATCH /api/agents/{id} — OpenClaw bridge (full snapshot) */
export interface AgentIdentityView {
  name: string | null;
  emoji: string | null;
  bio: string | null;
}

export interface AgentFullDetail {
  id: string;
  display_name: string;
  description: string;
  workspace: string;
  model: string | null;
  model_raw: unknown;
  identity: AgentIdentityView;
  config_entry: Record<string, unknown>;
  agents_defaults: Record<string, unknown>;
  workspace_files: Record<string, string | null>;
  on_disk: {
    agent_dir: string;
    models_catalog: unknown;
    auth_state: unknown;
    auth_profiles: unknown;
  };
  sessions: {
    index_path: string;
    count: number;
    /** Total messages across all sessions — hermes-only; absent for openclaw. */
    message_count?: number;
    session_ids: string[];
  };
  openclaw_global_auth: Record<string, { provider?: unknown; mode?: unknown; credentials?: string }>;
}

export interface UpdateAgentRequest {
  name?: string;
  description?: string;
  workspace?: string;
  model?: string | null;
  identity_name?: string | null;
  identity_emoji?: string | null;
}
