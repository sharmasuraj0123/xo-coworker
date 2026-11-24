import type { ProjectionThread } from "./message-types.d.ts";
import type { RankedNeed } from "./draw-types.d.ts";
import type { Run } from "./stop-types.d.ts";
import type { Hop } from "../../core/services/world/relay.js";
import type { heldWords } from "../../core/services/world/held.js";
import type { stopWords } from "../../core/services/world/conversation.js";

export type MessageThread = Pick<ProjectionThread, "id" | "project" | "state" | "title" | "lastAt" | "movedTo" | "sessionId"> & {
  branch?: string;
  checklist: { total: number; done: number; items: { state: string; text?: string }[] };
  held?: Parameters<typeof heldWords>[0];
  stop?: Parameters<typeof stopWords>[0];
  happened?: string;
  frozen?: boolean;
};

export type MessageDetailsDeps = {
  S: { alias: Map<string, string>; stops: ReadonlyMap<string, unknown> };
  world: {
    state: { hops?: ReadonlyMap<string, Hop> };
    act: { sessionState(sessionId: string | null | undefined): unknown };
    thread(id: string): MessageThread | null | undefined;
  };
  REC: { latestOf?: (threadId: string, project: string) => { key: string; path?: string | null; title?: string; name?: string } | null };
  SHAPE: { on(key: string): boolean; word(noun: string): string };
  PROJ(project: string | null): string;
  convThread(view: string): MessageThread | null;
  convProject(view: string): string | null;
  isBusy(thread: MessageThread): boolean;
  isHeld(thread: MessageThread): boolean;
  glyphOf(thread: MessageThread): string;
  stOf(thread: MessageThread): string;
  wordOf(thread: MessageThread): string;
  askTitle(need: RankedNeed): string;
  threadMark(thread: MessageThread, options: { withName: boolean }): string;
  noun(word: string): string;
  sendWhileRunning(thread: MessageThread): string;
  running(view: string): Run | null;
  workingRuns(thread: MessageThread): number;
  agentOf(thread: MessageThread): string | null;
};
