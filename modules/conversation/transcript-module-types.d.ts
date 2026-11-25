import type { MessageDetailsDeps } from "./message-details-types";
import type { MessageItemsDeps } from "./message-items-types";
import type { DrawingDeps } from "./draw-types";
import type { createReadingLayout } from "./reading-layout.js";
import type { createLocalMessages } from "./local-messages.js";

export type TranscriptHost = Pick<MessageDetailsDeps, "threadMark" | "agentOf" | "noun" | "sendWhileRunning"
  | "running" | "workingRuns" | "isStopping">
  & Pick<MessageItemsDeps, "CH" | "STAGE" | "limitStatus" | "transcriptOpen" | "youText" | "startHtml" | "fileRoute">
  & Pick<DrawingDeps, "liveReady" | "ensureRoot">
  & { actions(): Omit<import("./transcript-action-types").TranscriptActions, "needs" | "convThread"> }
  & { CH: { working(view: string): boolean };
    reading: ReturnType<typeof createReadingLayout>; localMessages: ReturnType<typeof createLocalMessages> };
