import type { Composer } from "./composer-types.d.ts";
import type { WorldThread } from "../../core/services/world/state-types.d.ts";
export type { Composer } from "./composer-types.d.ts";
export type Thread = Pick<WorldThread, "frozen" | "state" | "busy" | "sessionId" | "session">;

export type TargetDeps = {
  MK: Composer;
  world: { state: { projects: readonly { id: string; name?: string }[] } };
  CH: { isChats(view: string): boolean; placeholder(view: string): string };
  PHONE: MediaQueryList;
  PROJ: (project: string | null | undefined) => string;
  convThread: (view: string) => Thread | null;
  convProject: (view: string) => string | null | undefined;
  liveBlock: (view: string, text: string) => string | null;
  isBusy: (thread: Thread) => boolean;
  sendWhileRunning: (thread: Thread) => string | null;
  noun: (word: string) => string;
};
