import type { ComposerScope } from "./composer-types.d.ts";
import type { PagingDeps } from "./paging-types.d.ts";
import type { createTranscriptFolds } from "./transcript-folds.js";

export type ViewportScope = ComposerScope;
type Live = import("./live-types").LiveConversationDeps;
export type ViewportOptions = Omit<PagingDeps, "MAIN"> & Live & {
  main: import("./draw-types").Conversation;
  alias(id: string): string | undefined;
  view(): string;
  takeFoldChange: ReturnType<typeof createTranscriptFolds>["takeChange"];
  heraldRoom(): void;
}
