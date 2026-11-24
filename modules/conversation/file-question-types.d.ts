import type { fileRef, lineRef } from "../changes/store.js";
import type { fileScope, localIn, FileLocation } from "../files/scope.js";
import type { createDelivery } from "./delivery.js";
import type { LocalMessage, Thread } from "./delivery-types.d.ts";
import type { createHerald } from "../../core/services/notices.js";

export type QuestionFile = FileLocation & { name?: string };
export type FileReference = { path: string; name?: string } & ({ a: number; b: number } | { a: null; b: null });

type Delivery = ReturnType<typeof createDelivery>;

export type FileQuestionDeps = Pick<Delivery, "blockFor" | "refuse" | "deliverLive"> & {
  S: { view: string; n: number; lref: Record<string, FileReference | undefined>; local: Record<string, LocalMessage[]> };
  world: { state: { threads: Parameters<typeof fileScope>[1]["threads"] }; thread(key: string): Thread | null };
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
  fileScope: typeof fileScope;
  localIn: typeof localIn;
  lineRef: typeof lineRef;
  fileRef: typeof fileRef;
};
