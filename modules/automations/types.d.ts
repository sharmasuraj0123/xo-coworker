// @ts-check
import type { PersonaRef, ScheduleApi, ScheduledJob, ScheduleRule } from "../../core/platform/schedule-response-types";
import type { MayChoice, Persona, PersonaApi } from "../../core/platform/persona-response-types";
import type { ProjectApi } from "../../core/platform/project-response-types";

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
  rule: Exclude<ScheduleRule, { every_seconds: number }> | null;
  upcoming: number[];
  anchor: number;
  next: number;
  last: LastRun | null;
  offReason: string;
  runtime: string | null;
  model: string | null;
  effort: string | null;
  askedBy: "you" | "agent";
  approved: boolean;
  persona: PersonaRef | null;
  icon: string;
  job: Extract<ScheduledJob, { kind: "agent" }>;
}

export interface Cadence {
  kind: "once" | "week" | "day" | "days" | "month" | "hour" | "minute";
  at: number;
  step: number;
  days: number[];
  dom: number | "last" | null;
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

export type MayKey = "read" | "edit" | "run" | "all" | "own";

/** An agent as the screens read it: the server's, with the project it was listed for. */
export interface Agent extends Persona {
  project: string;
  owner: string;
}

export interface AgentDraft {
  name: string;
  description: string;
  body: string;
  runtime: string | null;
  model: string | null;
  effort: string | null;
  tools: string[] | null;
  disallowedTools: string[];
  mcpServers: string[] | null;
  level: Persona["level"];
  project: string;
}

export interface AgentList {
  agents: Agent[];
  may: Record<string, MayChoice>;
  failed: boolean;
}

export interface PersonasDeps {
  api: Pick<PersonaApi, "personas" | "importable" | "importPersona" | "tryOnce">
    & Pick<ProjectApi, "projectFile" | "saveProjectFile" | "deleteProjectFile" | "mkdirProject">;
  report: (error: unknown) => void;
  now?: () => number;
}

export interface AgentSideDeps {
  personas: import("./personas.js").PersonasStore;
  where: "page" | "panel";
  find: (key: string) => Agent | null;
  project: () => string;
  projects: () => Project[];
  projectName: (id: string) => string;
  runtimes: () => string[];
  openThread: (chat: string, ts: string) => void;
  openFile: (owner: string, path: string, from: Element) => void;
  openJob: (id: string) => void;
  shown: (key: string | null) => void;
  failed: (error: unknown, words: string) => void;
  announce: (words: string) => void;
}

export interface TryState { task: string; project: string; busy: string }

export interface AgentDetailState {
  where: "page" | "panel";
  body: string | null;
  menu: boolean;
  confirm: boolean;
  trying: TryState | null;
  may: Record<string, MayChoice>;
  projects: Project[];
  project: string;
  projectName: (id: string) => string;
}

export interface AgentFormState {
  title: string;
  draft: AgentDraft;
  may: MayKey;
  runtimes: string[];
  problem: string;
  busy: string;
  isNew: boolean;
  places: [string, string][];
}

export interface AgentSideState {
  host: HTMLElement | null;
  key: string | null;
  editing: boolean;
  menu: boolean;
  confirm: boolean;
  trying: TryState | null;
  body: string | null;
  version: string | null;
  values: import("./agent-form.js").AgentValues | null;
  read: string;
}

export interface AgentFrameDeps {
  personas: import("./personas.js").PersonasStore;
  projectOf: (view: string) => string | null;
  open: (key: string) => void;
  create: (project: string) => void;
  changed: () => void;
}

export interface AgentWrite {
  level: Agent["level"];
  project: string;
  name: string;
  text: string;
  base: string | null;
  was?: Agent | null;
}

export interface FormOptions {
  projects: Project[];
  problem: string;
  busy: string;
  agents: Agent[] | null;
}

export interface AgentListDeps {
  personas: import("./personas.js").PersonasStore;
  projects: () => Project[];
  projectName: (id: string) => string;
  selected: () => string | null;
  shown: () => boolean;
  changed: () => void;
  failed: (error: unknown, words: string) => void;
  announce: (words: string) => void;
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

export type Repeat = "once" | "day" | "weekdays" | "week" | "month" | "hours";

export interface FormValues {
  name: string;
  prompt: string;
  chat: string;
  repeat: Repeat;
  time: string;
  date: string;
  days: number[];
  dom: number | "last";
  hours: number;
  persona: PersonaRef | null;
}

export interface Project {
  chat: string;
  name: string;
  id: string;
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
  agentsFor?: (chat: string) => Agent[] | null;
  watchAgents?: (fn: () => void) => () => void;
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
  agentSide: (hooks: { shown: (key: string | null) => void, openJob: (id: string) => void }) => import("./agent-side.js").AgentSide;
  agentList: (hooks: { selected: () => string | null, shown: () => boolean, changed: () => void }) => AgentListApi;
  projectName: (chat: string) => string;
  projects: () => Project[];
  failed: (error: unknown, words: string) => void;
  announce: (words: string) => void;
  now?: () => number;
}

export type AutomationsStore = ReturnType<typeof import("./store.js").createAutomationsStore>;
export type AgentListApi = ReturnType<typeof import("./agent-list.js").createAgentList>;
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

export interface FrameDeps {
  store: AutomationsStore;
  chatOf: (view: string) => string | null;
  open: (id: string) => void;
  create: (chat: string) => void;
  changed: () => void;
  now?: () => number;
}
