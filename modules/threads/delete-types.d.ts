export interface DeleteRefusal extends Error {
  code: "would_lose_work";
  confirm?: string | null;
  what?: { summary?: string | null; confirm?: string | null };
}

export interface ThreadDeletePrompt {
  id: string;
  loss: { summary: string | null; confirm: string | null } | null;
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
  world: {
    thread: (id: string) => { project: string; title: string; branch?: string | null } | null | undefined;
    act: {
      deleteThread?: (id: string, options: { keepBranch: boolean; confirm: string | null }) => Promise<{ row: Row; undo_until?: string }>;
      restoreThread: (id: string, row: Row) => Promise<unknown>;
    };
  };
  render: () => void;
  view: () => string;
  go: (view: string) => unknown;
  announce: (text: string) => void;
  heraldShow: (notice: DeleteNotice, ms: number) => unknown;
  PROJ: (project: string) => string;
}
