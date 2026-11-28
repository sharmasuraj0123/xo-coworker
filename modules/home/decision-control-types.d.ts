import type { NextCardNeed } from "./next-card-types.d.ts";
import type { HomeChoice } from "./view-types.d.ts";

export interface DecisionControls {
  next: () => Pick<NextCardNeed, "key" | "ask" | "effort"> | null;
  isBinary: (ask: NextCardNeed["ask"]) => boolean;
  decide: (choice: HomeChoice, note?: string) => void;
  details: (key: string) => void;
}
