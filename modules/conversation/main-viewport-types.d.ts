import type { createScope } from "../../core/kernel/scope.js";
import type { PagingDeps } from "./paging-types.d.ts";
import type { createTranscriptFolds } from "./transcript-folds.js";

export type ViewportScope = ReturnType<typeof createScope>;
type Live = import("./live-types").LiveConversationDeps;
export type ViewportOptions = Omit<PagingDeps, "MAIN"> & Live & {
  main: import("./draw-types").Conversation;
  view(): string;
  takeFoldChange: ReturnType<typeof createTranscriptFolds>["takeChange"];
  heraldRoom(): void;
}

declare module "../../core/kernel/types" {
  interface Services {
    conversationContent: { draw(needs: import("../../shell/render-types").FrameNeeds, gone: boolean): void };
    mainViewport: import("./main-viewport.js").MainViewport;
    lightbox: ReturnType<typeof import("./lightbox.js").createLightbox>;
    noticeLine: ReturnType<typeof import("./notice-line.js").createNoticeLine>;
  }
}
