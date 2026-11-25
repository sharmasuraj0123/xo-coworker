import type { CardNeed as InteractiveNeed, CardFrame, CardSurface } from "./card-events-types.d.ts";
import type { createPacing } from "./pacing.js";
import type { holdButton } from "./kit.js";
import type { createScope } from "../../core/kernel/scope.js";

export type CardNeed = InteractiveNeed;
export type Transition = "enter" | "allow" | "back" | "skip-fwd" | "skip-back" | "undo" | "later";

export type PanelState = {
  open: boolean;
  vig: boolean;
  busy?: boolean;
  done: boolean;
  swap: number;
  cancelAutoClose?: () => void;
  hold?: ReturnType<typeof holdButton> | null;
  cur: string | null;
  order: string[];
  items: Map<string, CardNeed>;
  status: Map<string, string>;
  mode: "glance" | "set" | "all";
};

export type PanelViewDeps = {
  F: PanelState;
  lifetime: Pick<ReturnType<typeof createScope>, "timeout" | "signal">;
  P: Pick<ReturnType<typeof createPacing>, "reviewMin" | "keepGoing" | "rested">;
  PROJ(id: string): string;
  stage: HTMLElement;
  needItems(): CardNeed[];
  cardHtml(need: CardNeed, surface: "panel"): string;
  wireCard(frame: CardFrame, inner: HTMLElement, need: CardNeed, context: CardSurface): void;
  pending(key: string): boolean;
  log: { key: string; choice: string }[];
  announce(message: string): void;
  render(): void;
  onBreak?: (left: number) => void;
  onAllClear?: (summary: string, freed: number) => void;
  advance(how: Transition): void;
  close(): void;
  allowAllRoutine(keys: string[]): void;
};
