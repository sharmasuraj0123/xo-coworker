export type Undo = () => void;
export interface FaultSource { module: string; phase: string; subject?: string }
export type Warn = (source: FaultSource, error: unknown) => void;

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

export interface PlaceEntries {}
export interface KeyedPlaceEntries {}

export type PlaceEntry<P extends string> = P extends keyof PlaceEntries ? PlaceEntries[P] & Entry : Entry;
export type PlaceItem<P extends string, I extends string> =
  `${P}:${I}` extends keyof KeyedPlaceEntries ? KeyedPlaceEntries[`${P}:${I}`] & Entry
    : PlaceEntry<P>;

export interface Places {
  define<E extends Entry>(def: PlaceDef<E>, owner?: string): Undo;
  contribute<P extends string, const E extends Entry>(place: P, entry: E & PlaceItem<NoInfer<P>, NoInfer<E["id"]>>, owner: string): Undo;
  entries<P extends string>(place: P, at?: At): Contributed<PlaceEntry<P>>[];
  get<P extends string, I extends string>(place: P, id: I): Contributed<PlaceItem<P, I>> | undefined;
  first<P extends string>(place: P, at?: At): Contributed<PlaceEntry<P>> | undefined;
  arrange(place: string, fn: Arranger): Undo;
  watch(place: string, fn: () => void): Undo;
  has(place: string): boolean;
  catalog(): ReadonlyArray<Readonly<PlaceDef> & { owner: string; entries: number }>;
}

export interface Topics {}
type TopicPayload<T extends string> = T extends keyof Topics ? Topics[T] : unknown;
type TopicListener<T extends string> = Exclude<Extract<T, `app:${string}`>, keyof Topics> extends never
  ? [fn: (payload: TopicPayload<T>) => void] : never;
type TopicArguments<T extends string> = T extends keyof Topics
  ? Topics[T] extends undefined ? [topic: T] : [topic: T, payload: Topics[T]]
  : T extends `app:${string}` ? never : [topic: T, payload?: unknown];

export interface Bus {
  on<T extends string>(topic: T, ...args: TopicListener<NoInfer<T>>): Undo;
  once<T extends string>(topic: T, ...args: TopicListener<NoInfer<T>>): Undo;
  emit<T extends string>(...args: [topic: T, ...unknown[]] & TopicArguments<NoInfer<T>>): void;
}

export interface Scheduler {
  onFlush(key: string, fn: () => void): Undo;
  invalidate(key?: string): void;
  flushNow(): void;
  dispose(): void;
}

export interface Layer {
  open?(): boolean;
  overlay?: boolean;
  id: string;
  escape?(): boolean;
  back?(): boolean;
  modal?: boolean;
  returnFocus?: Element | null;
}
export interface Layers {
  open(options?: { overlay?: boolean }): boolean;
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
  optional?: string[];
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

export interface Services {}

export type ServiceValue<Name extends string> = Name extends keyof Services ? Services[Name] : unknown;

export interface ModuleContext {
  readonly id: string;
  readonly kernelVersion: string;
  use<Name extends string>(service: Name): ServiceValue<Name>;
  optional<Name extends string>(service: Name): ServiceValue<Name> | undefined;
  has(service: string): boolean;
  provide<Name extends string>(name: Name, api: ServiceValue<Name>): Undo;
  contribute<P extends string, const E extends Entry>(place: P, entry: E & PlaceItem<NoInfer<P>, NoInfer<E["id"]>>): Undo;
  definePlace<E extends Entry>(def: PlaceDef<E>): Undo;
  effect(fn: () => Undo | void): Undo;
  on: Bus["on"];
  emit: Bus["emit"];
  listen(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions): Undo;
  timeout(fn: () => void, ms: number): Undo;
  interval(fn: () => void, ms: number): Undo;
  frame(fn: (t: number) => void): Undo;
  observe(observer: { disconnect(): void }): Undo;
  readonly signal: AbortSignal;
  onFlush(key: string, fn: () => void): Undo;
  invalidate(key?: string): void;
  pushLayer(layer: Layer): Undo;
  readonly layers: Pick<Layers, "back" | "escape" | "open">;
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
  dispose(): void;
  start(opts?: { safe?: boolean; disabled?: string[] }): Promise<StartReport>;
  enable(id: string): Promise<StartReport>;
  disable(id: string): Promise<string[]>;
  status(id: string): ModuleStatus | undefined;
  live(id: string): number;
  modules(): ReadonlyArray<{ id: string; status: ModuleStatus; error?: string; manifest: ModuleManifest }>;
}
