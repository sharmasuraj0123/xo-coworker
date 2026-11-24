export interface ShapeApplyDeps {
  S: { readonly showHops: boolean; view: string };
  SV: { apply(): void };
  SHAPE: { opts(key: "xo:thread/work"): { mode: unknown } };
  setWorkMode(mode: unknown): void;
  hopsRender(): void;
  webpicsRender(): void;
  convThread(view: string): { id: string } | null | undefined;
  world: { act: { loadHops?: (id: string) => void } };
  loadChatHops(view: string): void;
  SH: { redraw(): void };
  STAGE: { reshape(): void };
  schedule(): void;
}
