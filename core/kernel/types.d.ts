// The kernel contract (v1): what a module can rely on. Everything here is semver-versioned with the
// places (architecture/PLAN.md §3.6): adding a place or an optional field is a minor version; changing or
// removing one is a major version after one minor of deprecation. Modules see ONLY ModuleContext.

/** Undoes one registration. Calling it twice is harmless. */
export type Undo = () => void;

/** Where an entry applies. Wider scopes contain narrower ones. */
export type Scope = "app" | "project" | "conversation";

/**
 * How a place holds its entries:
 * - single: at most one entry at a time (a second contribute throws until the first is undone);
 * - list: ordered (by `order`, then registration), optionally arranged by the shape (reorder / hide);
 * - keyed: one entry per `id` (a duplicate id throws); looked up by id;
 * - chain: ordered by `priority` (high first, then registration); `first(at)` is the first whose `when(at)` holds.
 */
export type PlaceKind = "single" | "list" | "keyed" | "chain";

/** What the view is about when a place is read: entries may filter on it with `when`. */
export interface At {
  view?: string;          // "home", "ws", "p:<project>", "t:<thread>", "c:<chat>", "artifacts", "chats"
  project?: string;
  conversation?: string;
  [k: string]: unknown;
}

/** Every entry has an id (unique in its place) and may say when it applies and where it sorts. */
export interface Entry {
  id: string;
  order?: number;          // list: lower first (default 0)
  priority?: number;       // chain: higher first (default 0)
  when?(at: At): boolean;  // list/chain/keyed: hidden or skipped while false
}

/** An entry as read back: the contributor's own object, plus who contributed it. */
export type Contributed<E extends Entry = Entry> = E & { readonly owner: string };

export interface PlaceDef<E extends Entry = Entry> {
  id: string;              // dotted lower-case, e.g. "panel.page"; "preview:" prefix = experimental
  kind: PlaceKind;
  scope: Scope;
  description: string;     // one plain sentence: what goes here
  openToApps?: boolean;    // sandboxed apps may contribute (through the apps-host)
  check?(entry: E): void;  // throws a plain-words Error when an entry is malformed
}

/** Reorders or hides a list's entries (the shape registers one per list place). */
export type Arranger = (entries: Contributed[], at: At) => Contributed[];

export interface Places {
  define<E extends Entry>(def: PlaceDef<E>, owner?: string): Undo;
  contribute<E extends Entry>(place: string, entry: E, owner: string): Undo;
  /** list/chain: the visible entries in order; keyed: all, by id; single: [] or [the one]. */
  entries<E extends Entry>(place: string, at?: At): Contributed<E>[];
  get<E extends Entry>(place: string, id: string): Contributed<E> | undefined;
  /** chain/list: the first visible entry; single: the entry. */
  first<E extends Entry>(place: string, at?: At): Contributed<E> | undefined;
  arrange(place: string, fn: Arranger): Undo;
  watch(place: string, fn: () => void): Undo;
  has(place: string): boolean;
  catalog(): ReadonlyArray<Readonly<PlaceDef> & { owner: string; entries: number }>;
}

export interface Bus {
  on<T = unknown>(topic: string, fn: (payload: T) => void): Undo;
  once<T = unknown>(topic: string, fn: (payload: T) => void): Undo;
  /** Synchronous; a listener that throws is logged and never stops the others. */
  emit<T = unknown>(topic: string, payload?: T): void;
}

/** Batches redraws: invalidate(key) runs that key's flushers once, in the next frame (or microtask). */
export interface Scheduler {
  onFlush(key: string, fn: () => void): Undo;
  invalidate(key?: string): void;     // no key = every flusher
  flushNow(): void;                    // tests, and code that must draw in this task
}

/** One stack of open layers (sheets, dialogs, popovers, panels). Escape, phone Back, inert and the Tab trap
 *  all read it, so they can never disagree again. */
export interface Layer {
  id: string;
  /** true when it took the key (closed itself, or closed something inside). */
  escape?(): boolean;
  back?(): boolean;
  /** modal layers make what is under them inert and trap Tab. */
  modal?: boolean;
  /** the element that should get focus back when this layer goes. */
  returnFocus?: Element | null;
}
export interface Layers {
  push(layer: Layer, owner?: string): Undo;
  top(): Layer | undefined;
  list(): ReadonlyArray<Layer>;
  escape(): boolean;   // offers Esc to the top layer, then the next, until one takes it
  back(): boolean;
  watch(fn: () => void): Undo;
}

/** module.json: static, readable without running anything (catalogue, ledger, route contract). */
export interface ModuleManifest {
  id: string;              // "xo.<name>" for first-party modules
  version: string;         // semver
  kernel: string;          // the kernel API range it was written for, e.g. "^1"
  description?: string;
  needs?: string[];        // services it uses (ctx.use); it activates after their providers
  provides?: string[];     // services it offers (ctx.provide)
  contributes?: string[];  // "place" or "place:id"; ctx.contribute outside this list throws
  defines?: string[];      // places it defines
  routes?: string[];       // "GET /chat/status" ... (checked against xo-space's OpenAPI)
  storage?: string[];      // "local:cv-theme", "session:xo-shells", "local:xo-draft:*"
  styles?: string[];       // its stylesheets, loaded before activate
  vendor?: string[];       // "xterm@6.0.0"
  core?: boolean;          // can't be disabled (kernel, shell, decisions)
}

export interface ModuleDef {
  manifest: ModuleManifest;
  activate(ctx: ModuleContext): void | Promise<void>;
}

/** All a module can reach. Everything registered through it is undone, in reverse order, when the
 *  module is disabled or fails: listeners, timers, observers, entries, services, layers. */
export interface ModuleContext {
  readonly id: string;
  readonly kernelVersion: string;
  use<T = unknown>(service: string): T;           // must be in manifest.needs
  has(service: string): boolean;
  provide<T>(name: string, api: T): Undo;         // must be in manifest.provides
  contribute<E extends Entry>(place: string, entry: E): Undo;
  definePlace<E extends Entry>(def: PlaceDef<E>): Undo;
  effect(fn: () => Undo | void): Undo;            // run now; its returned Undo runs on deactivate
  on<T = unknown>(topic: string, fn: (payload: T) => void): Undo;
  emit<T = unknown>(topic: string, payload?: T): void;
  listen(target: EventTarget, type: string, fn: EventListenerOrEventListenerObject, opts?: boolean | AddEventListenerOptions): Undo;
  timeout(fn: () => void, ms: number): Undo;
  interval(fn: () => void, ms: number): Undo;
  frame(fn: (t: number) => void): Undo;           // one requestAnimationFrame
  observe(observer: { disconnect(): void }): Undo; // ResizeObserver, MutationObserver, IntersectionObserver
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
  disable(id: string): Promise<string[]>;        // the ids that went down (dependents first)
  status(id: string): ModuleStatus | undefined;
  /** How many undos a module still holds: 0 after disable, or it leaked (the conformance test). */
  live(id: string): number;
  modules(): ReadonlyArray<{ id: string; status: ModuleStatus; error?: string; manifest: ModuleManifest }>;
}
