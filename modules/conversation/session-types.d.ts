import type { Entry } from "../../core/kernel/types";
import type { ThreadPage, DockNeed } from "./thread-page-types";
import type { createConversationSession } from "./session.js";

export interface ThreadPageEntry extends Entry { session: Pick<ThreadPage<DockNeed>, "box" | "K" | "C">; shown(): boolean }
declare module "../../core/kernel/types" {
  interface Services { conversationSession: ReturnType<typeof createConversationSession>["session"] }
}
