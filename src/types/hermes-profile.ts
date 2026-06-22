/**
 * Response shapes for `/api/agents/hermes/{profile}/*` endpoints.
 * Mirrors `routers/cowork_agent/hermes_profile.py` on the BE.
 *
 * The basic agent detail (`/api/agents/{id}`) returns the same shape as
 * openclaw and stays typed as `AgentFullDetail` — these are the per-tab
 * shapes the unified detail can't carry.
 */

export type HermesGatewayProbe = "up" | "unauthorized" | "down" | "unknown";

export interface HermesGatewayEntry {
  profile?: string;
  port?: number | null;
  pid?: number | null;
  alive?: boolean;
  listening?: boolean;
  running?: boolean;
  started_at?: number | string | null;
}

export interface HermesGatewayStatus {
  profile: string;
  managed_by: "hermes.sh" | "pool";
  entry: HermesGatewayEntry;
  probe: HermesGatewayProbe;
}

export interface HermesGatewayActionResponse {
  ok: boolean;
  profile: string;
  status?: "started" | "stopped" | "restarted" | "error";
  gateway_url?: string;
  entry?: HermesGatewayEntry;
  output?: string;
  stopped?: boolean;
}

export interface HermesConfig {
  profile: string;
  config_file: string;
  config: Record<string, unknown>;
}

export interface HermesConfigSetBody {
  key: string;
  value: unknown;
}

export interface HermesConfigSetResponse {
  ok: boolean;
  profile: string;
  key: string;
  restart_required: boolean;
  output?: string;
}

export interface HermesChannelInfo {
  id: string;
  name: string;
  type: string;
  status: string;
  account: string | null;
}

export interface HermesChannelsResponse {
  profile: string;
  channels: Record<string, HermesChannelInfo>;
  gateway_running: boolean;
}

export interface HermesChannelAddBody {
  platform: string;
  /** Field values keyed by name (token, bot_token, app_token, etc.). */
  [field: string]: string;
}

export interface HermesChannelMutationResponse {
  ok: boolean;
  profile: string;
  platform: string;
  restart_required: boolean;
  provisioning: "started" | "skipped";
}

export type HermesProviderAuthType = "api_key" | "oauth";

export interface HermesProvider {
  provider_id: string;
  auth_type: HermesProviderAuthType;
  env_key: string | null;
  configured: boolean;
}

export interface HermesProvidersResponse {
  profile: string;
  providers: HermesProvider[];
}

export interface HermesProviderKeyBody {
  api_key: string;
}

export interface HermesProviderKeyResponse {
  ok: boolean;
  profile: string;
  provider: string;
  env_key: string;
  restart_required: boolean;
  provisioning: "started" | "skipped";
}

export interface HermesProviderKeyClearResponse {
  ok: boolean;
  profile: string;
  provider: string;
  cleared: boolean;
  restart_required: boolean;
}

export interface HermesEnvEntry {
  key: string;
  value: string;
}

export interface HermesSecretsResponse {
  profile: string;
  env_file: string;
  entries: HermesEnvEntry[];
}

export interface HermesSecretsKeysResponse {
  profile: string;
  keys: string[];
}

export interface HermesSecretsPutBody {
  entries: HermesEnvEntry[];
}

export interface HermesSecretsPutResponse {
  ok: boolean;
  profile: string;
  count: number;
  restart_required: boolean;
}

export interface HermesSoulResponse {
  profile: string;
  path: string;
  content: string;
  exists: boolean;
}

export interface HermesSoulPutBody {
  content: string;
}

export interface HermesSoulPutResponse {
  ok: boolean;
  profile: string;
  restart_required: boolean;
}

export interface HermesMemoryFile {
  name: string;
  size: number;
  preview: string;
}

export interface HermesMemoryListResponse {
  profile: string;
  memories_dir: string;
  files: HermesMemoryFile[];
}

export interface HermesMemoryFileResponse {
  profile: string;
  filename: string;
  content: string;
}

export interface HermesMemoryPutBody {
  content: string;
}

export interface HermesMemoryPutResponse {
  ok: boolean;
  profile: string;
  filename: string;
}

export interface HermesModelEntry {
  id?: string;
  object?: string;
  [key: string]: unknown;
}

export interface HermesModelsResponse {
  profile: string;
  running: boolean;
  gateway_url?: string;
  models: HermesModelEntry[];
}

/**
 * Insights response — only types the fields the FE actually renders.
 * The BE returns more (model breakdowns, activity, skills, top_sessions) —
 * accessed with optional chaining if surfaced later.
 */
export interface HermesInsightsResponse {
  profile: string;
  empty: boolean;
  overview: {
    total_sessions?: number;
    total_messages?: number;
    total_tool_calls?: number;
    total_input_tokens?: number;
    total_output_tokens?: number;
    total_cache_read_tokens?: number;
    total_tokens?: number;
    estimated_cost?: number;
    actual_cost?: number;
  };
  platforms: {
    platform: string;
    sessions: number;
    messages: number;
    total_tokens: number;
  }[];
  tools: { tool: string; count: number; percentage: number }[];
}
