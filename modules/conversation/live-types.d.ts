type History = { loaded?: boolean; all?: boolean; loading?: boolean };
type Thread = { id: string; project: string; loaded?: boolean; messages: { seq?: number | null }[] };

export type LiveConversationDeps = {
  S: { view: string };
  world: {
    state: {
      hist: Record<string, History | undefined>;
      timeline: Record<string, { id: string }[] | undefined>;
      threadHist?: Record<string, History | undefined>;
      found?: Record<string, Set<string> | undefined>;
    };
    act: {
      watch(ids: string[]): unknown;
      watchThread(id: string | null): unknown;
      watchSession?: (id: string | null) => unknown;
      loadHops?: (id: string) => unknown;
      loadChatHops?: (project: string) => unknown;
      findRows?: (project: string, ids: string[], seq: number | null | undefined) => unknown;
    };
  };
  CH: { isChats(view: string): boolean; open(view: string): unknown };
  convThread(view: string): Thread | null;
  chatOf(view: string): string | null;
};
