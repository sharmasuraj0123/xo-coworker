import type { BranchGit, WorktreeGit } from "../../core/services/git-state-types";
import type { gitState } from "../../core/services/git-state";

export interface Thread {
  id: string;
  title?: string;
  lastAt: number;
  state?: string;
  busy?: boolean;
  git?: BranchGit | null;
  summary?: string | null;
  happened?: string | null;
  checklist?: { items?: { state: string; text: string }[] } | null;
}

export interface CatchUpOptions {
  since?: number;
  needing?: Set<string>;
  trees?: Map<string, WorktreeGit>;
}

export interface CatchUpItem<T extends Thread> {
  t: T;
  line: string;
  git: ReturnType<typeof gitState>;
}
