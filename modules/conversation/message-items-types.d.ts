import type { RenderOptions } from "./blocks/turn.js";
import type { Forward, Message } from "./message-types.d.ts";
import type { createMessageDetails } from "./message-details.js";
import type { MessageThread } from "./message-details-types.d.ts";
import type { reactionGroups } from "../../core/services/world/conversation.js";

type Item = { key: string; html: string };

export type MessageItemsDeps = ReturnType<typeof createMessageDetails> & {
  S: { tbOpen: Record<string, boolean>; limitBusy?: string | null; limitErr?: { id: string; text: string } | null };
  world: { project(project: string): unknown };
  CH: { isChats(view: string): boolean; items(view: string): Item[] };
  CHG: { forTarget(view: string, target: string): { path: string; file: { additions?: number; deletions?: number; binary?: boolean } } | null };
  STAGE: { chosen(view: string): string | null };
  PROJ(project: string | null | undefined): string;
  projects(): readonly unknown[];
  convThread: (view: string) => MessageThread | null;
  convProject(view: string): string | null;
  messagesOf(view: string): Message[];
  fwdSource(forward: Forward): string | null;
  reactionsHtml(reactions: Parameters<typeof reactionGroups>[0]): string;
  youText(text: string): string;
  startHtml(project: string): string;
  fileRoute(path: Parameters<NonNullable<RenderOptions["route"]>>[0], view: string): ReturnType<NonNullable<RenderOptions["route"]>>;
};
