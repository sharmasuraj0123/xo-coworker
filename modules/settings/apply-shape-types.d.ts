export interface ShapeApplyDeps {
  view(): string;
  SV: { apply(): void };
  SHAPE: { opts(key: "xo:thread/work"): { mode: unknown }; on(key: "xo:thread/hops"): boolean };
  setWorkMode(mode: unknown): void;
  convThread(view: string): { id: string } | null | undefined;
  world: { act: { loadHops?: (id: string) => void } };
  loadChatHops(view: string): void;
  SH: { redraw(): void };
  STAGE: { reshape(): void };
  schedule(): void;
}
