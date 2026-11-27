export interface BranchReceipt {
  branch?: string | null;
  merged?: boolean;
  merged_at?: string | null;
  ahead?: number | null;
  behind?: number | null;
  commits?: number | null;
  unpushed?: number | null;
  pr?: { number?: number | null; url?: string | null; state?: string | null; draft?: boolean; merged_at?: string | null } | null;
  upstream?: { pushed?: boolean; gone?: boolean } | null;
  tree?: TreeState | null;
}

/** The worktree's own state, kept by Space: entries as git lists them by default, so a new folder counts once; null when not known. */
export interface TreeState {
  exists?: boolean | null;
  xo?: boolean | null;
  changed?: number | null;
  untracked?: number | null;
  kept_ignored?: number | null;
  local_commits?: number | null;
  would_lose?: boolean | null;
  error?: string | null;
  checked_at?: string | null;
}

interface LostPaths { count: number; paths: string[] }

export interface WorktreeLoss {
  summary?: string;
  branch?: string | null;
  commits?: number;
  changed?: LostPaths | null;
  untracked?: LostPaths | null;
  ignored?: LostPaths | null;
}

export interface WorktreeRow {
  chat_id: string;
  thread_ts: string;
  path?: string;
  branch?: string | null;
  base_commit?: string | null;
  thread_state?: string;
  resolved_at?: string | null;
  session_id?: string | null;
  session_state?: string | null;
  exists?: boolean;
  xo?: boolean;
  removable?: boolean;
  would_lose?: WorktreeLoss | null;
  error?: string | null;
  git?: BranchReceipt | null;
  removed_at?: string | null;
  removed_by?: string | null;
  checked_at?: string | null;
}

export interface ReportedTree {
  path: string;
  reported_at: string;
  seq?: number;
  chat_id?: string;
  thread_ts?: string | null;
  managed?: false;
}

export interface WorktreesReply {
  worktrees: WorktreeRow[];
  removed?: WorktreeRow[];
  reported?: ReportedTree[];
  next_cursor?: string | null;
}

export interface WorktreeRemoveReply {
  removed: true;
  forced: boolean;
  lost?: WorktreeLoss | null;
  note?: string | null;
}

export interface MadeReceipt {
  id: string;
  chat_id?: string;
  kind?: string;
  source?: string;
  path?: string | null;
  url?: string | null;
  name?: string | null;
  title?: string | null;
  mime?: string | null;
  bytes?: number | null;
  thread_ts?: string | null;
  message_id?: string | null;
  turn_id?: string | null;
  copy_path?: string | null;
  created_at?: string;
  updated_at?: string;
  pinned?: boolean;
  pinned_at?: string | null;
  exists?: boolean;
  where?: string | null;
  project_id?: string | null;
  relative_path?: string | null;
  git?: BranchReceipt | null;
}

export interface MadeReply { made: MadeReceipt[]; next_before?: string | null }
export interface MemoryFileReceipt { path: string; version: string; content: string }
export interface MemoryReply { files: { path: string; bytes: number; version: string }[] }
export interface ShapeReceipt { shape: Record<string, unknown> | null; version: string; updated_at?: string | null }
