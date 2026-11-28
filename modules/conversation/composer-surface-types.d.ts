import type { ComposerControlsDeps, ComposerDeps } from "./composer-types.d.ts";
import type { DeliveryDeps } from "./delivery-types.d.ts";
import type { TargetDeps } from "./target-types.d.ts";
import type { MentionDeps } from "./mention-types.d.ts";
import type { createComposerAttachments } from "./composer-attachments.js";
import type { createConversationStarts } from "./start.js";

export type ComposerHost =
  Pick<DeliveryDeps, "view" | "localMessages" | "world" | "CH" | "STAGE" | "PROJ" | "chatOf" | "convOfChat" | "convThread"
    | "convProject" | "announce" | "heraldShow" | "heraldFor" | "schedule" | "render" | "go">
  & Pick<TargetDeps, "world" | "CH" | "PHONE" | "PROJ" | "convThread" | "isBusy" | "sendWhileRunning" | "noun">
  & Pick<ComposerControlsDeps, "IQ" | "CH" | "sessionOf" | "running">
  & Pick<MentionDeps, "world" | "projects" | "projectIcon" | "isBusy">
  & Pick<ComposerDeps, "stopRun">
  & Pick<Parameters<typeof createComposerAttachments>[0], "VW">
  & Pick<Parameters<typeof createConversationStarts>[0], "SHAPE">
  & {
    session: import("../../core/kernel/types").Services["conversationSession"];
    STAGE: { pageShown: { name: string } | null };
  };

declare module "../../core/kernel/types" {
  interface Services {
    composer: ReturnType<typeof import("./composer-surface.js").createComposerSurface>;
    runControls: import("./run-controls.js").RunControls;
  }
}
