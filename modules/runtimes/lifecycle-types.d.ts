import type { Job } from "../../core/platform/lifecycle-types";

export interface Flow {
  phase: "starting" | "paste" | "sending" | "code" | "link";
  ctl: AbortController;
  session?: string;
  url?: string;
  code?: string;
  opened?: boolean;
  lines: string[];
}
export interface JobView {
  id?: string;
  action: string;
  status: Job["status"];
  log: string[];
  at?: number;
  end?: number;
  error?: string;
  lost?: boolean;
  open?: boolean;
}
export interface RowAction {
  id: string;
  label: string;
  pri?: boolean;
  danger?: boolean;
  href?: string;
}
export interface RowView {
  key: string;
  tone: string;
  pill: [string, string];
  line: string;
  busy: boolean;
  next: RowAction[];
  menu: RowAction[];
  version?: string | null;
}
export interface Settling {
  what: string;
}
export type Settle = (name: string, what?: string) => void;
export interface Remote {
  running?: boolean;
  url?: string | null;
  error?: string | null;
  busy?: boolean;
}
export interface RowParts {
  flow?: Flow | null;
  job?: JobView | null;
  settling?: string;
  err?: string;
  remote?: Remote | null;
  menuOpen?: boolean;
  extra?: string;
  now?: number;
}
export type LifecycleApi = Pick<import("../../core/platform/api-types").Api,
  "signInStream" | "signInCode" | "signInCancel" | "runtimeAction" | "runtimeJob" | "remoteControl" | "setRemoteControl">;
export interface LifecycleDeps {
  api: LifecycleApi;
  refresh(): unknown;
  announce(words: string): void;
  scope: Pick<import("../../core/kernel/types").ModuleContext, "timeout" | "effect" | "signal">;
}
export type InUse = import("../../core/services/runtime-types").SessionThread;
export interface UninstallDeps {
  run(name: string, force: boolean): Promise<{ inUse: string[] } | null>;
  state(): import("../../core/services/runtime-types").SessionsState;
  go(to: string): void;
  pushLayer(layer: import("../../core/kernel/types").Layer): () => void;
  scope: Pick<import("../../core/kernel/types").ModuleContext, "listen" | "effect">;
}
