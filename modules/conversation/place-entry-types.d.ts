import type { At, Undo } from "../../core/kernel/types";
import type { TurnBlock, TurnStep } from "../../core/services/world/turn-types";
import type { Composer } from "./composer-types";
import type { Message } from "./message-types";

type MountComposer = { mount(host: HTMLElement, composer: Composer): Undo | void };

declare module "../../core/kernel/types" {
  interface PlaceEntries {
    "conversation.source": { items(view: string): readonly Message[] };
    "conversation.row": { render(host: HTMLElement, row: Message, at: At): Undo | void };
    "conversation.block": { render(host: HTMLElement, block: TurnBlock, at: At): Undo | void };
    "conversation.tool-words": { words(step: TurnStep, at: At): string | undefined };
    "conversation.typing": { render(host: HTMLElement, at: At): boolean };
    "message.action": { label: string; run(message: Message, at: At): void };
    "message.decorator": { decorate(host: HTMLElement, message: Message, at: At): Undo | void };
    "composer.tool": MountComposer;
    "composer.above": MountComposer;
    "composer.target": { render(composer: Composer): boolean };
    "composer.send-gate": { block(composer: Composer): string | undefined };
  }
}
