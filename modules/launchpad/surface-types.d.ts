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
