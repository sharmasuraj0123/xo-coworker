import type { ModuleContext, Places } from "../../core/kernel/types.d.ts";
import type { createScope } from "../../core/kernel/scope.js";
import type { createShapeStore } from "../../core/services/shape/store.js";

export interface ShapeViewDeps {
  shape: ReturnType<typeof createShapeStore>;
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
export interface ShapeCheck {
  doc?: Record<string, unknown>;
  problems?: { from: string; path?: string; text: string }[];
  error?: string;
}
export interface KeysPageDeps {
  box: HTMLElement;
  announce: (text: string) => void;
  resetIcon: string;
}
export interface SettingsFrameDeps {
  scope?: ReturnType<typeof createScope>;
  el: HTMLElement; side: HTMLElement; phoneButton: HTMLElement; closeButton: HTMLElement;
  onPage: (id: string) => void; beforeOpen: () => void; beforeClose: () => void; onHidden: () => void;
  onOpen?: (id: string | undefined) => void;
  focusIn: (el: HTMLElement) => void; fallback: () => Element | null; phone: MediaQueryList;
}
export interface SettingsSurfaceHost extends Omit<SettingsFrameDeps, "scope" | "onPage" | "beforeClose"> {
  at(): { project?: string };
  mountRuntimes(host: { scope: ModuleContext; root: HTMLElement }): { open(): void };
  shape: { apply(): void; open(): void };
}
export interface SectionEntry {
  id: string;
  label: string;
  icon?: string;
  order?: number;
  owner?: string;
  render(el: HTMLElement, at: { project?: string }): void | (() => void);
}
export interface SectionsDeps {
  places: Pick<Places, "entries" | "watch">;
  nav: HTMLElement; pages: HTMLElement; at: () => { project?: string }; pick: (id: string) => void; isOpen: () => boolean; onTabs?: () => void;
}
