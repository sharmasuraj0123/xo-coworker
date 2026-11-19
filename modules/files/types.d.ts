export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface Draft { text: string; base: string; version: string | null; at: number }
export interface EditorMountOptions {
  docs: any; doc: any; name?: string; page?: boolean;
  onLines?: ((l: { a: number, b: number } | null) => void) | null;
  onAsk?: ((l: { a: number, b: number }) => void) | null;
  onSave?: (() => void) | null;
  onKey?: ((e: KeyboardEvent) => boolean) | null;
}
export interface By { kind?: string; thread_ts?: string | null; [k: string]: unknown }
export interface Clock { now(): number; set(f: () => void, ms: number): unknown; clear(id: unknown): void }
export interface DocsDeps { api: any; store?: Store | null; clock?: Clock; onChange?: (doc: any, what: string) => void }
export interface ChangeInfo { version?: string | null; kind?: string; at?: string | null; by?: By | null; id?: string | null }
