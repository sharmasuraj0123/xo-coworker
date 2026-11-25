import type { ThreadMenuActions } from "./menu-actions-types";
import type { EditDeps } from "./editing-types";
import type { createConversationNotices } from "../../core/services/notices/line.js";

export type ThreadActionOptions = Pick<ThreadMenuActions, "go" | "showThread" | "closePage" | "openOtherRuntime" | "render" | "schedule">
  & Pick<EditDeps, "requestFocus" | "composerAt">
  & { notice(): Pick<import("./notices-types").ThreadNoticeOptions, "waitSince" | "movedHere"> }
  & { notices: ReturnType<typeof createConversationNotices> };
