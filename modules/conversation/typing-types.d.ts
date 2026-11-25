import type { Services } from "../../core/kernel/types";
import type { MessageContext } from "./message-context.js";
import type { heldWords } from "../../core/services/world/held.js";

export type TypingDeps = Pick<Services["placeContext"], "PROJ" | "convThread"> & {
  world: Services["world"];
  CH: { working(view: string): boolean };
  chatOf: Services["placeContext"]["convProject"];
  isBusy: Services["threadPresentation"]["isBusy"];
  heldWords: typeof heldWords;
  openAsk: MessageContext["openAsk"];
  sendingTo(chat: string): { at: number } | null;
  schedule(): void;
  tick(): void;
};
