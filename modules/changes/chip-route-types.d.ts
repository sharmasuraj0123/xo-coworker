// @ts-check

import type { createChanges } from "./store.js";

type SourceConversation = { view: string; follow: { unpin(row: Element): void } };
type ChangeFile = { path: string; name?: string; project: string; rel: string; show: string };

export interface ChipRoute {
  changes: Pick<ReturnType<typeof createChanges>, "forTarget" | "scope">;
  conversationAt(row: Element): SourceConversation;
  showChange(path: string): boolean;
  openFile(file: ChangeFile, from: HTMLElement): void;
  focusAfterDraw(selectors: string[]): void;
  schedule(): void;
}
