import type { createLaunchpad } from "./launchpad.js";

type Launchpad = ReturnType<typeof createLaunchpad>;
export type OverviewRow = NonNullable<ReturnType<Launchpad["overview"]>[number]>;

export interface LaunchpadPageOptions {
  el: HTMLElement;
  launch: Pick<Launchpad, "overview">;
  projects(): string[];
  iconOf(project: string): string;
  open(view: string, from: HTMLElement): void;
  press(action: string): void;
}

export interface LaunchpadWindowOptions {
  launch: Pick<Launchpad, "mount" | "paint" | "away" | "press">;
  projectOf(view: string | null): string | null;
  nameOf(project: string | null): string;
  iconOf(project: string | null): string;
  allApps?(): void;
  onChange?(): void;
}

import type { WorldThread } from "../../core/services/world/state-types.d.ts";
import type { createLaunchpadHerald } from "./herald.js";
export interface LaunchpadHost {
  world: { thread(id: string): WorldThread | undefined | null; state: { threads: WorldThread[] } };
  isBusy(thread: WorldThread): boolean;
  isHeld(thread: WorldThread): boolean;
  PROJ(id: string | null): string;
  projectIcon(id: string): string;
  projects(): { id: string }[];
  go(view: string): void;
  announce(text: string): void;
  schedule(): void;
  notices: Parameters<typeof createLaunchpadHerald>[0];
}

declare module "../../core/kernel/types" {
  interface Services { launchpad: Pick<import("./surface.js").LaunchpadSurface, "LP" | "LW" | "LPP"> }
}
