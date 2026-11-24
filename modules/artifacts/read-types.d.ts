import type { MadeRow, MadeThread } from "./types";
import type { createScope } from "../../core/kernel/scope.js";

export type MadeReader = (
  chat: string,
  query: { limit: number; before?: string },
  options: { signal: AbortSignal }
) => Promise<{ made?: MadeRow[]; next_before?: string | null } | null>;

export interface MadeReadState {
  at: number;
  rows: MadeRow[] | null;
  more: string | null;
  end: boolean;
  off: boolean;
  olderFailed: boolean;
  pages: number;
  version: number;
  key: symbol;
  pendingPins: Map<string, boolean>;
  readingPins: Map<string, boolean> | null;
}

interface MadeProject {
  id: string;
  chatId?: string | null;
  name?: string;
}

export interface MadeWorld {
  state: { threads: MadeThread[]; projects: MadeProject[] };
  project(id: string): MadeProject | null | undefined;
}

export interface MadeStoreOptions {
  world: MadeWorld;
  api: {
    made: MadeReader;
    pinMade(chat: string, id: string, on: boolean): Promise<unknown>;
  };
  scope?: ReturnType<typeof createScope>;
  schedule(): void;
  announce(words: string): void;
  changed(): void;
}

export type CreateMadePins = (
  write: MadeStoreOptions["api"]["pinMade"],
  setPin: (chat: string, id: string, pinned: boolean, pending: boolean) => void,
  signal: AbortSignal,
  failed: (message: string) => void,
) => (chat: string, id: string, current: boolean) => void;
