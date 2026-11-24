import type { CardNeed as RenderedNeed } from "./card-types.d.ts";
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
};

export type CardSurface = {
  surface: "panel" | "dock";
  after(how: "allow" | "back" | "later"): void;
  onStep?: () => void;
};

export type CardFrame = HTMLElement & {
  _openNote?: (mode: NoteMode) => void;
  _closeNote?: () => void;
  _noting?: () => boolean;
  _allow?: () => void;
  _hint?: (text: string) => void;
  _quiet?: boolean;
  _quietOn?: (text: string) => void;
  _quietOff?: () => boolean;
  _quietWired?: boolean;
  _quietWhy?: string | null;
  _n?: CardNeed;
  _teach?: () => void;
  _dis?: (which: string) => void;
  _hold?: Hold | null;
};

export type CardEventsDeps = {
  F: { hold?: Hold | null; open0: Record<string, { ev?: boolean }> };
  teach: Map<string, string>;
  PROJ(project: string): string;
  decide(need: CardNeed, choice: CardChoice, note: string, options: { secs: number; inline: boolean }): unknown;
  failedWords(key: string, mode: NoteMode): string;
  onOpenThread?: (id: string, surface: CardSurface["surface"]) => void;
  setLater(): void;
  laterNow(key: string): void;
};
