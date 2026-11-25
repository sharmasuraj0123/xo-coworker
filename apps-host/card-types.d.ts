import type { At, Undo } from "../core/kernel/types";
import type { AppBlock } from "./card.js";

declare module "../core/kernel/types" {
  interface KeyedPlaceEntries {
    "conversation.block:app": { render(host: HTMLElement, block: AppBlock, at?: At): Undo };
  }
}
