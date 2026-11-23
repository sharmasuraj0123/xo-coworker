import type { sharedFileRoute } from "../../core/services/world/relay.js";
import type { ViewerFile } from "./viewer-types";

export interface ConversationFilesDeps {
  currentView: () => string;
  convThread: (view: string) => Parameters<typeof sharedFileRoute>[0];
  convAt: (element: HTMLElement) => { view: string };
  CHG: { scope: (view: string) => { project: string; worktree?: string | null } | null };
  VW: { open: (file: ViewerFile, opener: HTMLElement) => unknown };
}
