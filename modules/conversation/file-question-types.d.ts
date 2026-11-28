import type { FileLocation, ScopeThread } from "../../core/services/file-scope-types.d.ts";
import type { createDelivery } from "./delivery.js";
import type { createFileReferences } from "./file-references.js";
import type { Thread } from "./delivery-types.d.ts";
import type { createLocalMessages } from "./local-messages.js";
import type { createHerald } from "../../core/services/notices.js";

export type QuestionFile = FileLocation & { name?: string };

type Delivery = ReturnType<typeof createDelivery>;

export type FileQuestionDeps = Pick<Delivery, "blockFor" | "refuse" | "deliverLive"> & {
  view(): string;
  localMessages: Pick<ReturnType<typeof createLocalMessages>, "send">;
  fileReferences: ReturnType<typeof createFileReferences>;
  world: { state: { threads: readonly (ScopeThread | null)[] }; thread(key: string): Thread | null | undefined };
  PROJ(project: string): string;
  convOfChat(chat: string): string;
  CH: { isChats(view: string): boolean };
  say: HTMLTextAreaElement;
  VW: { close(options: { restore: boolean }): void };
  STAGE: { resumeFollow(view: string): void };
  go(view: string): void;
  announce(text: string): void;
  heraldShow: ReturnType<typeof createHerald>["show"];
  schedule(): void;
  lrefRender(): void;
};

declare module "../../core/kernel/types" {
  interface Services {
    fileQuestions: {
      target(file: QuestionFile): string | null;
      send(file: QuestionFile, from: number, to: number, text: string): boolean;
      compose(file: QuestionFile, from: number, to: number): boolean;
      file(file: QuestionFile): boolean;
    };
  }
}
