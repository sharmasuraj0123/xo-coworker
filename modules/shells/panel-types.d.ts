interface ShellThread {
  project: string;
  chatId?: string;
  id: string;
  title: string;
}

export interface ShellPanelDeps {
  S: { view: string };
  STAGE: { isShell: boolean; shellOff: () => void };
  SH: {
    enabled: boolean;
    hide: () => void;
    openWorkspace: () => unknown;
    openProject: (project: string) => unknown;
    openThread: (thread: { project: string; chatId?: string; ts: string; title: string }) => unknown;
  };
  world: { thread: (id: string) => ShellThread | null | undefined };
  heraldShow: (notice: { kind: string; text: string }, ms: number) => void;
}
