import type { createShapeStore } from "../../core/services/shape/store.js";

export interface SideDeps {
  shape: Pick<ReturnType<typeof createShapeStore>, "get" | "patchMine" | "onChange" | "synced">;
  keys?: { hint(id: string): string };
  announce(text: string): void;
  render(): void;
  toggleJump(): void;
  scope: import("../../core/kernel/types").Lifetime;
}

export interface Place { id: string; name: string; sel?: string; ic?: () => string; set?: boolean }
export interface Bar { order: string[]; shown: string[] }

export interface Side {
  KEY: string;
  PINS: string;
  BAR: string;
  folded: boolean;
  editing: boolean;
  CORE: Place[];
  PLACES: Place[];
  extras: Map<string, HTMLElement>;
  fold(on: boolean, options?: { quiet?: boolean }): void;
  all(): Place[];
  byId(id: string): Place;
  bar(): Bar;
  save(bar: Bar): void;
  isDefault(bar?: Bar): boolean;
  reset(): void;
  adopt(): void;
  pin(id: string, on: boolean): void;
  move(id: string, dir: number, before?: string | null): void;
  apply(): void;
  drawMore(): void;
  edit(on: boolean): void;
  openMore(event: MouseEvent): void;
  closeMore(options?: { focus?: boolean }): void;
}
