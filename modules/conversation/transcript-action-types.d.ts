import type { Conversation } from "./draw-types.d.ts";
import type { ChecklistNeed } from "./checklist-types.d.ts";
import type { createTranscriptFolds } from "./transcript-folds.js";
import type { NoticeUndo } from "./notice-line-types.d.ts";

export interface TranscriptActions {
  convAt(target: Element): Conversation;
  loadOlderNow(conversation: Conversation): void;
  transcriptFolds: Pick<ReturnType<typeof createTranscriptFolds>, "toggle">;
  schedule(): void;
  convThread(view: string): { id: string } | null;
  toggleChecklist(id: string): void;
  checklistRender(needs: ChecklistNeed[], head?: HTMLElement, view?: string, id?: string): void;
  needs(): ChecklistNeed[];
  requestFocus: NoticeUndo["requestFocus"];
  heraldBox(): HTMLElement | null;
  interruptRun(view: string): void;
}
