import type { ThreadPage, DockNeed } from "./thread-page-types";
import type { ConversationSession } from "./session.js";

export interface ThreadPageAttachment { session: Pick<ThreadPage<DockNeed>, "box" | "K" | "C">; shown(): boolean }
declare module "../../core/kernel/types" {
  interface Services { conversationSession: ConversationSession }
}

declare module "../../core/kernel/types" {
  interface Services {
    conversationPresentation: {
      fileRoute: ReturnType<typeof import("../../core/services/file-route.js").createFileRoute>;
      noun: ReturnType<typeof import("./markdown.js").mountConversationMarkdown>;
      turnHtml: typeof import("./blocks/turn.js").turnHtml;
      turnAv: typeof import("./blocks/turn.js").turnAv;
      setWorkMode: typeof import("./blocks/turn.js").setWorkMode;
      webPictures: string;
    };
  }
}
