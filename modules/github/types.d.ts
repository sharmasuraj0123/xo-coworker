type Count = number | { total_count?: number } | null;
export type Person = string | { login?: string; avatar_url?: string; avatarUrl?: string } | null;
export interface Issue {
  number: number;
  title?: string;
  url?: string;
  state?: string;
  updated_at?: string;
  author?: Person;
  assignees?: Person[];
  comments?: Count;
  comment_count?: Count;
  labels?: unknown[];
  in_progress?: boolean;
}
export interface Pull extends Issue {
  updatedAt?: string;
  merged?: boolean;
  is_draft?: boolean;
  isDraft?: boolean;
  draft?: boolean;
  head?: string;
  head_ref?: string;
  headRefName?: string;
  base?: string;
  base_ref?: string;
  baseRefName?: string;
  checks?: string;
  check_state?: string;
  statusCheckRollup?: string;
  review_decision?: string;
  reviewDecision?: string;
  mergeable?: string;
  additions?: Count;
  deletions?: Count;
  changed_files?: Count;
  changedFiles?: Count;
}
export interface PageData {
  issues: { repo?: string | null; state?: string; issues?: Issue[]; error?: { message?: string }; fetched_at?: string };
  pulls: { pulls?: Pull[] } | null;
  status: { valid?: boolean } | null;
}
export interface Detail {
  body?: string;
  conflicts?: string[];
  checks?: { state?: string; conclusion?: string; name?: string }[];
  comments?: { author?: Person; created_at?: string; body?: string }[];
}
interface Page {
  title: (key: string) => string;
  mount: (host: HTMLElement) => void;
  onShow: (key: string) => unknown;
  backTo?: () => string;
  over?: boolean;
}
export interface Stage {
  page(name: string, page: Page): void;
  show(name: string, key: string, options: { focus: boolean }): void;
  pageShown?: { name: string } | null;
}
