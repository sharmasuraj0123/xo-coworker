import type { createLpApi } from "./client.js";
import type { createScope } from "../../core/kernel/scope.js";
import type { model } from "./model.js";
import type { createWindowNotices } from "./notices.js";
import type { installStore } from "./store.js";

export type LaunchpadApi = ReturnType<typeof createLpApi>;
type CheckModel = ReturnType<typeof model>;
type ModelApp = NonNullable<CheckModel["app"]>;
type LaunchpadApp = Pick<ModelApp, "id" | "name" | "url" | "host" | "status"> & Partial<ModelApp>;
export type LaunchpadCheck = Omit<CheckModel, "app"> & { app: LaunchpadApp | null; getting?: PrepThread };
type Timer = ReturnType<typeof setTimeout>;
type Disk = { path: string; gb: number };
type Step = { state?: string; text?: string; url?: string; at?: number; took?: number; ready?: number; of?: number; release?: number };
type DeployError = { code: string; text?: string; message?: string; node?: string; step?: string; port?: number; declared?: number;
  last?: number; app?: { id: string }; url?: string; action?: string; fix?: string; source?: string;
  release?: number; log?: string[] | null };
type NoticeOwner = ReturnType<typeof createWindowNotices>;

export interface PrepThread {
  thread?: string;
  title: string;
  since: number;
  busy?: boolean;
  held?: string | null;
  done?: boolean;
}

export interface LaunchpadOptions {
  api: LaunchpadApi;
  projectOf(view: string | null): string | null;
  nameOf?(project: string): string;
  findThread?(project: string, id?: string): PrepThread | null | undefined;
  go?(view: string): void;
  announce(text: string): void;
  notify?(text: string, undo: (() => void) | null, kind: string): void;
  notice?: NonNullable<Parameters<typeof createWindowNotices>[1]["notice"]>;
  unnotice?(id: string): void;
  onChange?(): void;
}

export interface LaunchpadDom {
  el: HTMLElement | null;
  hs: HTMLElement | null;
  nav: HTMLElement | null;
  notes: HTMLElement | null;
  body: HTMLElement | null;
  key: string;
  html: string;
  v: string | null;
  shown: string | null;
  want: string;
  lost: string[];
}

export interface LaunchpadForm {
  name: string;
  repo: string;
  port: string;
  size: string;
  disk: boolean;
  diskPath: string;
  diskGb: string;
  env: Record<string, string>;
  errs: Record<string, string>;
  useRepo?: string;
  recreate?: boolean;
  repoChosen?: boolean;
  allowApps?: string[] | null;
}

export interface DeployRun {
  startedAt: number;
  steps: Record<string, Step>;
  error: DeployError | null;
  live: { name?: string; host?: string; url?: string; release?: number; commit?: string; at: number } | null;
  undo: number;
  stop: { stop(): void } | null;
  stopping?: Timer | 0;
  stopAt?: number;
  stopSent?: boolean;
  stopErr?: string | null;
  mid?: string;
  ended?: boolean;
  edit?: boolean;
  lost?: boolean;
  appId?: string;
  release?: number;
  sent?: string[];
  made?: { size?: string; storage?: Disk | null };
}

export interface DeployFrame {
  type?: string;
  code?: string;
  id?: string;
  run?: string;
  step: string;
  state?: string;
  at?: number;
  started?: number;
  error?: DeployError;
  message?: string;
  action?: string;
  fix?: string;
  text?: string;
  url?: string;
  host?: string;
  ready?: number;
  of?: number;
  release?: number;
  commit?: string;
  app?: { id: string; name?: string };
  data?: { suggestion?: string; reason?: string; repo?: string; origin?: string; branch?: string;
    apps?: { id: string; slug?: string; workflow?: string }[]; app?: { id: string } };
}

export interface LaunchpadProject {
  check: LaunchpadCheck | null;
  at: number;
  pre: number;
  loading: boolean;
  err: unknown;
  run: DeployRun | null;
  form: LaunchpadForm | null;
  device: { id?: string; code: string; url: string; copiedUntil: number; dispose(): void } | null;
  picking: { apps: Awaited<ReturnType<LaunchpadApi["apps"]>> | null } | null;
  asked: PrepThread | null;
  asking: boolean;
  askErr: string | null;
  needs: DeployFrame | null;
  warn: string[] | null;
  menu: boolean;
  copied: number;
  cmdCopied: number;
  seq?: number;
  applied?: number;
  ended?: string;
  editing?: boolean;
  envAll?: boolean;
  machine?: boolean;
  linking?: boolean;
  loud?: boolean;
  ghErr?: string | null;
  sent?: { again: boolean; recreate: boolean; edit: boolean };
}

export interface LaunchpadRecords extends Pick<NoticeOwner, "say" | "unsay" | "tell"> {
  api: LaunchpadApi;
  windowBody(): HTMLElement | null;
  windowView(): string | null;
  shownProject(): string | null;
  visible(project: string): boolean;
  invalidate(): void;
  proj(project: string): LaunchpadProject;
  changed(): void;
  land(selector: string): void;
  frame(fn: FrameRequestCallback): void;
  windowScope(): ReturnType<typeof createScope> | undefined;
  announce(text: string): void;
  nameOf(project: string): string;
  findThread: NonNullable<LaunchpadOptions["findThread"]>;
  projectOf: LaunchpadOptions["projectOf"];
  go?: LaunchpadOptions["go"];
  endStop(run: DeployRun | null): void;
}

export interface LaunchpadViewHooks {
  askState?(project: string, thread: PrepThread | null | undefined): { k: string; word: string };
  bodyHtml?(project: string): { key: string; html: string; form: boolean };
  hintFor?(key: string, project: string): string;
}

export type LaunchpadViewOptions = LaunchpadViewHooks & Pick<LaunchpadRecords, "proj" | "nameOf" | "findThread">
  & Pick<ReturnType<typeof installStore>, "screen" | "summary"> & { S: LaunchpadDom };

export interface LaunchpadStoreOptions extends LaunchpadRecords {
  remember(project: string, state: string): void;
  stopped(project: string, run: DeployRun): void;
  askState(project: string, thread: PrepThread | null | undefined): string | undefined;
}
