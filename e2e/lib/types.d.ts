export type Row = Record<string, any>;

export interface Seed {
  now?: string;
  chats?: Row[];
  messages?: Record<string, Row[]>;
  threads?: Record<string, Row[]>;
  threadMessages?: Record<string, Row[]>;
  files?: Record<string, Record<string, string>>;
  routes?: Record<string, unknown>;
}

export interface Write { method: string; path: string; body: unknown; unknown?: boolean }

export interface Store {
  now: string;
  chats: Row[];
  messages: Record<string, Row[]>;
  threads: Record<string, Row[]>;
  threadMessages: Record<string, Row[]>;
  files: Record<string, Record<string, string>>;
  routes: Record<string, unknown>;
  statics: Record<string, unknown>;
  seq: number;
  writes: Write[];
  misses: string[];
}

export interface Ask { method: string; path: string; query: URLSearchParams; body: unknown }
export interface Answer { status: number; body: unknown; type?: string }

export interface FrameMeta { chat_id?: string | null; thread_ts?: string | null; session_id?: string | null; turn_id?: string | null; seq?: number | null }
export interface Frame extends FrameMeta { type: string; data: unknown }

export interface Space {
  base: string;
  store: Store;
  readonly open: number;
  readonly served: number;
  gate(path: string): () => void;
  idle(ms: number): Promise<boolean>;
  errors: string[];
  misses: string[];
  push(type: string, data?: unknown, meta?: FrameMeta): void;
  close(): Promise<void>;
}

export interface Probe {
  fetches: Map<number, string>;
  timers: Map<unknown, string>;
  frames: number;
  workers: number;
  quiet: number;
  changed: string[];
  n: number;
  drops: string[];
  busy(quietFrames: number): string[];
  checkDrops(): void;
}

export interface SettleOptions { timeout?: number; quietFrames?: number }

export interface Locator { ariaSnapshot(): Promise<string> }

export interface Page {
  waitForFunction<A>(fn: (arg: A) => unknown, arg: A, options: { polling: "raf"; timeout: number }): Promise<unknown>;
  evaluate<A, R>(fn: (arg: A) => R, arg?: A): Promise<R>;
}

export interface Tools {
  page: any;
  space: Space;
  store: Store;
  settle(o?: SettleOptions): Promise<number>;
  open(path?: string): Promise<number>;
  snap(name: string, locator?: Locator): Promise<void>;
  fail(msg: string): void;
}

export interface Case {
  file: string;
  name: string;
  seed?: string | Seed;
  viewport?: "desktop" | "phone" | { width: number; height: number };
  run(t: Tools): Promise<void>;
}
