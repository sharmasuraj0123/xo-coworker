export interface PanelThreadPress {
  target?: { closest?: (selector: string) => { dataset: { goMsg?: string } } | null } | null;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

export interface PanelThreadDeps<C> {
  S: { view: string };
  world: { thread: (tid: string) => unknown };
  STAGE: { show: (page: string, id: string, options: { focus: boolean }) => void };
  TP: { C: C };
  go: (view: string, opts: { panel: boolean }) => void;
  showMsg: (message: string, conversation?: C) => void;
}
