import type { Api } from "../../core/platform/api-types";
import type { Person, Pull } from "../../core/platform/github-issues-types";
export type { Person, Pull, Detail } from "../../core/platform/github-issues-types";

export type GithubApi = Pick<Api, "githubIssues" | "githubPulls" | "githubIssue" | "githubPull" | "githubStatus">;
export type DetailApi = Pick<GithubApi, "githubIssue" | "githubPull">;
export type ListApi = Pick<GithubApi, "githubIssues" | "githubPulls" | "githubStatus">;
export interface GithubPageOptions {
  stage: Stage;
  api: GithubApi;
  view: () => string;
  projectOf: (view: string) => string;
  work?: (project: string, item: ReturnType<typeof import("./page").issueOf> | ReturnType<typeof import("./page").prOf>) => void;
  announce?: (message: string) => void;
}

type Count = number | { total_count?: number } | null;
export interface Issue {
  number: number;
  title?: string;
  url?: string;
  state?: string | null;
  state_reason?: string | null;
  updated_at?: string | null;
  author?: Person;
  assignees?: Person[];
  comments?: Count;
  comment_count?: Count;
  labels?: unknown[] | null;
  in_progress?: boolean;
}
export interface PageData {
  issues: { repo?: string | null; state?: string; issues?: Issue[]; error?: { message?: string } | null; fetched_at?: string | null };
  pulls?: { pulls?: Pull[], open_total?: number } | null;
  status: { valid?: boolean } | null;
}
interface Page {
  title: (key: string) => string;
  mount: (host: HTMLElement) => void;
  onShow: (key: string) => unknown;
  onHide?: () => void;
  backTo?: () => string;
  over?: boolean;
}
export interface Stage {
  page(name: string, page: Page): void;
  show(name: string, key: string, options: { focus: boolean }): void;
  pageShown?: { name: string } | null;
}
