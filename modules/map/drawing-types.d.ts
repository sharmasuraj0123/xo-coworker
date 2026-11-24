import type { MapAgent } from "./agents-types";
import type { Bounds, Camera, CameraLead, CameraScope, Point } from "./camera-types";
import type { GraphNode, Position, RAD } from "./graph-physics";
import type { TreeNode } from "./tree-types";

export type DrawAgent = MapAgent & { node?: string; nid?: string | null };
export type GraphItem = TreeNode & { kind: keyof typeof RAD; parent: string | null };
export type GraphEdge = SVGLineElement & { setAttribute: (name: string, value: number) => void };
export type CursorPoint = Point & { cx: number; cy: number; deck?: boolean; side?: CameraLead["side"] };

export interface DrawingDeps {
  M: {
    scope: CameraScope | null;
    refs: ReadonlyMap<string, unknown>;
    curs: Map<string, { el: HTMLElement; node: string | null | undefined; tag: string }>;
    lead?: CameraLead | null;
    leadNode?: string | null;
    gpos: Map<string, Map<string, Position>>;
    gnodes: (GraphNode & { n: GraphItem; el?: HTMLElement })[];
    gedges: GraphEdge[];
    gags: DrawAgent[];
    glit: Map<string, string>;
    gkey: string;
    layoutKey: string;
    raf: number;
    alpha: number;
    rootPt?: Point;
    bounds: Bounds | null;
    open: boolean;
    mode: "graph" | "tree";
  };
  host: () => HTMLElement;
  verbOf: (agent: MapAgent) => string;
  tagW: () => number;
  focusNode: (nodes: HTMLElement, id: string) => void;
  camOf: (scope: CameraScope) => Camera;
  frame: (camera: Camera) => void;
  clamp: (value: number, low: number, high: number) => number;
}
