import type { Notice } from "../../core/services/notices.js";
import type { connLine } from "../../core/services/world/conn.js";
import type { Composer } from "./composer-types";

export interface NoticeUndo {
  requestFocus(targets: (string | (() => HTMLElement | null | undefined))[]): void;
  undo(): void;
  undoRecord(id: string): void;
}
export interface NoticeLineDeps {
  notice(): Notice | null;
  world: { state: Parameters<typeof connLine>[0] };
  MK: Composer;
  composerNow(): Composer;
  panelHost(): HTMLElement | null;
  connDest(): Parameters<typeof connLine>[1];
  placeRegion(): HTMLElement | null;
  STOP_ICON: string;
}
