type Scope = Pick<import("../../core/kernel/types").ModuleContext, "listen" | "frame" | "effect">;
type Chats = ReturnType<typeof import("./chats.js").createChats>;

export interface ChatControls {
  scope: Scope;
  list: HTMLElement;
  scroller: HTMLElement;
  greeting: HTMLElement;
  setup: HTMLElement;
  phone: Pick<MediaQueryList, "matches">;
  chats: Pick<Chats, "search" | "showAll" | "setPref" | "closeSetup" | "renderSetup" | "setupOpen">;
  updateComposer(): void;
  openWorkspace(): void;
}
