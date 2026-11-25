import type { createFiles } from "./files.js";
import type { createFileViewer } from "./viewer.js";
import type { createStage } from "../../shell/panel/panel.js";
import type { FilesDependencies } from "./files-types.d.ts";
import type { ViewerOptions } from "./viewer-types.d.ts";

export type Viewer = ReturnType<typeof createFileViewer>;
export type FilesTree = ReturnType<typeof createFiles>;
export type FilesStage = Pick<ReturnType<typeof createStage>, "show" | "pageShown" | "back">;
export interface FilesPageDeps {
  stage: FilesStage;
  files: FilesTree;
  viewer: Viewer;
  view(): string;
  announce?(text: string): void;
}
export interface FilesModuleOptions {
  ask: ViewerOptions["ask"];
  opened(): void;
  closed(): void;
  paths(): FilesDependencies["paths"];
}
