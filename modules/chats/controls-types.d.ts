type Scope = ReturnType<typeof import("../../core/kernel/scope.js").createScope>;
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
}
