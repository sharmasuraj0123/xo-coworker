export interface RenderNeed { admitted?: boolean; later?: boolean }
export interface RenderThread { lastAt: number }
export interface RenderConversation { rendered: string | null }

interface Sync { sync(): void }

export interface RenderDeps<N extends RenderNeed, T extends RenderThread, C extends RenderConversation> {
  world: { state: { loaded?: boolean; threads: T[] } };
  D: Sync & { needItems(): N[] };
  view(): string;
  restoreFocus(): void;
  PAGE_OF: Record<string, string>;
  MAIN: C;
  pings(needs: N[]): void;
  dockAtTop(top: boolean): void;
  convThread(view: string): T | null | undefined;
  sideRender(needs: N[]): void;
  homeRender(needs: N[]): void;
  REC: { artifacts: { render(): void } };
  LPP: { render(): void };
  topRender(needs: N[]): void;
  wsHeadRender(needs: N[]): void;
  drawConv(conversation: C, needs: N[]): void;
  say: HTMLElement;
  msgsEl: HTMLElement;
  placeRegion(): HTMLElement;
  loadAhead(conversation: C): void;
  TP: { C: unknown; tid: string | null; wait?: boolean };
  STAGE: Sync & { pageShown?: { name: string } | null };
  drawThreadPage(needs: N[]): void;
  dockRender(needs: N[]): void;
  heraldRender(needs: N[]): void;
  chatTargetRender(): boolean | undefined;
  targetLineRender(): void;
  syncPlaceholder(): void;
  sendRender(): void;
  chipRender(): void;
  MAP: { render(view: string): void };
  VW: { notice(): void };
  LW: Sync;
  FP: Sync;
  titleFor(count: number, title: string): string;
  isBusy(thread: T): boolean;
}
