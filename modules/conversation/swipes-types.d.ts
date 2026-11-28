import type { createScope } from "../../core/kernel/scope.js";

export type WireMessageSwipes = (
  list: HTMLElement,
  scroller: HTMLElement,
  startReply: (message: HTMLElement) => void,
  scope: ReturnType<typeof createScope>,
) => void;
