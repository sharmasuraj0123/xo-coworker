import type { MapAgent } from "./agents-types";
import type { Directory, MapFolder } from "./folders-types";

export type MapTreeAgent = MapAgent & { node?: string };
export type TreeFile = { name: string, path: string };
export type TreeScope = { key: string; kind: "thread" | "project" | "all" };

export interface TreeNode {
  id: string;
  kind: string;
  name?: string;
  title?: string;
  sub?: string;
  open?: boolean;
  btn?: boolean;
  dot?: string | false;
  mark?: string;
  children?: TreeNode[];
}

interface TreeRef {
  toggle?: string;
  open?: boolean | { name?: string, path: string, project: string, rel: string };
  retry?: string;
  fold?: MapFolder;
  more?: string;
  go?: string;
}

export interface TreeDeps {
  M: {
    opened: Map<string, Set<string>>;
    closed: Map<string, Set<string>>;
    more: Map<string, Set<string>>;
    autoOpen: Map<string, Set<string>>;
    refs: Map<string, TreeRef>;
    shown: Map<string, Set<string>>;
    scope: TreeScope;
  };
  world: {
    project: (project: string) => { name?: string } | null | undefined;
    state: { projects: { id: string, kind?: string, name?: string }[] };
  };
  load: (scope: MapFolder, path: string) => Promise<void>;
  folderAt: (scope: MapFolder, path: string) => Directory | undefined;
}
