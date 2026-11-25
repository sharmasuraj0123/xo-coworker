import type { At, PlaceEntries, PlaceDef, Undo } from "../core/kernel/types";

type PressAction = PlaceEntries["header.action"];
type Mount = { mount(host: HTMLElement, at: At): Undo | void };
type Render = { render(host: HTMLElement, at: At): void };

type KeysMatching<T, V> = Extract<{ [K in keyof T]-?: NonNullable<T[K]> extends V ? K : never }[keyof T], string>;
type Callback = (...args: never[]) => unknown;
export type CatalogSpec = { [P in keyof PlaceEntries]: [
  P, PlaceDef["kind"], PlaceDef["scope"], string, boolean,
  KeysMatching<PlaceEntries[P], string>[], KeysMatching<PlaceEntries[P], Callback>[],
] }[keyof PlaceEntries];

declare module "../core/kernel/types" {
  interface PlaceEntries {
    "rail.entry": PressAction;
    "rail.foot": PressAction;
    "rail.section": Mount;
    "dock.bottom": Mount;
    "header.title": Render;
    "header.badge": Render;
    command: { label: string; description?: string; slash?: string; run(at: At, args?: unknown): unknown };
    shortcut: { keys: string; command: string };
    "pre-paint": { apply(root: HTMLElement): void };
  }
}
