export type FileLocation = { project?: string; rel?: string };
export type FileScope = { key: string; project?: string; base?: string; label?: string; sub?: string; tid?: string };
export type ScopeThread = { id: string; project?: string; worktree?: string | null; cwd?: string | null; branch?: string | null };
