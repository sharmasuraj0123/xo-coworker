import type { RunsReadDeps } from "./read-types.d.ts";
import type { RunsStopOptions } from "./stop-types.d.ts";

export interface RunsPanelDeps {
  RS: RunsReadDeps["RS"] & { refocus?: (() => void) | null };
  S: { tbOpen: Record<string, boolean> };
  world: { act: { feature?: (session: string, key: string) => boolean } };
  STAGE: {
    pageShown?: { name: string } | null;
    close(options: { restore: boolean }): void;
    closePage(name: string): void;
    repaint(): void;
    owns(element: Element | null): boolean;
  };
  runsCard: HTMLElement & { _h?: string };
  pendingStops: RunsStopOptions["pendingStops"];
  stopsOut: Set<string>;
  placeRegion: () => HTMLElement;
  threadScroller: () => HTMLElement | undefined;
}
