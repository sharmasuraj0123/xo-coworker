import type { RankedNeed } from "../../core/services/decision-types.d.ts";
import type { goneLine } from "./cardparts.js";

export type Thread = { id: string; host?: boolean };
export type Need = RankedNeed & { ask: { item?: { id: string } } };
export type Gone = NonNullable<Parameters<typeof goneLine>[0]> & { at: number };

export type DockState = {
  key: string | null;
  item: string | null;
  busy: boolean;
  undone: { key: string; end(): void } | null;
  gen: number;
};

export type Mount = {
  el: HTMLElement;
  view: () => string;
  region: () => HTMLElement;
  TD?: DockState;
};

export type DockDeps = {
  CH: { isChats(view: string): boolean; confirmHtml(view: string): string };
  D: {
    isOpen(): boolean;
    cardHtml(need: Need, surface: "dock"): string;
    cardTitle(need: Need): string;
    wireCard(frame: HTMLElement, inner: Element, need: Need, options: {
      surface: "dock"; onStep(): void; after(how: string): Promise<void>;
    }): void;
    decisions(): { verb: string; said?: string }[];
    needItems(): Need[];
    undo(): boolean;
    cardKeys(event: KeyboardEvent, card: Element, options: object): void;
  };
  S: { dockFold: Record<string, boolean> };
  world: { state: { gone: { get(id: string | null): Gone | undefined } } };
  convThread: (view: string) => Thread | null;
  convHost: (view: string) => Thread | null;
  askShort: (need: Need) => string;
  schedule: () => void;
  dockGestures: (dock: HTMLElement) => void;
};
