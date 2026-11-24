import type { createDockRequests } from "./dock-requests.js";
import type { DockActionOptions, DockViewOptions } from "./dock-types.d.ts";

export interface ShellThread {
  project: string;
  chatId?: string;
  ts: string;
  title: string;
}

export interface ShellWorktree {
  thread_ts: string;
  exists?: boolean;
  error?: string;
  path?: string;
}

export interface DockOpenOptions {
  requests: ReturnType<typeof createDockRequests>;
  wanted(): boolean;
  claimView(): void;
  render(): void;
  attach(id: string, options?: { ticket?: string | null; focus?: boolean }): void;
  upsert: DockActionOptions["upsert"];
  focusNew(): void;
  showList(project: string): void;
  projectName: DockViewOptions["PROJ"];
  refresh(options: { status: boolean }): Promise<void>;
  notify: DockActionOptions["notify"];
  announce: DockActionOptions["announce"];
}
