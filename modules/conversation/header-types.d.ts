import type { heldBadge } from "../../core/services/world/held.js";
import type { headerActionsHtml } from "../../shell/header.js";
import type { createMessageContext } from "./message-context.js";

export type HeaderThread = {
  id: string;
  title: string;
  label?: string;
  state: string;
  held?: Parameters<typeof heldBadge>[0];
};

export type HeaderNeed = { t: { id: string }; key: string; later?: boolean; admitted?: boolean; held?: boolean };
export type HeaderEdit = { tid: string; field: string; value: string; busy?: boolean };
type ThreadCounts = { all: number; working: number; needs: number };

export type HeaderDeps = {
  S: {
    desc: Record<string, string>;
    hdrCtl?: string;
    tEdit?: HeaderEdit | null;
    tMenu?: string | null;
    tMenuIn?: string | null;
  };
  world: { state: { threads: HeaderThread[] }; act: { storm?: boolean } };
  PICK: { pid?: string | null };
  LP: { button(view: string, open: boolean): string };
  LW: { isOpen: boolean };
  STAGE: { button(view: string): string };
  kernel: { places: Parameters<typeof headerActionsHtml>[0] };
  atOf(view: string): Parameters<typeof headerActionsHtml>[1];
  convHost: ReturnType<typeof createMessageContext>["convHost"];
  homeParts(needs: HeaderNeed[]): { held: unknown[] };
  projects(): unknown[];
  doneToday(): unknown[];
  isBusy(thread: HeaderThread): boolean;
  isHeld(thread: HeaderThread): boolean;
  threadCounts(project: string, needs: HeaderNeed[]): ThreadCounts;
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
