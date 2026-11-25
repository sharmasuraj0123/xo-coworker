import type { Contributed, Entry, Places, Undo } from "../core/kernel/types";
import type { createScope } from "../core/kernel/scope.js";

export type SurfaceScope = ReturnType<typeof createScope>;

export type Surface<C> = Contributed<Entry & {
  mount?(host: HTMLElement): Undo | void;
  render(host: HTMLElement, context: C): void;
}>;

export interface FileRouteEntry extends Entry {
  route(target: Element, event: MouseEvent): boolean;
}

export interface ArtifactsPage extends Entry {
  count(): number;
  latestOf(thread: string, project: string): { key: string; path?: string; title?: string | null; name?: string } | null;
}

export interface SurfaceOptions {
  places: Places;
  place: string;
  scope: SurfaceScope;
  schedule: () => void;
  fallback: () => HTMLElement | null;
  hideOnRetire?: boolean;
}
