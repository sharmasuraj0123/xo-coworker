import type { createDock } from "../decisions/dock.js";
import type { ChecklistDeps, ChecklistNeed } from "./checklist-types.d.ts";
import type { Composer } from "./composer-types.d.ts";
import type { Conversation, RankedNeed } from "./draw-types.d.ts";
import type { Follow } from "./follow.js";
import type { decorateConversation } from "./decoration.js";
import type { heldBadge } from "../../core/services/world/held.js";

type Thread = NonNullable<ReturnType<ChecklistDeps["convThread"]>> & { held?: Parameters<typeof heldBadge>[0] };
type PanelComposer = Composer & { iq: HTMLElement };
export type DockNeed = Parameters<ReturnType<typeof createDock>["render"]>[0][number];

export type ThreadPage = {
  box: HTMLElement | null;
  C: Conversation | null;
  K: PanelComposer | null;
  tid: string | null;
  follow: Follow | null;
  viewSubs: Set<() => void>;
  dock?: ReturnType<typeof createDock>;
  deco?: ReturnType<typeof decorateConversation>;
  dockRO?: ResizeObserver;
  scrollRaf?: number;
  wait?: boolean;
};

export type ThreadPageDeps = {
  STAGE: { slot: HTMLElement; pageShown: { name: string } | null; closePage(name: string): unknown };
  S: { tMenu?: string | null; tMenuIn?: string | null };
  world: { act: { watchSideThread?: (key: string | null) => unknown } };
  D: { needItems(): DockNeed[] };
  dockDeps: Parameters<typeof createDock>[1];
  wireComposer(composer: Composer): void;
  wireTray(composer: Composer): void;
  closeThreadMenu(): void;
  addFiles(files: FileList | null, composer: Composer): void;
  toggleIq(session: string, chip: HTMLElement): void;
  sessionOf(view: string): string;
  convProject(view: string): string | null;
  watchDock(dock: HTMLElement, host: HTMLElement): ResizeObserver;
  toastLine(text: string): void;
  loadAhead(conversation: Conversation): void;
  returnPill(destination: null): void;
  saveDraft(composer: Composer): void;
  loadDraft(composer: Composer): void;
  convThread(view: string): Thread | null;
  stOf(thread: Thread): string;
  glyphOf(thread: Thread): string;
  isHeld(thread: Thread): boolean;
  wordOf(thread: Thread): string;
  rtTag(thread: Thread): string;
  threadMenuHtml(thread: Thread, location: "page"): string;
  checklistRender(needs: ChecklistNeed[], head: HTMLElement, view: string, id: string): void;
  drawConv(conversation: Conversation, needs: RankedNeed[]): void;
  updateComposer(composer: Composer): void;
  sendRender(composer: Composer): void;
  targetLineRender(composer: Composer): unknown;
};
