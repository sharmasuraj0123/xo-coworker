import type { Composer } from "./composer-types.d.ts";
export type { Composer } from "./composer-types.d.ts";

type Thread = { project: string; state: string; busy?: boolean };
export type MentionSelection = { selected: number; closedAt: string | null };

export type MentionDeps = {
  MK: Composer;
  world: { state: { threads: Thread[] } };
  projects: () => { id: string; name: string }[];
  projectIcon: (id: string) => string;
  isBusy: (thread: Thread) => boolean;
  saveDraft: (composer: Composer) => void;
  updateComposer: (composer: Composer) => void;
};
