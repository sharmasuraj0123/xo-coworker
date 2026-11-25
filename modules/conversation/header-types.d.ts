import type { WorldThread } from "../../core/services/world/state-types.d.ts";
import type { headerActionsHtml } from "../../shell/header.js";
import type { MessageContext } from "./message-context.js";

export type HeaderThread = WorldThread;

export type HeaderNeed = { t: { id: string }; key: string; later?: boolean; admitted?: boolean; held?: boolean };
type ThreadCounts = { all: number; working: number; needs: number };

export type HeaderDeps<N extends HeaderNeed> = {
  description(project: string): string | undefined;
  threadControls: {
    edit(): { tid: string; field: "title" | "label"; value: string; busy?: boolean } | null;
    menuOpen(id: string, location: "main"): boolean;
  };
  world: { state: { threads: HeaderThread[] }; act: { storm?: boolean } };
  PICK: { pid?: string | null };
  LP: { button(view: string, open: boolean): string };
  LW: { isOpen: boolean };
  STAGE: { button(view: string): string };
  places: Parameters<typeof headerActionsHtml>[0];
  atOf(view: string): Parameters<typeof headerActionsHtml>[1];
  convHost: MessageContext["convHost"];
  homeParts(needs: N[]): { held: unknown[] };
  projects(): unknown[];
  doneToday(): unknown[];
  isBusy(thread: HeaderThread): boolean;
  isHeld(thread: HeaderThread): boolean;
  threadCounts(project: string, needs: N[]): ThreadCounts;
  PROJ(project: string): string;
  projectIcon(project: string): string;
  threadsCtl(total: number, counts: ThreadCounts): string;
  threadTitleInput(value: string, attrs: string): string;
  threadLabelInput(value: string, attrs: string): string;
  threadMenuHtml(thread: HeaderThread): string;
  stOf(thread: HeaderThread): string;
  glyphOf(thread: HeaderThread): string;
  wordOf(thread: HeaderThread): string;
  rtTag(thread: HeaderThread): string;
};
export type MainHeader<N extends HeaderNeed> = HeaderDeps<N>
  & Omit<import("../../shell/header-types").HeaderDeps<HeaderThread, N>, "conversationHeaderHtml">;

declare module "../../core/kernel/types" {
  interface Services { conversationHeader(needs: import("../../core/services/decision-types").RankedNeed[]): void }
}
