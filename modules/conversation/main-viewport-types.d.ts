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
