import type { Services } from "../core/kernel/types";
export type FrameNeeds = ReturnType<Services["decisionPresentation"]["D"]["needItems"]>;

declare module "../core/kernel/types" {
  interface PlaceEntries { "workspace.paint": { paint(needs: FrameNeeds): void } }
  interface Topics { "workspace:painted": undefined; "workspace:layout": string }
}
