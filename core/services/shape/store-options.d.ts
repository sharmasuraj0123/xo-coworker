import type { Change } from "./changes.js";

export interface Store extends Pick<Storage, "getItem" | "setItem" | "removeItem"> {
  ephemeral?: boolean;
}

export interface ShapeView {
  shape: Record<string, unknown> | null;
  version: string | null;
}

interface Remote {
  get(): Promise<unknown>;
  put(body: { shape: unknown; if_version: string }): Promise<unknown>;
}

export interface Sync {
  mode: string;
  version: string | null;
  synced: ShapeView["shape"];
  knows: boolean;
  known: unknown;
  pend: Change[][];
  busy: Promise<void> | null;
  heard: unknown;
  retried: boolean;
  read: Promise<void>;
  held: Change[][];
  why: string | null;
  text: string;
  kept: boolean;
  tries: number;
  localOk: boolean;
}

export interface ShapeStoreOptions {
  storage?: Store;
  load?: (id: string, signal?: AbortSignal) => Promise<unknown>;
  caps?: { has(name: string): boolean } | null;
  remote?: Remote | null;
  notice?: (notice: { text: string; sub: string }) => void;
  retryMs?: number[];
}

export interface ShapeSyncOptions {
  scope: import("../../kernel/types").Lifetime;
  remote: Remote | null;
  notice: NonNullable<ShapeStoreOptions["notice"]>;
  retryMs: number[];
  storage: {
    read(key: string): unknown;
    write(key: string, value: unknown): boolean;
    clearUnsynced(): unknown;
    keys: { mine: string; unsynced: string };
  };
  local: {
    mine: unknown;
    build(): void;
    emit(): void;
    ensurePreset(): void;
    newer(from: string): boolean;
  };
}

export interface SyncActions {
  hold(why: string, text: string): void;
  unhold(): void;
  later(): void;
  settleHeld(): void;
  setMine(doc: unknown): boolean;
}
