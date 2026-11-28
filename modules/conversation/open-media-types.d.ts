import type { viewerFile } from "../../core/services/media/items.js";

export interface MediaOpener {
  msgsEl: HTMLElement;
  LB: { open(key: string, from: HTMLElement, root: HTMLElement): unknown };
  VW: { open(file: ReturnType<typeof viewerFile>, from: Element | null): unknown };
}
