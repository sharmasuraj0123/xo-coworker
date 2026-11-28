type Scope = Pick<import("../../core/kernel/types").ModuleContext, "listen" | "effect">;
type Chats = ReturnType<typeof import("./chats.js").createChats>;

export interface ChatControls {
  scope: Scope;
  setup: HTMLElement;
  chats: Pick<Chats, "setPref" | "closeSetup" | "renderSetup" | "setupOpen">;
  updateComposer(): void;
  openWorkspace(): void;
}
