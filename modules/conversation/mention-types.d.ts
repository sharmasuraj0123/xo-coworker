export type Composer = {
  main: boolean;
  at: HTMLUListElement & { _shut?: string | null; _sel?: number };
  say: HTMLTextAreaElement;
  form: HTMLElement;
};

type Thread = { project: string };

export type MentionDeps = {
  MK: Composer;
  world: { state: { threads: Thread[] } };
  projects: () => { id: string; name: string }[];
  projectIcon: (id: string) => string;
  isBusy: (thread: Thread) => boolean;
  saveDraft: (composer: Composer) => void;
  updateComposer: (composer: Composer) => void;
};
