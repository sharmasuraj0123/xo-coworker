import type { At, Entry, Kernel } from "../../core/kernel/types";
import type { Agent, Change, Group } from "./list-types";

declare module "../../core/kernel/types" {
  interface KeyedPlaceEntries { "panel.frame:map": MapFrame; "panel.frame:changes": ChangesFrame }
  interface PlaceEntries {
    "panel.frame": MapFrame | ChangesFrame;
    "panel.page": import("./pages.js").PageSpec;
    "panel.title-action": PanelTitleAction;
  }
  interface Services { mapControls: MapApi; stage: ReturnType<typeof import("./panel.js").createStage> }
}

export type StageNavigation = Pick<ReturnType<typeof import("./panel.js").createStage>, "leave" | "close" | "isOpen">;

interface Page { name: string; key: string }
export interface StageState {
  open: boolean;
  full: boolean;
  returnTo: HTMLElement | null;
  stackH: number;
  h: Record<string, string>;
  page: Page | null;
  under: Page | null;
  tq?: string;
  tqOpen?: boolean;
  tgMore: Record<string, boolean>;
  resume?: boolean;
  chEmpty?: boolean;
}
interface StageFile { path: string; name?: string; project?: string; rel: string; show?: "changes" }
interface MapApi {
  mode: "graph" | "tree";
  setMode(mode: "graph" | "tree"): void;
  show(view: string): void;
  hide(): void;
}
export interface MapFrame extends Entry { title: string; mount(host: HTMLElement): void | (() => void) }
export interface ChangesFrameOptions {
  view(): string;
  openFile(scope: { project: string; worktree?: string | null }, path: string, from?: Element | null): void;
  onChange(): void;
}
interface ChangesPanel {
  dispose?(): void;
  head(): { count: number; total: { add: number; del: number }; follow: boolean } | null;
  paint(): void;
  toggleFollow(): void;
  select(path: string): boolean;
  resume(view: string): void;
  chosen(view: string): string | null;
}
export interface ChangesFrame extends Entry {
  title: string;
  mount(host: HTMLElement, options: ChangesFrameOptions): ChangesPanel;
  theme(theme: string): void;
}
export interface FrameState {
  changes: { folded: boolean };
  agents: { folded: boolean; rows: number | null; h?: number; groups: Record<string, boolean> };
  map: { folded: boolean; h: number };
}
export interface PanelTitleAction extends Entry {
  label: string;
  icon: string;
  onPress(): void;
  init?(button: HTMLButtonElement): void;
  sync?(button: HTMLButtonElement, view: string, page?: string): void;
  leave?(): void;
}
export interface StageDeps {
  mapControls?(): MapApi | undefined;
  files: { changes(view: string): Change[] };
  openFiles?: (() => void) | null;
  place?(view: string): boolean;
  viewer: { open(file: StageFile, from?: Element | null): void };
  view(): string;
  go(view: string, event: Event | undefined, show: import("./thread-navigation-types").ShowPage): void;
  announce(message: string): void;
  onChange?(): void;
  frames?(): string[];
  agents?: (view: string) => Agent[];
  threads?: ((view: string) => Group[]) | null;
  shell?: ((on: boolean, host?: HTMLElement, view?: string) => void) | null;
  owns?(event: Event): boolean;
  at(): At;
  places: Pick<Kernel["places"], "get" | "entries" | "watch" | "has" | "contribute">;
}
