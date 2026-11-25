import type { createChanges } from "./store.js";
import type { createSavedSoon } from "./saved.js";
import type { diff, jump } from "./diffview.js";
import type { isImageChange, drawImageChange } from "./imagechange.js";

export interface ChangeData {
      changes: ReturnType<typeof createChanges>;
      save: typeof createSavedSoon;
      diff: typeof diff;
      jump: typeof jump;
      isImageChange: typeof isImageChange;
      drawImageChange: typeof drawImageChange;
}

declare module "../../core/kernel/types" {
  interface Services { changeData: ChangeData }
}
