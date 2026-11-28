import type { WorldThread } from "../../core/services/world/state-types.d.ts";
import type { createConversationNotices } from "../../core/services/notices/line.js";

export interface ThreadNoticeOptions {
  find(id: string): WorldThread | null | undefined;
  projectName(id: string): string;
  movedHere(id: string): boolean;
  show: ReturnType<typeof createConversationNotices>["show"];
  waitSince: Map<string, number>;
}
