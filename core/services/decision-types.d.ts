import type { ReviewDescription } from "./review-description.d.ts";
export type Effort = "glance" | "decide" | "think";

export type NeedThread = {
  id: string;
  title: string;
  state: string;
  checklist: { total: number; done: number; items?: { state: string; text: string }[] };
  stop?: unknown;
  happened?: string;
  asks?: NeedAsk[];
  host?: boolean;
  live?: boolean;
  busy?: boolean;
  frozen?: boolean;
  needsYou?: string;
};

export type NeedAsk = {
  item?: ReviewDescription;
  id?: string | null;
  kind?: string;
  title?: string;
  risk?: string;
  detail?: string;
  synthetic?: boolean;
  pending?: boolean;
  replyOnly?: boolean;
};

export type NeedFields = { key: string; t: NeedThread; ask: NeedAsk; group: string; risk: string };

export type RankFields = {
  since: number;
  waitSince: number;
  effort: Effort;
  lev: { min: number; steps: number };
  idle: boolean;
  later: boolean;
};

export type PacingFields = { bypass?: boolean; held?: boolean; heldWhy?: string; admitted?: boolean };

export type RankedNeed = NeedFields & RankFields & PacingFields;
