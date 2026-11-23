export type Undo = () => void;

export type Scope = "app" | "project" | "conversation";

export type PlaceKind = "single" | "list" | "keyed" | "chain";

export interface At {
  view?: string;
  project?: string;
  conversation?: string;
  [k: string]: unknown;
}

export interface Entry {
  id: string;
  order?: number;
  priority?: number;
  when?(at: At): boolean;
}

export type Contributed<E extends Entry = Entry> = E & { readonly owner: string };

export interface PlaceDef<E extends Entry = Entry> {
  id: string;              // dotted lower-case, e.g. "panel.page"; "preview:" prefix = experimental
  kind: PlaceKind;
  scope: Scope;
  description: string;
  openToApps?: boolean;
  check?(entry: E): void;
}

export type Arranger = (entries: Contributed[], at: At) => Contributed[];

export interface Places {
  define<E extends Entry>(def: PlaceDef<E>, owner?: string): Undo;
  contribute<E extends Entry>(place: string, entry: E, owner: string): Undo;
  entries<E extends Entry>(place: string, at?: At): Contributed<E>[];
  get<E extends Entry>(place: string, id: string): Contributed<E> | undefined;
  first<E extends Entry>(place: string, at?: At): Contributed<E> | undefined;
  arrange(place: string, fn: Arranger): Undo;
  watch(place: string, fn: () => void): Undo;
  has(place: string): boolean;
  catalog(): ReadonlyArray<Readonly<PlaceDef> & { owner: string; entries: number }>;
}

export interface Bus {
  on<T = unknown>(topic: string, fn: (payload: T) => void): Undo;
  once<T = unknown>(topic: string, fn: (payload: T) => void): Undo;
  emit<T = unknown>(topic: string, payload?: T): void;
}

export interface Scheduler {
  onFlush(key: string, fn: () => void): Undo;
  invalidate(key?: string): void;
  flushNow(): void;
}

export interface Layer {
  id: string;
  escape?(): boolean;
  back?(): boolean;
  modal?: boolean;
  returnFocus?: Element | null;
}
export interface Layers {
  push(layer: Layer, owner?: string): Undo;
  top(): Layer | undefined;
  list(): ReadonlyArray<Layer>;
  escape(order?: readonly string[]): boolean;
  back(order?: readonly string[]): boolean;
  watch(fn: () => void): Undo;
}

export interface ModuleManifest {
  id: string;              // "xo.<name>" for first-party modules
  version: string;
  kernel: string;
  description?: string;
  needs?: string[];
  provides?: string[];
  contributes?: string[];  // "place" or "place:id"; ctx.contribute outside this list throws
  defines?: string[];
  routes?: string[];
  storage?: string[];      // "local:cv-theme", "session:xo-shells", "local:xo-draft:*"
  styles?: string[];
  vendor?: string[];
  core?: boolean;          // can't be disabled (kernel, shell, decisions)
}

export interface ModuleDef {
  manifest: ModuleManifest;
  activate(ctx: ModuleContext): void | Promise<void>;
}

export interface ModuleContext {
  readonly id: string;
  readonly kernelVersion: string;
  use<T = unknown>(service: string): T;
  has(service: string): boolean;
  provide<T>(name: string, api: T): Undo;
  contribute<E extends Entry>(place: string, entry: E): Undo;
  definePlace<E extends Entry>(def: PlaceDef<E>): Undo;
  effect(fn: () => Undo | void): Undo;
  on<T = unknown>(topic: string, fn: (payload: T) => void): Undo;
  emit<T = unknown>(topic: string, payload?: T): void;
  listen(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions): Undo;
  timeout(fn: () => void, ms: number): Undo;
  interval(fn: () => void, ms: number): Undo;
  frame(fn: (t: number) => void): Undo;
  observe(observer: { disconnect(): void }): Undo;
  onFlush(key: string, fn: () => void): Undo;
  invalidate(key?: string): void;
  pushLayer(layer: Layer): Undo;
  readonly places: Pick<Places, "entries" | "get" | "first" | "watch" | "has">;
  log(...args: unknown[]): void;
}

export type ModuleStatus = "registered" | "waiting" | "active" | "failed" | "disabled";

export interface StartReport {
  active: string[];
  waiting: Array<{ id: string; missing: string[] }>;
  failed: Array<{ id: string; error: string }>;
  disabled: string[];
}

export interface Kernel {
  readonly version: string;
  readonly places: Places;
  readonly bus: Bus;
  readonly scheduler: Scheduler;
  readonly layers: Layers;
  register(def: ModuleDef): void;
  start(opts?: { safe?: boolean; disabled?: string[] }): Promise<StartReport>;
  enable(id: string): Promise<StartReport>;
  disable(id: string): Promise<string[]>;
  status(id: string): ModuleStatus | undefined;
  live(id: string): number;
  modules(): ReadonlyArray<{ id: string; status: ModuleStatus; error?: string; manifest: ModuleManifest }>;
}
