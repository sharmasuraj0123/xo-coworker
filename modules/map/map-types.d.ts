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
  mount(host: HTMLElement | null, scope?: ReturnType<typeof import("../../core/kernel/scope.js").createScope>): void;
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
    lastScope?: string | null;
    fit?: { key: string; fold: boolean };
  };

export type PointerStart = Point & { pts: Map<number, Point>; s: number; moved: boolean };
export type MapNode = TreeNode & { parent: string | null };
export type MapDrawAgent = DrawAgent;

export type MountScope = ReturnType<typeof import("../../core/kernel/scope.js").createScope>;
type MapCamera = ReturnType<typeof import("./camera.js").createMapCamera>;
type MapAgents = ReturnType<typeof import("./agents.js").createMapAgents>;
type MapTree = ReturnType<typeof import("./tree.js").createMapTree>;
type MapDrawing = ReturnType<typeof import("./drawing.js").createMapDrawing>;
type MapFolders = ReturnType<typeof import("./folders.js").createMapFolders>;

interface MapViewport {
  M: MapState;
  view: () => HTMLElement | null;
}

interface MapCameraInput {
  M: MapState;
  camera: MapCamera;
  clamp: CameraDeps["clamp"];
}

export interface MapViewportDeps extends MapCameraInput {
  tool: (name: string) => void;
}

export interface MapInputDeps extends MapCameraInput, Pick<MapDeps, "announce" | "go" | "openFile"> {
  host: () => HTMLElement;
  view: MapViewport["view"];
  paint: () => void;
  load: (...args: Parameters<MapFolders["load"]>) => void;
  tagW: () => number;
  modeKey: string;
}

export interface MapRenderDeps extends MapViewport,
  Pick<MapAgents, "agentOf" | "agentsIn">,
  Pick<MapTree, "folderTree" | "projectsTree">,
  Pick<MapDrawing, "spotOf" | "paintGraph">,
  Pick<MapCamera, "reframe" | "frame" | "camOf"> {
  host: () => HTMLElement | null;
  scopeOf: (view: string) => Scope;
  skeleton: (scope: Scope) => void;
  tagW: () => number;
  headHtml: ReturnType<typeof import("./head.js").createMapHead>;
  paintDiagram: ReturnType<typeof import("./diagram.js").createMapDiagram>;
}
