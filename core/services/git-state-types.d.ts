import type { BranchReceipt } from "../platform/record-response-types.d.ts";

export type BranchGit = Pick<BranchReceipt, "commits" | "merged" | "unpushed" | "upstream" | "pr">;

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
