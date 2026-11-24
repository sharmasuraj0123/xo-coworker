import type { Thread } from "./stop-types.d.ts";

type RunningThread = Thread & { busy?: boolean; sessionId?: string };

export type RunningDeps = {
  S: { view: string; stops: ReadonlyMap<string, unknown> };
  world: { act: {
    sessionState(session: string): string | null;
    coordinatorBusy?(chat: string): string | null;
  } };
  CH: { busy(view: string): boolean };
  convThread(view: string): RunningThread | null;
  chatOf(view: string): string | null;
};
