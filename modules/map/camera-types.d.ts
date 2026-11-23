export interface Point { x: number; y: number }
export interface Bounds { x0: number; y0: number; x1: number; y1: number }
export interface CameraScope { key: string; kind: "thread" | "project" | "all" }
export interface CameraLayout { nodes: (Point & { id: string })[] }
export interface CameraLead {
  key: string;
  pt: Point;
  at?: Point;
  side: "left" | "right" | "below";
  tw?: number;
}

export interface Camera extends Point {
  s: number;
  user: boolean;
  follow: boolean;
  target: string | null;
  fitB?: Bounds | null;
  fitAll?: boolean;
  done?: boolean;
  settleUntil?: number;
}

export interface CameraDeps {
  M: {
    cams: Map<string, Camera>;
    mode: "tree" | "graph";
    bounds: Bounds | null;
    reach: Point | null;
    reachKey: string;
    layoutKey: string;
    rootPt?: Point;
    lead?: CameraLead | null;
    loading?: boolean;
    alpha: number;
    anchorId?: string | null;
    leadNode?: string | null;
  };
  host: () => HTMLElement;
  view: () => HTMLElement | null;
  world$: () => HTMLElement | null;
  tagW: () => number;
  clamp: (val: number, low: number, high: number) => number;
}
