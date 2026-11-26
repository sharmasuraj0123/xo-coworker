export type Setup = { agent?: string | null; model?: string | null; effort?: string | null };
export type Strong = "model" | "effort" | null;
export type SetupChange = { by: string; model?: string; effort?: string };
export type Hand = { from?: Setup | null; to: Setup; words: string; at: number; after?: string; strong?: Strong };
export type Back = {
  from: string | null; to: string | null; toWho: string; at: number;
  title?: string | null; file?: string | null; path?: string | null;
};
