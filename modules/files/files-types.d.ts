import type { FilesScope, ScopeThread } from "./scope.js";
import type { TreeDependencies } from "./tree-types";
import type { OperationDependencies } from "./operation-types";

type OperationState = OperationDependencies["F"];
export interface FilesState extends OperationState {
  view: string;
  pick: string | null;
  shown: boolean;
  open: Map<string, Set<string>>;
  follow: FilesScope | null;
  viewKey: string;
  wide: boolean;
  folded: boolean;
}

export interface MenuState {
  btn: HTMLButtonElement | null;
  row: HTMLElement | null;
  menu: HTMLElement | null;
  from: HTMLElement | null;
  dir: string | null | undefined;
  kind?: string;
}

interface FileToOpen {
  path: string;
  name: string;
  project?: string;
  rel: string;
  bytes?: number | null;
  created?: string | true;
  show?: "changes";
}

export interface FilesDependencies {
  world: TreeDependencies["world"] & { thread(id: string): ScopeThread | null | undefined };
  viewer: TreeDependencies["viewer"] & { open(file: FileToOpen, from: Element | null): void; close(options: { restore: boolean }): void };
  isBusy: TreeDependencies["isBusy"];
  PROJ: (id: string) => string;
  go?: (view: string) => void;
  onFold?: ((folded: boolean) => void) | null;
  changes?: (NonNullable<TreeDependencies["changes"]> & NonNullable<OperationDependencies["changes"]>) | null;
  paths?: (NonNullable<OperationDependencies["paths"]> & { of(scope: { project: string; base: string }): ReturnType<NonNullable<TreeDependencies["paths"]>["of"]> & { via?: string | null } }) | null;
}
