import type { createShellOpeners } from "./dock-open.js";

interface ShellThread {
  project: string;
  chatId?: string;
  id: string;
  title: string;
}

export interface ShellPanelDeps {
  view: () => string;
  STAGE: { isShell: boolean; shellOff: () => void };
  SH: ReturnType<typeof createShellOpeners> & {
    enabled: boolean;
    hide: () => void;
  };
  world: { thread: (id: string) => ShellThread | null | undefined };
  heraldShow: (notice: { kind: string; text: string }, ms: number) => void;
}

declare module "../../core/kernel/types" {
  interface Services {
    shellDock: ReturnType<typeof import("./dock.js").createShells>;
    shellPanel: ReturnType<typeof import("./panel.js").createShellPanel>;
  }
}
