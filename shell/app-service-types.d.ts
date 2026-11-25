import type { createWorld } from "../core/services/world/store.js";

export interface AppServices {
  world: ReturnType<typeof createWorld>;
  announce: (message: string) => void;
  projectName: (id: string | null | undefined) => string;
  currentView: () => string;
}

export interface ViewLeaving { from: string; to: string }

export interface ConversationHeaderPaint {
  project: string | null;
  needs: { t: { id: string }; admitted?: boolean; later?: boolean }[];
}

declare module "../core/kernel/types" {
  interface Services extends AppServices { placeContext: ReturnType<typeof import("./place-context.js").createPlaceContext> }
  interface Topics {
    "app:render": undefined;
    "app:decision-undone": string;
    "app:pagehide": undefined;
    "app:view-leaving": ViewLeaving;
    "app:conversation-header": ConversationHeaderPaint;
  }
}
