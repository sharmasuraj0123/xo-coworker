import type { ScopeThread } from "./file-scope-types.d.ts";
import type { Turns } from "./types.d.ts";

export interface DiffOptions {
  path?: string; wrap?: boolean; split?: boolean; key?: string; signal?: AbortSignal;
  loadFiles?: (fileDiff: { name: string; prevName?: string }) => Promise<DiffFiles> | DiffFiles;
  onSelect?: (range: unknown) => void;
}
type DiffFiles = { oldFile: unknown; newFile: unknown };
export interface ChangeFile {
  path: string; status?: string; old_path?: string | null; binary?: boolean; patch_omitted?: string | null;
  patch?: string | null; additions?: number | null; deletions?: number | null; [k: string]: unknown;
}
export interface HttpError { status?: number; code?: string; name?: string; message?: string }
export interface Scope { key: string; project: string; worktree: string | null; root?: string | null; tid?: string; base?: string }
export interface DiffHandle { update(patch: string, key?: string): void; split(on: boolean): void; destroy(): void }
export interface ChangesApi {
  projectChanges(project: string, q?: { worktree?: string, path?: string }): Promise<ChangePage>;
  projectImage(project: string, rel: string, opts?: { signal?: AbortSignal }): Promise<Blob>;
  projectVersion(project: string, rel: string, q: { commit: string; was?: string | null }, opts?: { signal?: AbortSignal }): Promise<Blob>;
}

export interface ChangePage { files?: ChangeFile[]; base_commit?: string | null; computed_at?: string; total_files?: number }
export type ChangeThread = ScopeThread & { sessionId?: string | null };
export interface ChangesWorld {
  thread(id: string): ChangeThread | null | undefined;
  state: { threads: readonly (ChangeThread | null)[]; turns?: Turns | null };
}
