import type { stackLayers } from "./layers.js";

export interface GlobalKeysOptions {
  view(): string;
  capturing(): boolean;
  SH: { owns(event: KeyboardEvent): boolean };
  jump: HTMLElement;
  IQ: { isOpen: boolean };
  CREATE: { isOpen(): boolean };
  keys: HTMLElement;
  GLOBAL: Record<string, () => unknown> & { shells(): unknown };
  FP: { toggleTree(): boolean };
  QO: { isOpen: boolean; close(): void; open(mode: "files" | "text"): boolean };
  LAYERS: Pick<ReturnType<typeof stackLayers>, "escape">;
  back(): unknown;
  go(view: string): unknown;
}
