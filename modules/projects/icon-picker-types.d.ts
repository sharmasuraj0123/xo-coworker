import type { ProjectIconWorld } from "./icon-choice-types.d.ts";

export type IconHost = Omit<IconPickerDeps, "ownIcon" | "forgetIcon">
  & Parameters<typeof import("./icon-choice.js").createProjectIconChoice>[0];

export interface IconPickerDeps {
  world: ProjectIconWorld;
  SHAPE: { patchMine: (patch: { layout: { icons: Record<string, string | null> } }) => unknown };
  PROJ: (id: string) => string;
  ownIcon: (id: string) => string | null;
  forgetIcon: (id: string) => unknown;
  announce: (text: string) => void;
  render: () => void;
}

declare module "../../core/kernel/types" {
  interface Services { projectIcons: Pick<ReturnType<typeof import("./icon-picker.js").createProjectIconPicker>, "PICK">
    & Pick<ReturnType<typeof import("./icon-choice.js").createProjectIconChoice>, "projectIcon"> }
}
