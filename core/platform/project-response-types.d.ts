// @ts-check

export interface ProjectFile {
  project_id: string;
  relative_path: string;
  name: string;
  kind: string;
  size_bytes: number;
  truncated: boolean;
  content: string;
  modified_at?: string | null;
  version?: string | null;
  editable?: boolean;
  not_editable_reason?: string | null;
  place?: string | null;
  bom?: boolean;
  line_endings?: string | null;
}

export interface TreeEntry {
  name: string;
  relative_path: string;
  is_dir?: boolean;
  size_bytes?: number | null;
  modified_at?: string | null;
  entries?: number | null;
}

export interface ProjectTree {
  project_id: string;
  relative_path: string;
  parent_relative_path?: string | null;
  dirs: TreeEntry[];
  files: TreeEntry[];
}

export interface SavedProjectFile {
  relative_path: string;
  version: string | null;
  size_bytes: number;
  saved_at: string | null;
  edit_id: string | null;
  unchanged: boolean;
}

export interface ProjectVersion {
  id: string;
  n: number | null;
  path: string;
  worktree: string | null;
  kind: string;
  version: string | null;
  prev_version: string | null;
  at: string;
  by: { kind: string; thread_ts?: string | null; session_id?: string | null; turn_id?: string | null; message_id?: string | null };
  size_bytes: number | null;
  content_kept: boolean;
  old_path: string | null;
  current: boolean;
  restores: string | null;
}

export interface ProjectVersions {
  relative_path: string;
  versions: ProjectVersion[];
  head: { commit: string; version: string } | null;
  more: boolean;
}

export type ProjectPaths = { unchanged: true; stamp: string }
  | { unchanged?: never; root: string; paths: string[]; dirs: string[]; truncated: boolean; stamp: string };

export interface ProjectMatch {
  path: string;
  line: number;
  col: number;
  text: string;
  ranges: [number, number][];
}

export interface ProjectSearch {
  root: string;
  matches: ProjectMatch[];
  files: number;
  truncated: boolean;
  took_ms: number;
}

export interface ProjectFolder {
  relative_path: string;
}

export interface ProjectRename extends ProjectFolder {
  old_relative_path: string;
  kind: string;
  edit_id: string;
  version: string | null;
}

export interface ProjectDelete {
  edit_id: string;
  kind: string;
  count: number;
}

export interface ProjectChange {
  [key: string]: unknown;
  path: string;
  status: string;
  additions: number | null;
  deletions: number | null;
  binary: boolean;
  version: string | null;
  patch: string | null;
  old_path?: string;
  old_mode?: string;
  new_mode?: string;
  patch_omitted?: string;
}

export interface ProjectChanges {
  project_id: string;
  worktree: string | null;
  root: string;
  base_ref: string | null;
  base_commit: string | null;
  base_source: string;
  head_commit: string | null;
  computed_at: string;
  truncated: boolean;
  total_files: number;
  files: ProjectChange[];
}

export interface WorkspaceRootConfig {
  roots: Record<string, string>;
  default: string;
}

export interface CreatedProject {
  path: string;
  name: string;
  copied: string[];
}

export interface ProjectClone {
  clone_id: string;
  project_id: string;
  state: "cloning" | "done" | "failed" | "cancelled";
  phase: string;
  phase_percent: number | null;
  percent: number;
  received_bytes: number;
  idle_seconds: number;
  error: { code: string; message: string; detail?: string } | null;
  warning: string | null;
  started_at: string;
  finished_at: string | null;
}

export interface ProjectApi {
  projectFile(project: string, path: string, at?: { commit: string | null; path?: string } | null,
    options?: { purpose?: string; version?: string }): Promise<ProjectFile>;
  saveProjectFile(project: string, path: string, content: string, baseVersion: string | null,
    confirm?: string | null, options?: { restoreOf?: string | null }): Promise<SavedProjectFile>;
  projectVersions(project: string, path: string, options?: { limit?: number; before?: string | null }): Promise<ProjectVersions>;
  projectPaths(project: string, options?: { worktree?: string | null; stamp?: string | null }): Promise<ProjectPaths>;
  projectSearch(project: string, options?: { q?: string; worktree?: string | null; regex?: boolean;
    case?: boolean; word?: boolean; glob?: string | null; limit?: number }): Promise<ProjectSearch>;
  renameProjectFile(project: string, path: string, nextPath: string, confirm?: string | null): Promise<ProjectRename>;
  deleteProjectFile(project: string, path: string, baseVersion?: string | null, confirm?: string | null): Promise<ProjectDelete>;
  mkdirProject(project: string, path: string): Promise<ProjectFolder>;
  undoProjectEdit(project: string, editId: string): Promise<SavedProjectFile>;
  projectChanges(project: string, options?: { worktree?: string | null; path?: string | null }): Promise<ProjectChanges>;
  projectTree(project: string, path?: string | null, signal?: AbortSignal): Promise<ProjectTree>;
  workspaceConfig(): Promise<WorkspaceRootConfig>;
  createProject(project: { path: string; displayName?: string; description?: string }): Promise<CreatedProject>;
  cloneProject(clone: { id: string; url: string; displayName?: string; description?: string }): Promise<ProjectClone>;
  cloneStatus(cloneId: string): Promise<ProjectClone>;
  cancelClone(cloneId: string): Promise<ProjectClone>;
}
