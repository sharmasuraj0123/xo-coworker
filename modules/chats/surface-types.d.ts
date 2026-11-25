import type { ChatDeps } from "./types.d.ts";
import type { IntelOptions } from "./intel-types.d.ts";
import type { ChatControls } from "./controls-types.d.ts";

export interface ChatSurfaceOptions extends Omit<ChatDeps, "listRoot" | "restore" | "view"> {
  view(): string;
  composer(): HTMLTextAreaElement;
  putBack(text: string): void;
  retryBlock(): string | null;
  refuse(block: string, detail: string): void;
  aim(): void;
  updateComposer(): void;
  toggleIntelligence(view: string, chip: HTMLElement): void;
  phone: MediaQueryList;
  stop(target: Element): void;
}

export interface Composer {
  view: string;
  iq: HTMLElement | null;
}

export interface ChatButtons extends Pick<ChatControls, "scope" | "updateComposer"> {
  target: HTMLElement;
  permissions: HTMLElement;
  sendNow: HTMLElement;
  intelligence: HTMLElement;
  aim(): void;
  toggleIntelligence(view: string, button: HTMLElement): void;
}

export interface IntelSurfaceOptions<T extends Composer> extends Omit<IntelOptions, "onChange" | "onMoved" | "record"> {
  scope: Pick<import("../../core/kernel/types").ModuleContext, "effect">;
  places: import("../../core/kernel/types").Places;
  records: import("./record-lines-types").RecordDeps;
  composers(): Iterable<T>;
  redrawChip(composer: T): void;
  announce(text: string): void;
  openThread(thread: string): void;
}
