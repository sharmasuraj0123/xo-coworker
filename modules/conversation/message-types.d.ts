import type { Row } from "../../core/services/storm/types.d.ts";
import type { MediaInput, SharedFile } from "../../core/services/media/types.d.ts";
import type { reactionGroups, waitsForTurn } from "../../core/services/world/conversation.js";
import type { Hop } from "../../core/services/world/hop-types.d.ts";
import type { Block, Turn } from "./blocks/turn.js";
import type { LocalMessage } from "./delivery-types.d.ts";
import type { createLocalMessages } from "./local-messages.js";

export type RelayRows = { shown: (StoredMessage & { hop: { seq: number | null; at: number } })[]; missing: { ids: string[]; seq: number | null }[] };
export type Forward = { id: string; chatId?: string | null; via?: string[]; root?: { id: string; chatId?: string | null } };
type PassedOn = { project: string; to?: string | null };
type Reactions = Parameters<typeof reactionGroups>[0];
export type History = { loaded?: boolean; loading?: boolean; all?: boolean; older?: boolean; paged?: boolean; capped?: boolean; error?: string | null; olderError?: string | null; before?: number | null };
export type Control = { at: string; seq?: number | null; action: string; by?: string; reason?: string };
export type Limit = import("../../core/services/world/state-types.d.ts").WorldThread["limits"][number];
type Move = { to?: string; from?: string; at?: string; agent?: string; reason?: string };
type Speaker = "you" | "agent" | "coord" | "system";
type SpaceNotice = { percent: number | null };

type StoredMessage = {
  id: string;
  at: number;
  seq: number | null;
  who: Speaker;
  text: string;
  role?: string | null;
  fwd?: Forward | null;
  passedOn?: PassedOn | null;
  continuedIn?: string | null;
  continuedFrom?: string | null;
  space?: SpaceNotice | null;
  files?: SharedFile[];
  reactions?: Reactions;
  chatId?: string | null;
};

export type Message = {
  key: string;
  at: number;
  who: string;
  seq?: number | null;
  id?: string;
  sid?: string;
  text?: string;
  sent?: boolean;
  files?: (MediaInput | SharedFile)[];
  reactions?: Reactions;
  chatId?: string | null;
  fwd?: Forward | null;
  passedOn?: PassedOn | null;
  continuedIn?: string | null;
  continuedFrom?: string | null;
  space?: SpaceNotice | null;
  queued?: boolean;
  routed?: { chat: string }[] | null;
  relay?: { project: string; id: string; fwd?: Forward | null; at: number };
  back?: { id: string; text: string; via?: string[] };
  name?: string | null;
  role?: string;
  coord?: boolean;
  cause?: string | null;
  lead?: string;
  hop?: string;
  wrote?: number;
  thread?: string;
  threadId?: string;
  threads?: string[] | null;
  iq?: { src: string; name: string; pips: string };
  turn?: Turn;
  blocks?: Block[];
  hideAnswer?: boolean;
  carried?: MediaInput[];
  working?: boolean;
  ctl?: Control;
  item?: Limit;
  h?: History;
  load?: string;
  pid?: string | null;
  tone?: string;
  status?: LocalMessage["status"];
  err?: LocalMessage["err"];
  waiting?: boolean;
  target?: string | null;
  undo?: unknown;
  until?: number;
  refused?: boolean;
};

export type ProjectionThread = {
  id: string;
  project: string;
  state: string;
  title: string;
  lastAt: number;
  createdAt: number;
  loaded: boolean;
  messages: StoredMessage[];
  busy?: boolean;
  sessionId?: string | null;
  limits?: Limit[];
  movedTo?: Move | null;
  movedFrom?: Move | null;
};

type Receipt = {
  id: string | number; project: string; at: number; said?: string | string[]; label?: string; verb?: string; choice?: string; why?: string;
};
type TimelineRow = Row & { id: string; text?: string | null };
type SessionTurn = Turn & { session: string | null };
type TurnStore = {
  running(session: string): Parameters<typeof waitsForTurn>[1];
  list(include: (turn: SessionTurn) => boolean): SessionTurn[];
  blocksOf(turn: SessionTurn): Block[];
};
type ProjectedState = {
  timeline: Record<string, TimelineRow[] | undefined>;
  hist: Record<string, History | undefined>;
  threads: Pick<ProjectionThread, "id" | "project">[];
  threadHist?: Record<string, History | undefined>;
  found?: Record<string, ReadonlyMap<string, TimelineRow> | undefined>;
  turns?: TurnStore;
  routed: Record<string, Message["routed"]>;
  controls: Record<string, Control[] | undefined>;
  hops?: ReadonlyMap<string, Hop>;
  failed?: Record<string, { id: string; at: number; error: string } | undefined>;
};
type World = {
  state: ProjectedState;
  act: {
    projectOf?(id: string | null | undefined): string | null;
    findRows?(project: string, ids: string[], seq?: number | null): void;
    chatId?(project: string): string | null;
  };
};
export type ProjectionDeps = {
  localMessages: Pick<ReturnType<typeof createLocalMessages>, "list" | "mergeEchoes" | "alias">;
  shape: { on(key: "xo:thread/hops"): boolean };
  world: World;
  D: { decisions(): Receipt[]; notSent(): Receipt[] };
  PROJ(project: string): string;
  convThread(view: string): ProjectionThread | null;
  chatOf(view: string): string | null;
  convProject(view: string): string | null;
  threadsOf(project: string): ProjectionThread[];
};
