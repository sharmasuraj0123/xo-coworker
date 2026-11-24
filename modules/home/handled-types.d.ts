interface HeldNeed {
  key: string;
  t: { project: string };
  heldWhy?: string;
}

export interface HandledParts {
  held: HeldNeed[];
}

export interface WorkingThread {
  id: string;
  project: string;
  title: string;
  checklist: { items: { state: string, text: string }[], done: number, total: number };
}

export interface HandledDeps {
  S: { handledOpen: boolean };
  world: { state: { threads: WorkingThread[] } };
  homeParts: () => HandledParts;
  isBusy: (thread: WorkingThread) => boolean;
  num: (value: number) => string;
  PROJ: (project: string) => string;
  threadMark: (thread: WorkingThread, options: { lead: boolean }) => string;
  askTitle: (need: HeldNeed) => string;
}
