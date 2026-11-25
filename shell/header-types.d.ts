import type { At, Kernel } from "../core/kernel/types";

export interface HeaderThread { id: string; project: string; state: string; stop?: unknown }
export interface HeaderNeed { t: { id: string }; admitted?: boolean }

export interface HeaderDeps<T extends HeaderThread, N extends HeaderNeed> {
  location: Pick<ReturnType<typeof import("./navigation-state.js").createNavigationState>, "view" | "parentOf">;
  convThread: (view: string) => T | null | undefined;
  isBusy: (thread: T) => boolean;
  CH: { isChats: (view: string) => boolean; headHtml: (view: string) => string };
  STAGE: { button: (view: string) => string };
  checklistRender: (needs: N[]) => void;
  PROJ: (project: string) => string;
  conversationHeaderHtml: (view: string, thread: T | null | undefined, needs: N[]) => { who: string | null; controls: string };
  kernel: Pick<Kernel, "places" | "bus">;
  atOf: (view: string) => At;
  LP: { button: (view: string, isOpen: boolean) => string; ensure: (view: string) => void };
  LW: { isOpen: boolean };
  tdelRender: (thread: T | null | undefined) => void;
}
