import type { Bounds, Camera, CameraScope, Point } from "./camera-types";
import type { CursorPoint, DrawAgent } from "./drawing-types";
import type { layoutOf } from "./layout.js";
import type { TreeNode } from "./tree-types";

type Layout = ReturnType<typeof layoutOf>;

export interface DiagramDeps {
  M: { bounds: Bounds | null; layout: Layout | null; rootPt?: Point | null; layoutKey: string };
  host: () => HTMLElement;
  view: () => HTMLElement | null;
  tagW: () => number;
  camOf: (scope: CameraScope) => Camera;
  holdStill: (scope: CameraScope, old: Layout, next: Layout) => void;
  focusNode: (nodes: HTMLElement, id: string) => void;
  cursors: (agents: DrawAgent[], place: (id: string) => CursorPoint | null) => void;
  boxHtml: (node: TreeNode & Point, at: Map<string, string>) => string;
}
