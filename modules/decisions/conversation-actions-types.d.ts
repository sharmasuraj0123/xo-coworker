import type { RankedNeed } from "./needs.js";

export type OpenOptions = { only?: string[] | null; teach?: string | null };
export type DecisionError = Error & { gone?: string };

export type ActionDeps = {
  S: {
    view: string;
    dockFold: Record<string, boolean>;
    later: Set<string>;
    limitBusy?: string | null;
    limitErr?: { id: string; text: string } | null;
  };
  D: {
    needItems(): RankedNeed[];
    isOpen(): boolean;
    bringIn(key: string): void;
    open(key: string, options?: OpenOptions): unknown;
  };
  world: { act: { decideItem(id: string, body: { decision: string }): Promise<unknown> } };
  tdock: HTMLElement;
  convThread(view: string): { id: string } | null;
  schedule(): void;
  announce(message: string): void;
};
