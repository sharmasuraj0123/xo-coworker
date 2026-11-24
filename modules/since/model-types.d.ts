import type { BranchGit, WorktreeGit } from "../../core/services/git-state-types";
import type { gitState } from "../../core/services/git-state";
import type { createWorld } from "../../core/services/world/store";
import type { createScope } from "../../core/kernel/scope";
import type { StorageAccess } from "../../core/platform/storage";

export type SinceWorld = Pick<ReturnType<typeof createWorld>, "state" | "thread" | "project">;
export type SinceNeed = { admitted?: boolean; later?: boolean; t: { id: string } };
type SeenMark = { seen_at: string };
type SinceTree = WorktreeGit & { thread_ts: string };

export type SectionContext = {
  needs: SinceNeed[];
  patch: (el: HTMLElement, html: string) => boolean;
};

export type VisitLifetime = {
  scope: ReturnType<typeof createScope>;
  changed: () => void;
  failed: (error: unknown) => void;
  storage?: StorageAccess;
};

export type SinceOptions = {
  world: SinceWorld;
  api: SinceApi;
  schedule: () => void;
  announce: (words: string) => void;
  storage?: StorageAccess;
};

export type TreeMap = Map<string, WorktreeGit>;

export interface SinceApi {
  chats(signal: AbortSignal): Promise<{ chats?: ({ id: string; seen?: SeenMark | null } | null)[] } | null>;
  markSeen(chat: string, signal: AbortSignal): Promise<unknown>;
  worktrees(chat: string | undefined, signal: AbortSignal): Promise<SinceTrees | null>;
}

interface SinceTrees {
  worktrees?: SinceTree[];
  removed?: SinceTree[];
}

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
