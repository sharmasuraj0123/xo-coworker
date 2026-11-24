export type EditField = "title" | "label";
export interface ThreadEdit { tid: string; field: EditField; value: string; busy?: boolean; failed?: string }

export interface EditDeps {
  S: { tMenu: string | null; tMenuIn: string | null; tEdit: ThreadEdit | null; focusNext?: (() => HTMLElement)[] | null };
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
