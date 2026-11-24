import type { api } from "../../core/platform/api.js";
import type { EditorState } from "./cm-types";

export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface Draft { text: string; base: string; version: string | null; at: number }
export interface By { kind?: string; thread_ts?: string | null; [k: string]: unknown }
export interface Clock { now(): number; set(f: () => void, ms: number): unknown; clear(id: unknown): void }
export interface ChangeInfo { version?: string | null; kind?: string; at?: string | null; by?: By | null; id?: string | null }

type FileVersion = ChangeInfo & { text?: string | null; gone?: boolean };

export interface ViewerDocument {
  key: string;
  project: string;
  rel: string;
  state: string;
  kind?: string | null;
  cmState?: EditorState | null;
  version: string | null;
  versions: FileVersion[];
  viewing: FileVersion | null;
  checkedSig?: string;
  err?: string | null;
  merge?: { left: number; other: string } | null;
  confirm?: boolean;
}

export interface DocsDeps {
  api: Pick<typeof api, "projectFile" | "saveProjectFile">;
  store?: Store | null;
  clock?: Clock;
  onChange?: (doc: ViewerDocument, what: string) => void;
}
