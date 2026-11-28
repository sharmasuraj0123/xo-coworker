// @ts-check

interface Assignee { login: string; avatar_url: string | null }

interface Issue {
  node_id: string;
  number: number;
  title: string;
  state: string | null;
  state_reason: string | null;
  assignees: Assignee[];
  labels: string[] | null;
  url: string;
  updated_at: string | null;
  adopted: boolean;
  workitem_id: string | null;
  in_progress: boolean;
}

export interface GithubIssuesResponse {
  project_id: string;
  repo: string | null;
  fetched_at: string | null;
  error: { kind: string; message: string; at: string | null } | null;
  issues: Issue[];
  untracked: number;
  tracked: number;
  state: "ok" | "empty" | "never_polled" | "issues_disabled" | "no_remote" | "error";
}

type Count = number | { total_count?: number } | null;
export type Person = string | { login?: string; avatar_url?: string | null; avatarUrl?: string } | null;

export interface Pull {
  number: number;
  title?: string;
  url?: string;
  state?: string | null;
  updated_at?: string | null;
  updatedAt?: string;
  author?: Person;
  assignees?: Person[];
  comments?: Count;
  comment_count?: Count;
  labels?: unknown[] | null;
  in_progress?: boolean;
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

export interface Detail {
  body?: string;
  conflicts?: string[];
  checks?: { state?: string; conclusion?: string; name?: string }[];
  comments?: { author?: Person; created_at?: string; body?: string }[];
}
