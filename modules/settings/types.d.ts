export interface ShapeViewDeps {
  shape: any;
  announce?: (text: string) => void;
  notice?: (n: { text: string; sub?: string }) => void;
}
export interface ShapeViewState {
  confirm: string | null;
  err: string | null;
  pickErr: string | null;
  draft: string | null;
  saveErr: string | null;
  unkept: string | false | null;
  sharedAt: string | null;
  built: boolean;
}
export interface ShapeCheck { doc?: any; problems?: { from: string; path?: string; text: string }[]; error?: string }
export interface KeysPageDeps {
  box: HTMLElement;
  state: { recording: string | null; keyErr: { id: string; msg: string } | null };
  announce: (text: string) => void;
  resetIcon: string;
}
export interface SettingsFrameDeps {
  el: HTMLElement; side: HTMLElement; phoneButton: HTMLElement; closeButton: HTMLElement;
  onPage: (id: string) => void; beforeOpen: () => void; beforeClose: () => void; onHidden: () => void;
  focusIn: (el: HTMLElement) => void; fallback: () => Element | null; phone: MediaQueryList;
}
export interface SettingsState {
  router: any; models: any[]; rules: any[] | null; defaults: any[]; trees: any[] | null; reported: any[];
  err: Record<string, any>; form: string | null; confirm: any;
}
