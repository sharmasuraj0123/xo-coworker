import type { Follow } from "./follow.js";
import type { createReadingLayout } from "./reading-layout.js";
import type { RankedNeed } from "../../core/services/decision-types.d.ts";

type Layout = ReturnType<typeof createReadingLayout>;
type Reading = Parameters<typeof createReadingLayout>[0]["MAIN"];

export type Conversation = Reading & {
  view: string;
  column: HTMLElement;
  typing: HTMLElement;
  follow: Omit<Follow, "init" | "destroy">;
  main: boolean;
  rendered: string | null;
  filled: string | null;
};

export type ConversationMount = Pick<Conversation, "msgs" | "scroller" | "column" | "typing" | "follow"> & {
  view: string | (() => string);
  main?: boolean;
};

export type DrawingDeps = Layout & {
  CHG: { sync(view: string): unknown };
  msgItems(view: string, needs: RankedNeed[]): { key: string; html: string }[];
  ensureRoot(view: string): void;
  liveReady(view: string): boolean | undefined;
  typingRender(conversation: Conversation): unknown;
};
