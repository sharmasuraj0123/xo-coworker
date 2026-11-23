export interface NavigationOptions {
  from?: string;
  row?: string | null;
  focus?: boolean;
  carry?: boolean;
  panel?: boolean;
  still?: boolean;
}

interface NavigationState {
  view: string;
  tEdit: unknown;
  tMenu: unknown;
  retrace: boolean;
  trail: string[];
  parent: Record<string, string>;
  backTo: Record<string, { view: string, k: string } | null>;
  scroll: Record<string, number>;
}

interface LayerClose {
  close: (options: { restore: boolean }) => void;
}

export interface NavigationDeps {
  S: NavigationState;
  VW: { editing: boolean, leave: (next: () => void) => void };
  STAGE: { isOpen: boolean, leave: () => void, close: (options: { restore: boolean, quiet: boolean }) => void };
  IQ: LayerClose;
  PHONE: Pick<MediaQueryList, "matches">;
  REC: { leave: (from: string, to: string) => void };
  TD: { key: unknown };
  tdock: HTMLElement & { _ch?: string };
  say: HTMLElement;
  scroller: HTMLElement;
  closeSettings: LayerClose["close"];
  setDrawer: (open: boolean) => void;
  saveScroll: () => void;
  saveDraft: () => void;
  follow: () => void;
  pageEl: (view: string) => HTMLElement | null;
  loadDraft: () => void;
  render: () => void;
  returnPill: (target: HTMLElement | null) => void;
}
