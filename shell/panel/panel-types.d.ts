import type { At, Entry, Kernel } from "../../core/kernel/types";
import type { Agent, Change, Group } from "./list-types";

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
  agents(view: string): Agent[];
  mode: string;
  setMode(mode: string): void;
  show(view: string): void;
  hide(): void;
}
export interface MapFrame extends Entry { mount(host: HTMLElement): void; api: MapApi }
interface ChangesFrameOptions {
  view(): string;
  openFile(scope: { project: string; worktree?: string | null }, path: string, from?: Element | null): void;
  onChange(): void;
}
interface ChangesPanel {
  head(): { count: number; total: { add: number; del: number }; follow: boolean } | null;
  paint(): void;
  toggleFollow(): void;
  select(path: string): boolean;
  resume(view: string): void;
  chosen(view: string): string | null;
}
export interface ChangesFrame extends Entry {
  mount(host: HTMLElement, options: ChangesFrameOptions): ChangesPanel;
  theme(theme: string): void;
}
export interface FrameState {
  changes: { folded: boolean };
  agents: { folded: boolean; rows: number | null; h?: number; groups: Record<string, boolean> };
  map: { folded: boolean; h: number };
}
interface GithubPanel { has(view: string): Promise<boolean>; show(): void; leave?(): void }
export interface StageDeps {
  files: { changes(view: string): Change[] };
  openFiles?: (() => void) | null;
  github?: GithubPanel | null;
  place?(view: string): boolean;
  viewer: { open(file: StageFile, from?: Element | null): void };
  view(): string;
  go(view: string, event?: Event): void;
  announce(message: string): void;
  onChange?(): void;
  frames?(): string[];
  threads?: ((view: string) => Group[]) | null;
  shell?: ((on: boolean, host?: HTMLElement, view?: string) => void) | null;
  owns?(event: Event): boolean;
  at(): At;
  places: Kernel["places"];
}
