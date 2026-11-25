// @ts-check

type Text = string | null;
type Flag = boolean | null;
type Field<T, Source = string> = { value: T; source: Source };
type Disk = { path?: Text; size_gb?: number | null };
type Repo = { full_name?: Text; origin?: Text; branch?: Text; own?: Flag; new_repo_name?: Text };
type Running = { kind: "deploy" | "watch"; run_id: string };

interface Fields {
  name?: Field<string>;
  port?: Field<number | null, Text> & { confident?: boolean };
  health_path?: Field<Text>;
  size?: Field<Text>;
  storage?: Field<Disk | null>;
  env?: { name: string; sensitive: boolean; source: string; default?: string }[];
  repo?: Repo;
}

export interface Check {
  schema?: 1;
  project: string;
  state: string;
  summary?: string;
  reasons?: (string | { what?: string; why?: string; message?: string })[];
  blockers?: string[];
  warnings?: string[];
  config?: { app_id?: Text; name?: Text; url?: Text; size?: Text; storage?: Disk | null } | null;
  fields?: Fields;
  git?: { branch?: Text; head?: Text; deployed_head?: Text };
  prerequisites?: { github_connected: boolean; github_source?: Text };
  running?: Running | null;
}

interface App {
  id?: Text;
  name?: Text;
  url?: Text;
  status?: Text;
  size?: Text;
  size_label?: Text;
  last_deploy_at?: Text;
  exists?: boolean;
  release?: number | null;
  ready?: number | null;
  desired?: number | null;
  storage?: { path?: Text; size?: Text } | null;
}

interface Sizes {
  tiers: { name: string; label?: string; cpu: number; memory_gb: number }[];
  default?: Text;
  allowed?: string[];
  source?: Text;
  error?: Text;
  fixed_after_create?: boolean;
}

export interface Preflight {
  state: string;
  github: { connected?: boolean; workflow_scope?: Flag; login?: Text; source?: Text; error?: Text; fix?: Text };
  repo: Repo & { mode?: Text; reason?: Text; exists?: Flag };
  launchpad: {
    app?: App | null;
    sizes?: Sizes | null;
    name_free?: boolean;
    same_name?: App & { linkable?: boolean } | null;
    env_set?: Record<string, boolean>;
  };
}
