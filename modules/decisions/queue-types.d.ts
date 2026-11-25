import type { CardChoice, CardNeed } from "./card-events-types.d.ts";
import type { PanelState } from "./panel-view-types.d.ts";

export type DecisionItem = NonNullable<CardNeed["ask"]["item"]>;
export type DecisionBody = Record<string, unknown> & { idempotency_key?: string };
export type DecisionFailure = {
  message?: string;
  code?: string;
  gone?: string;
  status: number;
  item?: { decision?: { decision?: string; idempotency_key?: string } };
};

export type DecisionEntry = {
  id: number;
  key: string;
  verb: string;
  choice: "allow" | "deny" | "answer";
  label?: string;
  said?: string | string[];
  typed?: boolean;
  note?: string;
  taught?: boolean;
  project: string;
  thread: string;
  tid: string;
  at: number;
  status: "queued" | "sending" | "sent" | "gone" | "failed";
  risk: string;
  batch?: boolean;
  lev?: { min: number; steps: number };
  doneAt: number;
  secs: number;
  why?: string;
};

type DecisionThread = CardNeed["t"] & { state: string; asks?: unknown[]; needsYou?: string };
export type DecisionChoice = CardChoice | { storm: true; body: DecisionBody };
export type DecisionPart = {
  key: string;
  n: CardNeed;
  t: DecisionThread;
  ask: CardNeed["ask"] & import("../../core/services/decision-types.d.ts").NeedAsk;
  choice: DecisionChoice;
  note: string;
  stopped?: boolean;
  entry: DecisionEntry;
};

export type DecisionQueueItem = {
  id: number;
  parts: DecisionPart[];
  meta: { inline?: boolean; deny?: boolean; verb?: string; label?: string };
  startedAt: number;
  due: number;
  cancel?: () => void;
};
export type DecisionResult = { part: DecisionPart; ok: boolean; err?: unknown };
export type DecisionQueueOptions = {
  delay?: number;
  exec(part: DecisionPart, signal: AbortSignal): unknown;
  onChange(type: "queued" | "undone" | "sending" | "settled", item: DecisionQueueItem, results?: DecisionResult[]): void;
};

export type DecisionQueueDeps = {
  world: { act: {
    resolve(id: string, resolved: boolean): unknown;
    reply(id: string, text: string): unknown;
    decide(id: string, choice: "allow" | "deny", note: string): unknown;
    decideItem(id: string, body: DecisionBody): unknown;
  } };
  F: PanelState;
  log: DecisionEntry[];
  sentKeys: Map<string, number>;
  stoppedDone: Set<string>;
  noSecret: Set<string>;
  show(key: string, how: "undo"): unknown;
  toastRender(): void;
  announce(message: string): void;
  render(): void;
  onUndone?: (key: string) => void;
  onSent?: (part: DecisionPart) => void;
  onNotSent?: (title: string | undefined, note: string) => void;
};
