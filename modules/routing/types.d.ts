export interface Router {
  mode?: string;
  decision_model?: string | null;
  abstain_below?: number;
}

export interface RoutingProject {
  id: string;
  chatId: string;
  name?: string;
  routing?: Router | null;
}

export interface DecisionModel {
  id: string;
  label: string;
  connected?: boolean;
  model?: string;
  docs_url?: string;
}

export interface RoutingState {
  router: Router | null;
  models: DecisionModel[];
  form: string | null;
  confirm: { dm: string; chats: string[] } | null;
  err: {
    routing?: string | null;
    route?: string | null;
    dm?: string | null;
    dmOff?: string | null;
    ov?: { chat: string; text: string } | null;
  };
}

export interface RoutingHost {
  box(id: string): Element | null;
  paint(id: string, html: string): void;
  focusTo(id: string, selector: string | null): void;
  pend(key: string, page: string, render: () => void, work: () => Promise<unknown>, from?: Element | null): Promise<unknown>;
  neighbour(from: Element | null, row: string, attr: string): string | null;
  sel(attr: string, value: string): string;
  errHtml(text: string | null | undefined): string;
  waits(key: string): string;
}

export interface RoutingOptions {
  world: {
    state: { router?: Router | null; projects: RoutingProject[] };
    project(id: string): RoutingProject | null | undefined;
    subscribe?(fn: () => void): () => void;
  };
  announce(words: string): void;
  PROJ(id: string): string;
  onChange(): void;
}

export interface RoutingActionsView {
  signal: AbortSignal;
  render(): void;
  refreshRouter(accept: (router: Router) => void): Promise<void>;
  write<T>(work: () => Promise<T>): Promise<T | undefined>;
  commit(update: () => void): boolean;
}
