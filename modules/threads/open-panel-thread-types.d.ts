export interface PanelThreadPress {
  target?: EventTarget | null;
  detail?: number;
  pointerType?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

export interface PanelThreadDeps<C> {
  view(): string;
  world: { thread: (tid: string) => unknown };
  STAGE: { show: (page: string, id: string, options: { focus: boolean; input: import("../../core/ui/a11y/focus.js").EntryInput }) => void };
  TP: { C: C | null };
  go: (view: string, opts: { panel: boolean }) => void;
  showMsg: (message: string, conversation?: C) => void;
}
