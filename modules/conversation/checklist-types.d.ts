import type { stopWords } from "../../core/services/world/conversation.js";

type ChecklistThread = {
  id: string;
  state: string;
  stop?: Parameters<typeof stopWords>[0];
  branch?: string;
  checklist: { total: number; done: number; items: { state: string; text: string }[] };
};

export type ChecklistNeed = { t: { id: string } };
export type ChecklistHead = HTMLElement & { _h?: string };

export type ChecklistDeps = {
  S: {
    view: string;
    ckOpen: Record<string, boolean | undefined>;
    ckSeen: Record<string, number | undefined>;
    ckFresh?: { tid: string; text: string; until: number } | null;
  };
  SHAPE: { on(key: string): boolean };
  convThread(view: string): ChecklistThread | null;
  runsStrip(thread: ChecklistThread): string;
  schedule(): void;
};
