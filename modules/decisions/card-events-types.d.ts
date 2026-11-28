import type { CardNeed as RenderedNeed, ScopeParts } from "./card-types.d.ts";
import type { holdButton } from "./kit.js";

type Hold = ReturnType<typeof holdButton>;
export type CardNeed = RenderedNeed & { t: { id: string } };
export type NoteMode = "reply" | "back";
export type CardChoice = "allow" | "deny" | {
  text?: string | string[];
  option?: string | string[];
  answers?: Record<string, string | string[]>;
  name?: string;
  resolve?: boolean;
  scope?: ScopeParts["scopes"][number];
};

export type CardSurface = {
  surface: "panel" | "dock";
  after(how: "allow" | "back" | "later"): void;
  onStep?: () => void;
};

export type CardFrame = HTMLElement;
export interface CardState {
  openNote?: (mode: NoteMode) => void;
  closeNote?: () => void;
  noting?: () => boolean;
  allow?: () => void;
  quiet?: boolean;
  quietOn?: (text: string) => void;
  quietOff?: () => boolean;
  quietWired?: boolean;
  need?: CardNeed;
  teach?: () => void;
  dis?: (which: string) => void;
}

export type CardEventsDeps = {
  timeout: import("../../core/kernel/types.d.ts").ModuleContext["timeout"];
  F: { hold?: Hold | null; open0: Record<string, { ev?: boolean }> };
  teach: Map<string, string>;
  PROJ(project: string): string;
  decide(need: CardNeed, choice: CardChoice, note: string, options: { secs: number; inline: boolean }): unknown;
  failedWords(key: string, mode: NoteMode): string;
  onOpenThread?: (id: string, surface: CardSurface["surface"]) => void;
  setLater(): void;
  laterNow(key: string): void;
};
