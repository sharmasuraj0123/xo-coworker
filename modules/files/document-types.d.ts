import type { api } from "../../core/platform/api.js";
import type { EditorState } from "./cm-types";
import type { createScope } from "../../core/kernel/scope.js";
import type { ProjectFile } from "../../core/platform/project-response-types.d.ts";

export type Store = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export interface Draft { text: string; base: string; version: string | null; at: number }
export interface By { kind?: string; thread_ts?: string | null; [k: string]: unknown }
export interface Clock { now(): number; set(f: () => void, ms: number): unknown; clear(id: unknown): void }
export interface ChangeInfo { version?: string | null; kind?: string; at?: string | null; by?: By | null; id?: string | null }

export type FileVersion = ChangeInfo & { text?: string | null; gone?: boolean; t?: number; restores?: string | null };
export type DocumentData = Partial<Pick<ProjectFile, "content" | "editable" | "kind" | "line_endings" |
  "modified_at" | "not_editable_reason" | "place" | "truncated" | "version">>;
export type DocumentText = { content: string; version: string | null };
export type DocumentState = "saved" | "dirty" | "saving" | "error" | "deleted" | "readonly" | "conflict";
type DocumentEdit = { from: number; to: number; insert: string };
export interface DocumentHooks {
  source?: (() => string) | null;
  length?: (() => number) | null;
  apply?: ((edit: DocumentEdit, info?: { lines?: { from: number; to: number }[]; why?: string } | null) => void) | null;
}

type DocumentMerge = { base: string; mine: string; theirs: string; version: string | null;
  text: string; other: string; left: number; saving: boolean };

export interface ViewerDocument {
  key: string;
  project: string;
  rel: string;
  state: DocumentState;
  kind?: string | null;
  cmState?: EditorState | null;
  version: string | null;
  versions: FileVersion[];
  viewing: FileVersion | null;
  checkedSig?: string;
  err: string | null;
  merge: DocumentMerge | null;
  confirm: boolean;
  refs: number;
  text: string;
  base: string;
  place: string | null;
  lineEndings: string | null;
  confirmed: boolean;
  offline: boolean;
  source: NonNullable<DocumentHooks["source"]> | null;
  apply: NonNullable<DocumentHooks["apply"]> | null;
  length?: DocumentHooks["length"];
  cancelDraft: () => void;
  inflight: Promise<void> | null;
  again?: boolean;
  deleted?: boolean;
  declined?: boolean;
  restoreOf?: string | null;
  restoring?: boolean;
}

export interface DocsDeps {
  api: Pick<typeof api, "projectFile" | "saveProjectFile">;
  store?: Store | null;
  clock?: Clock;
  scope?: ReturnType<typeof createScope>;
  onChange?: (doc: ViewerDocument, what: string) => void;
}
