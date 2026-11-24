import type { Shell } from "./model.js";
import type { mountShell, TerminalDetail, TerminalState } from "./term.js";
type Notify = (notice: { kind: string; text: string; sub?: string }) => void;
type Announce = (text: string) => void;
type ProjectName = (project: string) => string;
type Draw = () => void;

export interface DockOptions {
  PROJ?: ProjectName;
  notify?: Notify;
  onChange?: () => void;
  announce?: Announce;
  wanted?: () => boolean;
}

export interface DockSnapshot {
  tabs?: string[];
  active: string;
  open: boolean;
  filter?: string | null;
}

export type DockTarget = {
  closest(selector: string): (HTMLElement & { dataset: Record<string, string> }) | null;
} & Element;

type DockControls = {
  querySelector(selector: string): HTMLElement | null;
  querySelectorAll(selector: string): NodeListOf<HTMLElement>;
} & HTMLElement;

export type DockElement = HTMLElement & { _h?: string };

export interface DockTab {
  pane: HTMLElement;
  state: TerminalState;
  detail: TerminalDetail | null;
  title: string;
  exit: TerminalDetail | null;
  name?: string;
  handle: ReturnType<typeof mountShell>;
  until?: number;
}

export interface DockState {
  enabled: boolean;
  reason: string | null;
  statusAt: number;
  list: Shell[];
  loaded: boolean;
  err: string | null;
  tabs: Map<string, DockTab>;
  order: string[];
  active: string;
  filter: string | null;
  open: boolean;
  min: boolean;
  h: number;
  half: boolean;
  edit: string | null;
  confirm: { kind: "close"; id: string; fg: string; row: boolean } | { kind: "detached"; ids: string[]; row?: never } | null;
  busy: Set<string>;
  opening: boolean;
}

export interface DockViewOptions {
  root: DockControls;
  side: HTMLElement;
  tabsEl: DockElement;
  actsEl: DockElement;
  listEl: DockElement;
  confirmEl: DockElement;
  byId: (id: string) => Shell | null;
  nameOf: (id: string) => string;
  PROJ: ProjectName;
  wanted: () => boolean;
  LIST: string;
}

export interface DockActionOptions {
  requests: ReturnType<typeof import("./dock-requests.js").createDockRequests>;
  root: DockControls;
  listEl: DockControls;
  confirmEl: DockControls;
  LIST: string;
  byId: DockViewOptions["byId"];
  upsert: (shell: Shell | null) => void;
  nameOf: DockViewOptions["nameOf"];
  render: Draw;
  changed: Draw;
  detach: (id: string, options?: { quiet?: boolean }) => void;
  refreshSoon: () => void;
  notify: Notify;
  announce: Announce;
}

export type DockRenameOptions = Pick<DockActionOptions,
  "requests" | "root" | "upsert" | "nameOf" | "render" | "changed" | "notify" | "announce">;

export interface DockInputOptions {
  scope: ReturnType<typeof import("../../core/kernel/scope.js").createScope>;
  root: DockControls;
  side: HTMLElement;
  listEl: DockControls;
  tabsEl: DockControls;
  grip: HTMLElement;
  LIST: string;
  showList: (filter: string | null) => void;
  toggle: () => void;
  activate: (id: string, options?: { focus?: boolean }) => void;
  detach: DockActionOptions["detach"];
  attach: (id: string) => void;
  startRename: (id: string) => void;
  askClose: (id: string, row: boolean) => Promise<void>;
  openProject: (project: string, options: { fresh?: boolean }) => void;
  openWorkspace: (options: { fresh?: boolean }) => void;
  askCloseDetached: () => void;
  changed: Draw;
  keepIt: () => void;
  closeShell: (id: string) => Promise<void>;
  closeDetached: (ids: string[]) => Promise<void>;
  away: () => void;
  saveRename: (id: string, value: string) => Promise<void>;
  render: Draw;
  renameBack: (id: string) => string;
  owns: (event: Event) => boolean;
  persist: () => void;
}
