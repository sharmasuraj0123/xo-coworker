import type { RankedNeed } from "../../core/services/decision-types.d.ts";

export type OpenOptions = { only?: "glance" | string[] | null; teach?: string | null };
export type ActionDeps = {
  view(): string;
  unfold(key: string): void;
  scope: ReturnType<typeof import("../../core/kernel/scope.js").createScope>;
  D: {
    needItems(): RankedNeed[];
    isOpen(): boolean;
    bringIn(key: string): void;
    recall(key: string): void;
    open(key: string, options?: OpenOptions): unknown;
  };
  world: { act: { decideItem(id: string, body: { decision: string }): Promise<unknown> } };
  tdock: HTMLElement;
  convThread(view: string): { id: string } | null;
  schedule(): void;
  announce(message: string): void;
};
