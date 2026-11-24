export interface Rule {
  id: string;
  sentence?: string;
  scope?: string;
  project_pid?: string;
  thread_ts?: string;
  effect?: string;
  tier?: string;
  uses?: number;
  created_at?: string;
  revoked_at?: string | null;
}

export interface RuleBatch {
  rules?: Rule[];
  defaults?: Rule[];
  next_after_seq?: number;
}

export interface RulesState {
  rules: Rule[] | null;
  defaults: Rule[];
  listError: string | null;
  revokeError: { id: string; text: string } | null;
  confirmation: string | null;
}

export interface RulesHost {
  paint(id: string, html: string): void;
  focusTo(id: string, selector: string | null): void;
  pend(key: string, page: string, render: () => void, work: () => Promise<unknown>, from?: Element | null): Promise<unknown>;
  neighbour(from: Element | null, row: string, attr: string): string | null;
  sel(attr: string, value: string): string;
  errHtml(text: string): string;
  waits(key: string): string;
  when(iso: string): string;
}

export interface RulesOptions {
  world: {
    thread(id: string): { title?: string } | null | undefined;
    state: { projects: { id: string; pid?: string | null }[] };
  };
  announce(words: string): void;
  PROJ(id: string): string;
}
