import type { createDecisionCard, ScopeParts } from "./card.js";
import type { CardChoice, CardNeed, NoteMode } from "./card-events-types.d.ts";
import type { createNeedItems } from "./needs.js";
import type { RankedNeed } from "../../core/services/decision-types.d.ts";
import type { createPacing } from "./pacing.js";
import type { PanelState } from "./panel-view-types.d.ts";
import type { DecisionEntry, DecisionQueueDeps } from "./queue-types.d.ts";
import type { wireDecisionKeyboard } from "./keyboard.js";
import type { OpenOptions } from "./conversation-actions-types.d.ts";

export type { CardChoice, NoteMode } from "./card-events-types.d.ts";
export type { OpenOptions } from "./conversation-actions-types.d.ts";
export type { Transition } from "./panel-view-types.d.ts";
export type { DecisionEntry, DecisionItem } from "./queue-types.d.ts";
export type ScopeOption = ScopeParts["scopes"][number];
export type DecideOptions = { secs?: number | null; inline?: boolean };
export type DecisionNeed = CardNeed & RankedNeed;
export type DecisionPanelState = PanelState & {
  parked: boolean;
  returnTo: Element | null;
  open0: Record<string, { ev?: boolean }>;
  items: Map<string, DecisionNeed>;
};

type Card = ReturnType<typeof createDecisionCard>;
type NeedWorld = Parameters<typeof createNeedItems>[0]["world"];
export type DecisionControllerDeps = Pick<DecisionQueueDeps, "onUndone" | "onSent" | "onNotSent"> & {
  world: DecisionQueueDeps["world"] & NeedWorld;
  P: ReturnType<typeof createPacing>;
  PROJ(id: string): string;
  announce(message: string): void;
  render(): void;
  back?: (selectors: string[]) => void;
  waitSince: Map<string, number>;
  onOpenThread?: (id: string, surface: "panel" | "dock") => void;
  onAllClear?: (summary: string, freed: number) => void;
  onBreak?: (left: number) => void;
  onShown?: () => void;
  onGone?: () => void;
};

export type DecisionApi = {
  needItems(): DecisionNeed[];
  decisions(): DecisionEntry[];
  notSent(): DecisionEntry[];
  failedNote(key: string, mode?: NoteMode): string;
  isOpen(): boolean;
  park(): void;
  unpark(): void;
  current(): string | null;
  open(key?: string | null, options?: OpenOptions): boolean;
  close(options?: { restore?: boolean }): void;
  sync(): void;
  undo(): boolean;
  decide(need: DecisionNeed, choice: CardChoice, note?: string, options?: DecideOptions): DecisionEntry | null;
  decideNow(key: string, choice: CardChoice, note?: string): boolean;
  laterNow(key: string): void;
  recall(key: string): void;
  recallAll(): void;
  bringIn(key: string): void;
  cardHtml: Card["cardHtml"];
  cardTitle: Card["cardTitle"];
  wireCard: ReturnType<typeof import("./card-events.js").createCardEvents>;
  parts: Pick<Card, "effTagHtml" | "leadHtml" | "chipsHtml">;
  queued(key: string): boolean;
  pendingKey(key: string): boolean;
  cardKeys: ReturnType<typeof wireDecisionKeyboard>;
};
