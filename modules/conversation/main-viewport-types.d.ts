import type { ComposerScope } from "./composer-types.d.ts";
import type { PagingDeps } from "./paging-types.d.ts";
import type { createTranscriptFolds } from "./transcript-folds.js";

export type ViewportScope = ComposerScope;
export interface ViewportOptions extends Omit<PagingDeps, "MAIN"> {
  view(): string;
  takeFoldChange: ReturnType<typeof createTranscriptFolds>["takeChange"];
  heraldRoom(): void;
}
