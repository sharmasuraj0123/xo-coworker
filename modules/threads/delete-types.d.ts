export interface DeleteRefusal extends Error {
  code?: string;
  confirm?: string | null;
  what?: { summary?: string | null; confirm?: string | null };
}

interface DeleteNotice {
  kind: "done" | "stopped";
  text: string;
  sub: string;
  undo?: () => Promise<unknown>;
  undoUntil?: number;
  ownFocus?: boolean;
  force?: boolean;
}

export interface DeleteDeps<Row> {
  S: { tDel: string | null; tDelLose: { summary: string | null; confirm: string | null } | null };
  world: {
    thread: (id: string) => { project: string; title: string; branch?: string | null } | null | undefined;
    act: {
      deleteThread?: (id: string, options: { keepBranch: boolean; confirm: string | null }) => Promise<{ row: Row; undo_until?: string }>;
      restoreThread: (id: string, row: Row) => Promise<unknown>;
    };
  };
  render: () => void;
  go: (view: string) => unknown;
  announce: (text: string) => void;
  heraldShow: (notice: DeleteNotice, ms: number) => unknown;
  PROJ: (project: string) => string;
}
