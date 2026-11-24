import type { MapAgent, MapAgentDeps, MapThread } from "./agents-types";
import type { CameraDeps, Point } from "./camera-types";
import type { DiagramDeps } from "./diagram-types";
import type { DrawAgent, DrawingDeps } from "./drawing-types";
import type { MapFolder } from "./folders-types";
import type { TreeDeps, TreeNode } from "./tree-types";

export type Scope =
  | { kind: "thread"; key: string; t: MapThread & { branch?: string }; fold: MapFolder | null }
  | { kind: "project"; key: string; pid: string; fold: MapFolder }
  | { kind: "all"; key: string };

export interface MapFile { name?: string; path: string; project: string; rel: string }

export interface MapDeps extends MapAgentDeps {
  world: MapAgentDeps["world"] & TreeDeps["world"] & { thread(id: string): (MapThread & { branch?: string }) | null | undefined };
  go(view: string): void;
  announce(message: string): void;
  openFile(file: MapFile, opener: HTMLElement): void;
}

export interface MapController {
  mount(host: HTMLElement | null): void;
  show(view?: string): void;
  hide(): void;
  unmount(): void;
  live(view: string): boolean;
  agents(view?: string | null): (Pick<MapAgent, "id" | "title" | "go" | "busy" | "waiting" | "color" | "since"> & { doing: string })[];
  readonly mode: "graph" | "tree";
  setMode(mode: "graph" | "tree"): void;
  render(view: string): void;
}

export type MapState =
  Omit<TreeDeps["M"], "scope"> & Omit<DrawingDeps["M"], "scope" | "refs"> &
  CameraDeps["M"] & DiagramDeps["M"] & {
    scope: Scope | null;
    view: string;
    head: string;
    dragged: boolean;
    waking?: boolean;
    wakeGen?: number;
    lastScope?: string | null;
    fit?: { key: string; fold: boolean };
  };

export type PointerStart = Point & { pts: Map<number, Point>; s: number; moved: boolean };
export type MapNode = TreeNode & { parent: string | null };
export type MapDrawAgent = DrawAgent;
