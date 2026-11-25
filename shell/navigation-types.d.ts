import type { createNavigationState } from "./navigation-state.js";

declare module "../core/kernel/types" {
  interface Services { navigation: ReturnType<typeof import("./navigation.js").createNavigation> }
  interface Topics {
    "app:view-preparing": { changed: boolean; panel: boolean };
    "app:view-visited": undefined;
    "app:view-restoring": undefined;
    "app:return-target": HTMLElement | null;
  }
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

export type LeaveGuard = (resume: () => void) => boolean;

export interface NavigationDeps {
  location: ReturnType<typeof createNavigationState>;
  bus: Pick<import("../core/kernel/types").Bus, "emit">;
  say: HTMLElement;
  scroller: HTMLElement;
  pageEl: (view: string) => HTMLElement | null;
  convThread: (view: string) => { project: string } | null | undefined;
}
