import type { Policies, RouterModel, RuntimeModel } from "../../core/platform/runtime-response-types.d.ts";
import type { createIntelCatalog } from "./intel-catalog.js";
import type { Runtime, RuntimePolicy } from "../../core/services/runtime-types.d.ts";
import type { WorldRouter } from "../../core/services/world/state-types.d.ts";

export type IntelModel = RuntimeModel;
export type IntelRuntime = Runtime;
export type Setting = { agent?: string | null; model?: string | null; effort?: string | null };
export type Routing = WorldRouter;
export type Draft = { auto: boolean; model?: string | null; effort?: string | null };
export type Policy = RuntimePolicy;
export type IntelChat = { chatId: string; pin?: Setting; routing?: Routing | null };
export type IntelThread = { id: string; chatId: string; project: string; state?: string; session?: Setting | null; pin?: Setting; movedTo?: object | null };
export type IntelError = Error & { status?: number; code?: string };

export interface IntelWorld {
  state: {
    router?: Routing | null;
    runtimes?: IntelRuntime[] | null;
    chatPolicy?: Record<string, Policies>;
    policy?: { effective?: Policy } | null;
  };
  project(id: string): IntelChat | null | undefined;
  thread(id: string): IntelThread | null | undefined;
  act: {
    coordinatorAgent?(id: string | undefined): string | null;
    loadChatPolicy?(id: string): void;
    policyFor?(project: string): Policy | null;
    refresh?(): unknown;
    setPolicy(id: string, policy: Policy): unknown;
    fetchThread(chat: string, thread: string): Promise<IntelThread | null>;
  };
}

export interface IntelOptions {
  world: IntelWorld;
  PROJ: (project: string) => string;
  onChange: () => void;
  record: (session: string, receipt: { text: string; undo?: (() => Promise<void>) | null; refused?: boolean }) => void;
  onMoved?: (thread: IntelThread | null, runtime: string | null) => void;
  simple?: () => boolean;
}

export interface IntelMove {
  model: string | null;
  effort: string | null;
  models: IntelModel[] | null;
  modelsErr?: string;
  err?: string | null;
  rt?: string | null;
  busy?: boolean;
  retry?: boolean;
}

export interface IntelState {
  open: boolean;
  gen: number;
  session: string | null;
  anchor: HTMLElement | null;
  returnTo: HTMLElement | null;
  models: IntelModel[] | null;
  err: string | null;
  busy: boolean;
  rt: string | null;
  mv: IntelMove | null;
  full: boolean;
  draft: Draft | null;
  more: boolean;
  saving?: boolean;
  saveErr?: string | null;
  dms?: RouterModel[];
}

export type IntelPop = {
  querySelector(selector: string): HTMLElement | null;
  querySelectorAll(selector: string): NodeListOf<HTMLElement & { dataset: Record<string, string> }>;
} & HTMLElement;

export type IntelTarget = {
  closest(selector: string): (HTMLButtonElement & { dataset: Record<string, string> }) | null;
} & Element;

export interface IntelCurrent {
  pinned: boolean;
  model: string | null;
  effort: string | null;
  routing: Routing | null;
  ownRouting?: boolean;
  by?: string;
}

export type CatalogOptions = Required<Pick<IntelOptions, "world" | "PROJ" | "onChange" | "simple">>;

export interface ViewOptions {
  pop: IntelPop;
  world: IntelWorld;
  simple: () => boolean;
  catalogState: ReturnType<typeof createIntelCatalog>;
  draftOf: (session: string) => Draft;
  draftChanged: (session: string) => boolean;
  place: () => void;
}

export interface InputOptions {
  pop: IntelPop;
  threadOf: (session: string) => IntelThread | null;
  deepPick: (session: string) => { model: string; effort: string } | null;
  save: (session: string, draft: Draft, generation: number) => Promise<boolean>;
  close: (options?: { restore?: boolean; apply?: boolean }) => void;
  render: () => void;
  lookAt: (runtime: string | null) => void;
  setRuntime: (session: string, runtime: string) => Promise<void>;
  stepBack: () => void;
  moveGo: () => Promise<void>;
  pickMove: (id: string) => void;
  route: (session: string, id: string) => void;
  done: () => Promise<void>;
  pickModel: (id: string) => void;
  pickEffort: (effort: string) => void;
  place: () => void;
}
