import type { Effort, RankedNeed } from "../../core/services/decision-types.d.ts";
import type { ProjectionThread } from "./message-types.d.ts";
import type { Run } from "./stop-types.d.ts";
import type { Hop } from "../../core/services/world/hop-types.d.ts";
import type { Setup } from "./handoff-types.d.ts";
import type { heldWords } from "../../core/services/world/held.js";
import type { stopWords } from "../../core/services/world/conversation.js";

export type MessageThread = Pick<ProjectionThread, "id" | "project" | "state" | "title" | "lastAt" | "movedTo" | "sessionId"> & {
  branch?: string | null;
  checklist: { total: number; done: number; items: { state: string; text?: string }[] };
  held?: Parameters<typeof heldWords>[0];
  stop?: Parameters<typeof stopWords>[0];
  happened?: string;
  frozen?: boolean;
  activity?: string | null;
  session?: (Setup & { live_runs?: number }) | null;
  messages?: { who: string }[];
};

export type MessageDetailsDeps = {
  aliases(): Iterable<[string, string]>;
  world: {
    state: { hops?: ReadonlyMap<string, Hop>; sessions?: Record<string, Setup | undefined> };
    act: { sessionState(sessionId: string | null | undefined): unknown };
    thread(id: string): MessageThread | null | undefined;
  };
  EFFORT: Readonly<Record<Effort, { time: string }>>;
  REC: { latestOf?: (threadId: string, project: string) => LatestArtifact | null };
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
  sendWhileRunning(thread: MessageThread): string | null;
  running(view: string): Run | null;
  isStopping(session: string | null | undefined): boolean;
  workingRuns(thread: MessageThread): number;
  agentOf(thread: MessageThread | null | undefined): string | null;
};

type LatestArtifact = { key: string; path?: string | null; title?: string | null; name?: string };
