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
export interface Total { add: number; del: number }
export interface PlaceChanges {
  state: "idle" | "loading" | "ok" | "error" | "unsupported"; data: any; files: Map<string, ChangeFile>; total: Total;
  sig: string | null; inflight: boolean; again: boolean; timer: ReturnType<typeof setTimeout> | 0; err?: string | null;
}
export interface Activity { sig: string; busy: boolean; live: Set<string>; last: string | null }
export interface Counts { additions?: number | null; deletions?: number | null; add?: number | null; del?: number | null }
export interface FollowState { follow: boolean; sel: string | null; pill: string | null; sig: string | null; all?: boolean; reveal?: Set<string | undefined> | null }
export interface DiffHandle { update(patch: string, key?: string): void; split(on: boolean): void; destroy(): void }
export interface Drawn {
  key: string | null; path: string | null; patch: string | null; ver: unknown; handle: DiffHandle | null; img: { drop(): void } | null;
  gen: number; failed: boolean; pend?: { key: string; path: string; patch: string | null; ver: unknown } | null;
}
export type FrameFile = ChangeFile & { live?: boolean; version?: unknown };
export interface FrameDeps {
  host: HTMLElement; changes: import("./store.js").Changes; view: () => string;
  openFile: (s: Scope, path: string, from: HTMLElement | null) => void; onChange?: () => void;
}
export interface ChangesApi {
  projectChanges(project: string, q?: { worktree?: string, path?: string }): Promise<any>;
  projectImage(project: string, rel: string, opts?: { signal?: AbortSignal }): Promise<Blob>;
  projectVersion(project: string, rel: string, q: { commit: string | null, was: any }, opts?: { signal?: AbortSignal }): Promise<Blob>;
}
