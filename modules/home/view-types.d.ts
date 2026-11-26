import type { Places } from "../../core/kernel/types";
import type { HandledParts, WorkingThread } from "./handled-types";
import type { NextCardNeed } from "./next-card-types";
import type { createHomeParts } from "./parts.js";
import type { createHomeSelection } from "./selection.js";

export interface HomeViewNeed extends NextCardNeed {
  admitted?: boolean;
  later?: boolean;
  held?: boolean;
  heldWhy?: string;
}

export type HomeChoice = "allow" | "deny" | { option: string };

export interface HomeViewDeps<N extends HomeViewNeed> {
  inbox?: ReturnType<typeof import("./inbox.js").homeInbox>;
  isCurrent: () => boolean;
  selection: ReturnType<typeof createHomeSelection>;
  D: {
    current: () => string | null | undefined;
    isOpen: () => boolean;
    decideNow: (key: string, choice: HomeChoice, note?: string) => boolean;
  };
  world: { state: { threads: WorkingThread[], error?: unknown, statusError?: unknown } };
  Kit: { READ_MS: number };
  EFFORT: Record<string, { label: string }>;
  homeParts: ReturnType<typeof createHomeParts<N>>;
  nextCardHtml: (need: N) => string;
  endRender: (parts: HandledParts<N>, working: WorkingThread[]) => void;
  greeting: () => string;
  today: () => string;
  num: (value: number) => string;
  noun: (word: string) => string;
  plural: (count: number, word: string) => string;
  isBusy: (thread: WorkingThread) => boolean;
  askTitle: (need: N) => string;
  PROJ: (project: string) => string;
  places: Pick<Places, "entries" | "watch" | "has">;
  SV: { homeOrder: (body: HTMLElement) => void };
  announce: (message: string) => void;
  schedule: () => void;
}
export type ThenFields = "EFFORT" | "askTitle" | "PROJ";
