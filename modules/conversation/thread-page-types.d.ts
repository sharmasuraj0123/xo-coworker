import type { RankedNeed } from "../../core/services/decision-types.d.ts";
import type { ChecklistNeed } from "./checklist-types.d.ts";
import type { Composer } from "./composer-types.d.ts";
import type { Conversation } from "./draw-types.d.ts";
import type { Follow } from "./follow.js";
import type { WorldThread } from "../../core/services/world/state-types.d.ts";
import type { createScope } from "../../core/kernel/scope.js";

type Thread = WorldThread;
type PanelComposer = Composer & { iq: HTMLElement };
export type DockNeed = RankedNeed;
type DockMount = { scope: ReturnType<typeof createScope>; el: HTMLElement; view(): string; region(): HTMLElement };
type Dock<N extends DockNeed> = {
  reset(options?: { restoreFocus?: boolean }): void;
  render(needs: N[]): void;
  undoReceipt(key: string): void;
};

export type ThreadPage<N extends DockNeed> = {
  box: HTMLElement | null;
  C: Conversation | null;
  K: PanelComposer | null;
  tid: string | null;
  follow: Follow | null;
  viewSubs: Set<() => void>;
  dock?: Dock<N>;
  wait?: boolean;
};

export type ThreadPageDeps<DockDeps, N extends DockNeed> = {
  STAGE: { slot: HTMLElement; pageShown: { name: string } | null; closePage(name: string): unknown };
  threadControls: {
    menu(): { location: string } | null;
    clearMenu(location: "page"): void;
    menuOpen(id: string, location: "page"): boolean;
  };
  world: { act: { watchSideThread?: (key: string | null) => unknown } };
  D: { needItems(): N[] };
  createDock(mount: DockMount, deps: DockDeps): Dock<N>;
  dockDeps: DockDeps;
  wireComposer(composer: Composer, scope: ReturnType<typeof createScope>): void;
  wireTray(composer: Composer, scope: ReturnType<typeof createScope>): void;
  closeThreadMenu(options?: { focus?: boolean }): void;
  addFiles(files: FileList | null, composer: Composer): void;
  toggleIq(session: string, chip: HTMLElement): void;
  sessionOf(view: string): string;
  convProject(view: string): string | null;
  heraldRoom(): void;
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

declare module "../../core/kernel/types" {
  interface Services { threadPage: { draw(needs: RankedNeed[]): void } }
}
