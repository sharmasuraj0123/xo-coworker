import type { Entry } from "../core/kernel/types.d.ts";
export type PressId = "navigate" | "older" | "start" | "decide" | "next" | "create" | "shell" | "record-undo" | "notice-undo"
  | "chat-message" | "run" | "fold" | "limit" | "thread-menu" | "checklist" | "retry" | "interrupt" | "edit"
  | "media" | "remove-reference" | "reference" | "file" | "copy";
export type Press = (target: Element, event: MouseEvent) => boolean;
export type PressRoutes = Partial<Record<PressId, Press>>;
export interface PressEntry extends Entry {
  route: Press;
}
