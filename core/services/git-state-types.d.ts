export interface BranchGit {
  commits?: number;
  merged?: boolean;
  unpushed?: number | null;
  upstream?: { pushed?: boolean; gone?: boolean } | null;
  pr?: { number?: number; url?: string; state?: string; draft?: boolean } | null;
}

export interface WorktreeGit {
  exists?: boolean;
  error?: unknown;
  git?: BranchGit | null;
  would_lose?: {
    changed?: { count?: number } | null;
    untracked?: { count?: number } | null;
    commits?: number;
  } | null;
}
