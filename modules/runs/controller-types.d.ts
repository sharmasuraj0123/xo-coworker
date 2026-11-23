import type { RunCounts, Run, Said } from "./types.d.ts";

export interface RunsState {
  open: boolean;
  session: string | null;
  title: string;
  view: string;
  runId: string | null;
  opening: number;
  head?: Element | null;
  returnTo: Element | null;
  panelWas?: boolean;
  tree: Run[];
  counts: RunCounts | null;
  said: Said | null;
  cmdsOpen: boolean;
  cmdsAll: boolean;
  keepScroll?: boolean;
  listState?: string;
  listErr?: string;
}

export interface RunsOpening {
  STAGE: { readonly isOpen: boolean; show(name: string, key: string): boolean };
  headFor(opener: Element | null): Element | null;
  readRunsList(session: string, opening: number): Promise<boolean>;
  openRun(id: string): Promise<void>;
  runsRender(): void;
  runsLand(): HTMLElement | undefined;
}
