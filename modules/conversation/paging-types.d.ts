import type { canPageOlder } from "../../core/services/world/rows.js";

type History = NonNullable<Parameters<typeof canPageOlder>[0]>;

export type Conversation = {
  view: string;
  rendered: string | null;
  scroller: HTMLElement;
  msgs: HTMLElement;
  follow: { fromTop(): number };
};

export type PagingDeps = {
  MAIN: Conversation;
  CH: { isChats(view: string): boolean };
  world: {
    state: {
      hist: Record<string, History | undefined>;
      threadHist?: Record<string, History | undefined>;
    };
    act: {
      loadOlder(project: string): Promise<unknown>;
      loadOlderThread?: (id: string) => Promise<unknown>;
    };
  };
  convThread(view: string): { id: string } | null;
  chatOf(view: string): string | null;
  render(): void;
};
