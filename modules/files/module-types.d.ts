import type { createFiles } from "./files.js";
import type { createFileViewer } from "./viewer.js";
import type { createStage } from "../../shell/panel/panel.js";

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
declare module "../../core/kernel/types" {
  interface Services {
    files: { tree: FilesTree; viewer: Viewer; page: ReturnType<typeof import("./page.js").createFilesPage> };
  }
}
