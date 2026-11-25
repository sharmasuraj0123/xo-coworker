type ResolveNotice = import("./resolve.js").ResolveNotice;

export interface ResolveDeps {
  signal?: AbortSignal;
  world: {
    thread: (id: string) => { title: string } | null | undefined;
    act: { resolve: (id: string, resolved: boolean) => Promise<unknown> };
  };
  schedule: () => void;
  announce: (message: string) => void;
  heraldFor: (subject: string, make: () => ResolveNotice, duration: number) => boolean;
  heraldShow: (notice: ResolveNotice, duration: number) => void;
  heraldDrop: (subject: string) => void;
}
