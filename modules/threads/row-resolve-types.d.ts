export interface ResolveRowDeps {
  world: {
    thread: (id: string) => { title: string, state: string } | undefined;
    subscribe: (listener: () => void) => () => void;
  };
  resolveThread: (id: string, resolved: boolean, options: { undo: boolean, sayFail: boolean }) => Promise<{ ok: boolean, why?: string }>;
  allEl: HTMLElement;
  allRender: () => void;
}
