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

export interface SurfaceOptions {
  places: Places;
  place: string;
  scope: SurfaceScope;
  schedule: () => void;
  fallback: () => HTMLElement | null;
  hideOnRetire?: boolean;
}
