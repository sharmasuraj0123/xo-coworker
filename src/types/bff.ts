/**
 * Response shapes for the BFF layer
 * (see `docs/bff-endpoints-design.md` in xo-cowork-api).
 *
 * The BFF curates output server-side: no absolute paths leak, secret
 * plaintext only crosses the wire via the explicit `/reveal` route,
 * and hidden / system entries are filtered at every depth.
 */

// ── /api/xo-projects ─────────────────────────────────────────────────────────

export interface XoProject {
  id: string;
  display_name: string;
  description: string | null;
  /** ISO 8601 UTC, or null. */
  created_at: string | null;
  /** True when the directory exists but has no `.xo` metadata. */
  unscaffolded: boolean;
}

export interface ListXoProjectsResponse {
  items: XoProject[];
  total: number;
}

// ── /api/xo-projects/{id}/tree ───────────────────────────────────────────────

export interface ProjectTreeEntry {
  name: string;
  /** Relative to the project root, with forward slashes only. */
  relative_path: string;
}

export interface ProjectTreeResponse {
  project_id: string;
  /** `""` at the project root. */
  relative_path: string;
  parent_relative_path: string | null;
  dirs: ProjectTreeEntry[];
  files: ProjectTreeEntry[];
}

// ── /api/secrets ─────────────────────────────────────────────────────────────

export interface SecretSummary {
  key: string;
  is_set: boolean;
  /** Fixed-width masked preview (`xxx•••••••yyy`) when set, else null. */
  preview: string | null;
}

export interface ListSecretsResponse {
  items: SecretSummary[];
  total: number;
}

export interface RevealSecretResponse {
  key: string;
  value: string;
}

export interface SecretItem {
  key: string;
  value: string;
}

export interface PutSecretsRequest {
  items: SecretItem[];
}

export interface PatchSecretRequest {
  value: string;
}

export interface DeleteSecretResponse {
  key: string;
  deleted: boolean;
}
