export type EditField = "title" | "label";
export interface ThreadEdit { token: symbol; tid: string; field: EditField; value: string; busy?: boolean; failed?: string }
export interface ThreadMenu { id: string; location: "main" | "page" }

export interface EditDeps {
  controls: ReturnType<typeof import("./controls.js").createThreadControls>;
  requestFocus(targets: (() => HTMLElement)[]): void;
  world: {
    thread: (id: string) => { id: string; title: string; label?: string | null } | null | undefined;
    act: { editThread: (id: string, change: { title: string } | { label: string | null } | { paused: boolean }) => Promise<unknown> };
  };
  render: () => void;
  schedule: () => void;
  announce: (text: string) => void;
  heraldShow: (notice: { kind: "stopped"; text: string; sub: string }, ms: number) => void;
  composerAt: (element: HTMLElement) => { say: HTMLElement; conv: { scroller: HTMLElement } };
}
