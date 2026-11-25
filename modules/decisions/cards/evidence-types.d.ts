import type { ReviewDescription } from "../../../core/services/review-description.d.ts";

export type Change = { label: string; lang: string; text: string };

type Checklist = { items: { state: string; text: string }[]; done: number; total: number };
type Thread = { checklist: Checklist; branch?: string; host?: boolean };

export type EvidenceNeed = { t: Thread & { messages: { who: string; at: number; text: string }[] } };
export type WaitingNeed = { t: Thread; ask: { full?: string; detail?: string } };

export type ItemNeed = {
  t: Thread;
  ask: { item: ReviewDescription & { annotations?: { by: string; note: string }[] } };
};

export type LimitItem = {
  limit: { resetsAt?: string; moveTo?: string; threads: { ts: string; title?: string; stays?: boolean }[] };
};
