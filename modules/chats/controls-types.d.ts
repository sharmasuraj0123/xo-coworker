type Scope = Pick<import("../../core/kernel/types").ModuleContext, "listen" | "effect">;
type Chats = ReturnType<typeof import("./chats.js").createChats>;

export interface ChatControls {
  scope: Scope;
  list: HTMLElement;
  setup: HTMLElement;
  chats: Pick<Chats, "search" | "setPref" | "closeSetup" | "renderSetup" | "setupOpen">;
  updateComposer(): void;
}
