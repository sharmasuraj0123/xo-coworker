import type { Places } from "../../core/kernel/types";
import type { HandledParts, WorkingThread } from "./handled-types";
import type { NextCardNeed } from "./next-card-types";
import type { createHomeParts } from "./parts.js";

export interface HomeViewNeed extends NextCardNeed {
  admitted?: boolean;
  later?: boolean;
  held?: boolean;
  heldWhy?: string;
}

export type HomeChoice = "allow" | "deny" | { option: string };

export interface HomeViewDeps {
  S: { view: string, pin: string | null, pinAnim?: string | null, homeFocusNext?: boolean };
  D: {
    current: () => string | null | undefined;
    isOpen: () => boolean;
    decideNow: (key: string, choice: HomeChoice, note?: string) => boolean;
  };
  world: { state: { threads: WorkingThread[], error?: unknown, statusError?: unknown } };
  Kit: { READ_MS: number };
  EFFORT: Record<string, { label: string }>;
  homeParts: ReturnType<typeof createHomeParts<HomeViewNeed>>;
  nextCardHtml: (need: HomeViewNeed) => string;
  endRender: (parts: HandledParts, working: WorkingThread[]) => void;
  greeting: () => string;
  today: () => string;
  num: (value: number) => string;
  noun: (word: string) => string;
  plural: (count: number, word: string) => string;
  isBusy: (thread: WorkingThread) => boolean;
  askTitle: (need: HomeViewNeed) => string;
  PROJ: (project: string) => string;
  kernel: { places: Places };
  SV: { homeOrder: (body: HTMLElement) => void };
  announce: (message: string) => void;
  schedule: () => void;
}
