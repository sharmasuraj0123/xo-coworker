import type { createNavigationState } from "./navigation-state.js";

declare module "../core/kernel/types" {
  interface Services { navigation: { go(view: string, options?: NavigationOptions): void; back(): void } }
}

export interface NavigationOptions {
  from?: string;
  row?: string | null;
  focus?: boolean;
  carry?: boolean;
  panel?: boolean;
  still?: boolean;
  remember?: boolean;
}

interface LayerClose {
  close: (options: { restore: boolean }) => void;
}

export interface NavigationDeps {
  location: ReturnType<typeof createNavigationState>;
  VW: { editing: boolean, leave: (next: () => void) => void };
  STAGE: { isOpen: boolean, leave: () => void, close: (options: { restore: boolean, quiet: boolean }) => void };
  IQ: LayerClose;
  PHONE: Pick<MediaQueryList, "matches">;
  bus: Pick<import("../core/kernel/types").Bus, "emit">;
  clearDock: () => void;
  clearThreadEdit: () => void;
  say: HTMLElement;
  scroller: HTMLElement;
  closeSettings: LayerClose["close"];
  setDrawer: (open: boolean) => void;
  saveDraft: () => void;
  follow: () => void;
  pageEl: (view: string) => HTMLElement | null;
  loadDraft: () => void;
  render: () => void;
  returnPill: (target: HTMLElement | null) => void;
  convThread: (view: string) => { project: string } | null | undefined;
}
