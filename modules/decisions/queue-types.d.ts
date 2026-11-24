import type { CardChoice, CardNeed } from "./card-events-types.d.ts";
import type { PanelState } from "./panel-view-types.d.ts";

export type DecisionItem = NonNullable<CardNeed["ask"]["item"]>;
export type DecisionBody = { decision: string; idempotency_key?: string };
export type DecisionFailure = Error & {
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

type DecisionThread = CardNeed["t"] & { state: string; asks: unknown[]; needsYou?: string };
type DecisionChoice = CardChoice | { storm: true; body: DecisionBody };
export type DecisionPart = {
  key: string;
  n: CardNeed;
  t: DecisionThread;
  ask: CardNeed["ask"];
  choice: DecisionChoice;
  note: string;
  stopped?: boolean;
  entry: DecisionEntry;
};

export type DecisionResult = { part: DecisionPart; ok: boolean; err?: DecisionFailure };

export type DecisionQueueDeps = {
  world: { act: {
    resolve(id: string, resolved: boolean): unknown;
    reply(id: string, text: string): unknown;
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
