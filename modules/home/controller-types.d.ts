import type { createScope } from "../../core/kernel/scope.js";
import type { HandledDeps } from "./handled-types.d.ts";
import type { NextCardDeps } from "./next-card-types.d.ts";
import type { HomeViewDeps, HomeViewNeed } from "./view-types.d.ts";

type OwnedViewFields = "D" | "Kit" | "selection" | "homeParts" | "endRender" | "nextCardHtml" | "greeting" | "today" | "num" | "plural";

export interface HomeControllerOptions<N extends HomeViewNeed>
  extends Omit<HomeViewDeps<N>, OwnedViewFields>,
    Pick<NextCardDeps<N>, "evidenceFor" | "convOfChat">,
    Pick<HandledDeps<N>, "threadMark"> {
  host: HTMLElement;
  scope: ReturnType<typeof createScope>;
  D: HomeViewDeps<N>["D"] & NextCardDeps<N>["D"] & {
    needItems: () => N[];
    open: (key?: string | null, options?: { only: "glance" }) => unknown;
    laterNow: (key: string) => void;
    recallAll: () => unknown;
    bringIn: (key: string) => void;
  };
  Kit: HomeViewDeps<N>["Kit"] & { isBinary: (ask: unknown) => boolean };
  decideKey: (key: string) => void;
  heraldShow: Parameters<typeof import("./open-next.js").createOpenNext>[0]["heraldShow"];
}
