export interface WorktreeLoss {
  summary?: string;
  branch?: string;
  commits?: number;
  changed?: { paths?: string[] } | null;
  untracked?: { paths?: string[] } | null;
}

export interface Worktree {
  chat_id: string;
  thread_ts: string;
  path?: string;
  branch?: string;
  error?: string | null;
  exists?: boolean;
  xo?: boolean;
  removable?: boolean;
  would_lose?: WorktreeLoss | null;
  session_state?: string;
  thread_state?: string;
}

export interface ReportedTree {
  path: string;
  reported_at: string;
}

export interface WorktreesResponse {
  worktrees?: Worktree[];
  reported?: ReportedTree[];
}

export interface WorktreeRemoval {
  key: string;
  loss?: WorktreeLoss;
  token?: string;
}

export interface WorktreesState {
  trees: Worktree[] | null;
  reported: ReportedTree[];
  listError: string | null;
  removalError: { key: string; text: string } | null;
  confirmation: WorktreeRemoval | null;
}

export interface WorktreesHost {
  box(id: string): Element | null;
  paint(id: string, html: string): void;
  focusTo(id: string, selector: string | null): void;
  pend(key: string, page: string, render: () => void, work: () => Promise<unknown>, from?: Element | null): Promise<unknown>;
  neighbour(from: Element | null, row: string, attr: string): string | null;
  sel(attr: string, value: string): string;
  errHtml(text: string): string;
  waits(key: string): string;
  when(iso: string): string;
}

export interface WorktreesOptions {
  world: {
    thread(id: string): { title?: string } | undefined;
    act: { projectOf?: (chat: string) => string | null };
  };
  announce(words: string): void;
  PROJ(id: string | null): string;
}
