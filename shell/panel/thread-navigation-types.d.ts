export interface PanelThreadPress {
  target?: EventTarget | null;
  detail?: number;
  pointerType?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
}

type EntryInput = import("../../core/ui/a11y/focus.js").EntryInput;
export type ShowPage = (page: string, id: string, options: { focus: boolean; input: EntryInput }) => void;

export interface PanelThreadDeps<C> {
  view(): string;
  world: { thread: (tid: string) => unknown };
  panelConversation(): C | null | undefined;
  go: (view: string, opts: { panel: boolean }) => void;
  showMsg: (message: string, conversation?: C) => void;
}
