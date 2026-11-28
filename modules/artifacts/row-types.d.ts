import type { BranchGit } from "../../core/services/git-state-types";

export interface MadeOptions {
  project?: string;
  threadTitle?: (thread: string) => string;
}

export interface MadeRow {
  id: string;
  updated_at?: string;
  created_at?: string;
  name?: string | null;
  kind?: string;
  path?: string | null;
  relative_path?: string | null;
  url?: string | null;
  mime?: string | null;
  git?: (BranchGit & { branch?: string | null }) | null;
  thread_ts?: string | null;
  turn_id?: string | null;
  project_id?: string | null;
  title?: string | null;
  bytes?: number | null;
  pinned?: boolean;
  exists?: boolean;
}
