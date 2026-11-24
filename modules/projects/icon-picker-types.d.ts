import type { ProjectIconWorld } from "./icon-choice-types.d.ts";

export interface IconPickerDeps {
  world: ProjectIconWorld;
  SHAPE: { patchMine: (patch: { layout: { icons: Record<string, string | null> } }) => unknown };
  PROJ: (id: string) => string;
  ownIcon: (id: string) => string | null;
  forgetIcon: (id: string) => unknown;
  announce: (text: string) => void;
  render: () => void;
  wirePickKeys: (element: HTMLElement, closePick: (options?: { focus?: boolean }) => void) => void;
}
