import type { FileLocation, FileScope, ScopeThread } from "../../core/services/file-scope-types.d.ts";
import type { createDelivery } from "./delivery.js";
import type { LocalMessage, Thread } from "./delivery-types.d.ts";
import type { createHerald } from "../../core/services/notices.js";

export type QuestionFile = FileLocation & { name?: string };
export type FileReference = { path: string; name?: string } & ({ a: number; b: number } | { a: null; b: null });

type Delivery = ReturnType<typeof createDelivery>;
type ScopeContext = { threads?: readonly (ScopeThread | null)[]; project(id: string): string };
type FileMatch = { path: string; rest: string };
type LineMatch = FileMatch & { a: number; b: number };

export type FileQuestionDeps = Pick<Delivery, "blockFor" | "refuse" | "deliverLive"> & {
  S: { view: string; n: number; lref: Record<string, FileReference | undefined>; local: Record<string, LocalMessage[]> };
  world: { state: { threads: ScopeContext["threads"] }; thread(key: string): Thread | null };
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
  fileScope(file: FileLocation, context: ScopeContext): FileScope | null;
  localIn(scope: FileScope, file: FileLocation): string | null;
  lineRef(text: string): LineMatch | null;
  fileRef(text: string): FileMatch | null;
};
