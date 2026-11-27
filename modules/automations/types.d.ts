// @ts-check
import type { ScheduleApi, ScheduledJob } from "../../core/platform/schedule-response-types";

export interface LastRun {
  at: number;
  status: "ok" | "skipped" | "failed";
  found: boolean | null;
  reason: string;
  thread: { chat: string; ts: string } | null;
  manual: boolean;
}

export interface RunRow extends LastRun {
  key: string;
}

export interface Automation {
  id: string;
  name: string;
  about: string;
  project: string;
  prompt: string;
  on: boolean;
  running: boolean;
  every: number | null;
  anchor: number;
  next: number;
  last: LastRun | null;
  offReason: string;
  runtime: string | null;
  model: string | null;
  effort: string | null;
  askedBy: "you" | "agent";
  approved: boolean;
  icon: string;
  job: Extract<ScheduledJob, { kind: "agent" }>;
}

export interface Cadence {
  kind: "once" | "week" | "day" | "hour" | "minute";
  at: number;
  step: number;
}

export interface WeekDay {
  start: number;
  today: boolean;
  past: boolean;
  dots: { id: string; icon: string; at: number }[];
}

export interface AgendaDay {
  start: number;
  label: string;
  items: { automation: Automation; at: number }[];
}

export interface Persona {
  name: string;
  description: string;
  level: "project" | "space";
  project: string | null;
  path: string;
  runtime: string | null;
  model: string | null;
  effort: string | null;
  tools: string[] | null;
  disallowedTools: string[] | null;
  mcpServers: string[] | null;
  shadows: boolean;
  shadowed: boolean;
  used_by: { jobs: string[]; threads_running: number };
  version: string;
  updated_at: string;
}

export interface PersonaSource {
  list(project: string | null, signal?: AbortSignal): Promise<{ personas: Persona[]; importable: number }>;
  get(level: Persona["level"], name: string, project: string | null): Promise<Persona & { body: string; text: string }>;
}

export interface RowState {
  menu: string | null;
  confirm: string | null;
  selected: string | null;
  deleting: Map<string, number>;
  projectName: (chat: string) => string;
}

export interface DetailState {
  runs: RunRow[] | null;
  runsFailed: boolean;
  menu: boolean;
  confirm: boolean;
  projectName: string;
  where: "page" | "panel";
}

export type Repeat = "once" | "day" | "week" | "hours";

export interface FormValues {
  name: string;
  prompt: string;
  chat: string;
  repeat: Repeat;
  time: string;
  date: string;
  weekday: number;
  hours: number;
}

export interface Project {
  chat: string;
  name: string;
}

export interface AutomationsState {
  list: Automation[];
  loaded: boolean;
  failed: boolean;
  deleting: Map<string, number>;
}

export interface StoreDeps {
  api: Pick<ScheduleApi, "schedules" | "scheduleRuns" | "createSchedule" | "updateSchedule" | "deleteSchedule" | "runSchedule">;
  report: (error: unknown) => void;
  timeout: (fn: () => void, ms: number) => () => void;
  now?: () => number;
}

export interface SideDeps {
  store: AutomationsStore;
  where: "page" | "panel";
  projectName: (chat: string) => string;
  projects: () => Project[];
  openThread: (chat: string, ts: string) => void;
  shown: (id: string | null) => void;
  showAll?: () => void;
  failed: (error: unknown, words: string) => void;
  announce: (words: string) => void;
  now?: () => number;
}

export interface SideState {
  host: HTMLElement | null;
  id: string | null;
  editing: boolean;
  menu: boolean;
  confirm: boolean;
  problem: string;
  values: FormValues | null;
  runs: { id: string; rows: RunRow[] | null; failed: boolean };
}

export interface PageDeps {
  store: AutomationsStore;
  side: (hooks: { shown: (id: string | null) => void }) => Side;
  projectName: (chat: string) => string;
  projects: () => Project[];
  failed: (error: unknown, words: string) => void;
  announce: (words: string) => void;
  now?: () => number;
}

export type AutomationsStore = ReturnType<typeof import("./store.js").createAutomationsStore>;
export type Side = ReturnType<typeof import("./side.js").createSide>;

export interface SideControl {
  st: SideState;
  deps: SideDeps;
  show: (id: string | null, edit: boolean) => void;
  duplicate: (id: string) => void;
  close: () => void;
  paint: () => void;
  readRuns: (id: string) => Promise<void>;
}
export type Tab = "upcoming" | "found" | "off";
