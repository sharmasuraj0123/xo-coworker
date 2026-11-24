import type { actsOf, headOf } from "./cardparts.js";
import type { Effort } from "../../core/services/decision-types.d.ts";
import type { LimitItem } from "./cards/evidence-types.d.ts";
import type { paidHtml } from "./cards/paid.js";

type BaseNeed = Parameters<typeof headOf>[0];
type BaseItem = NonNullable<BaseNeed["ask"]["item"]>;

export type CardItem = BaseItem & {
  id: string;
  title: string;
  detail?: NonNullable<BaseItem["detail"]> & { name?: string };
  annotations?: { by: string; note: string }[];
  parked?: boolean;
  limit?: LimitItem["limit"];
  paid?: NonNullable<Parameters<typeof paidHtml>[0]>["paid"];
};

export type CardNeed = BaseNeed & {
  key: string;
  effort: Effort;
  ask: {
    item?: CardItem;
    full?: string;
    detail?: string;
    stopByYou?: boolean;
    options?: string[];
  };
  t: {
    title: string;
    project: string;
    host?: boolean;
    asker?: string;
    live?: boolean;
    branch?: string;
    messages: { who: string; at: number; text: string }[];
    checklist: { items: { state: string; text: string }[]; done: number; total: number };
  };
};

export type CardDeps = {
  PROJ(project: string): string;
  world: { act: { resolve?: unknown } };
  F: { open0: Record<string, { ev?: boolean }> };
  teach: Map<string, string>;
  noSecret: Set<string>;
};

export type Option = { label: string; description?: string; cost?: string; recommended?: boolean };
export type Question = { id: string; question: string; header: string; multi: boolean; secret: boolean; options: Option[] };
export type Action = ReturnType<typeof actsOf>[number];
export type ScopeParts = { primary: { label: string } | null; scopes: { id: string; scope: string; label: string; sentence?: string }[] };
export type Strip = { tag?: string } & (
  | { type: "diff"; lines: { text: string; sign: string }[] }
  | { type: "paths"; items: { path: string; add?: number; del?: number }[]; more?: number }
  | { type: "files"; items: string[]; more?: number }
  | { type: "plan" | "error" | "command" | "url" | "tool"; text: string; more?: boolean }
);
