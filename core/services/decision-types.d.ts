export type Effort = "glance" | "decide" | "think";

export type NeedThread = {
  id: string;
  title: string;
  state: string;
  checklist: { total: number; done: number };
  stop?: unknown;
  happened?: string;
  asks?: { item?: object }[];
  host?: boolean;
  live?: boolean;
  busy?: boolean;
};

type NeedAsk = { item?: object; kind?: string; title?: string; risk?: string; detail?: string };

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
