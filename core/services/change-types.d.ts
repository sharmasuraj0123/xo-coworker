export interface DiffOptions {
  path?: string; wrap?: boolean; split?: boolean; key?: string;
  loadFiles?: (fileDiff: any) => Promise<{ oldFile: unknown; newFile: unknown }> | { oldFile: unknown; newFile: unknown };
  onSelect?: (range: unknown) => void;
}
export interface ChangeFile {
  path: string; status?: string; old_path?: string | null; binary?: boolean; patch_omitted?: string | null;
  patch?: string | null; additions?: number | null; deletions?: number | null; [k: string]: unknown;
}
export interface HttpError { status?: number; code?: string; name?: string; message?: string }
export interface Scope { key: string; project: string; worktree: string | null; root?: string | null; tid?: string; base?: string }
export interface DiffHandle { update(patch: string, key?: string): void; split(on: boolean): void; destroy(): void }
export interface ChangesApi {
  projectChanges(project: string, q?: { worktree?: string, path?: string }): Promise<any>;
  projectImage(project: string, rel: string, opts?: { signal?: AbortSignal }): Promise<Blob>;
  projectVersion(project: string, rel: string, q: { commit: string | null, was: any }, opts?: { signal?: AbortSignal }): Promise<Blob>;
}
