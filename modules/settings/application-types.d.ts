import type { ShapeApplyDeps } from "./apply-shape-types";
import type { ShapeViewDeps, SettingsSurfaceHost } from "./types";
export type Appearance = Omit<ShapeApplyDeps, "SHAPE" | "SV"> & Required<ShapeViewDeps>;
export type SettingsBindings = Pick<SettingsSurfaceHost, "phone" | "beforeOpen" | "onHidden" | "focusIn" | "fallback"
  | "preferences" | "mountRuntimes">
  & { at(): { project?: string } };
