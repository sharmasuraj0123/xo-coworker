export type Thread = { frozen?: boolean; state: string };
export type Composer = { view: string; say: HTMLTextAreaElement; target: HTMLElement & { _h?: string }; label: HTMLElement };

export type TargetDeps = {
  MK: Composer;
  world: { state: { projects: readonly { id: string; name?: string }[] } };
  CH: { isChats(view: string): boolean; placeholder(view: string): string };
  PHONE: MediaQueryList;
  PROJ: (project: string | null | undefined) => string;
  convThread: (view: string) => Thread | null;
  convProject: (view: string) => string | null | undefined;
  liveBlock: (view: string, text: string) => string | null;
  isBusy: (thread: Thread) => boolean;
  sendWhileRunning: (thread: Thread) => string | null;
  noun: (word: string) => string;
};
