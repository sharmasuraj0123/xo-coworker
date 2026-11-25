import type { ChatControls } from "./controls-types.d.ts";

declare module "../../core/kernel/types" {
  interface Services {
    chats: ReturnType<typeof import("./chats.js").createChats> & { attachRecovery(recover: (text: string) => void): () => void };
    intelligence: import("./intel-surface.js").IntelligenceSurface }
  interface Topics { "app:intelligence-changed": undefined }
}

export interface ChatButtons extends Pick<ChatControls, "scope" | "updateComposer"> {
  target: HTMLElement;
  permissions: HTMLElement;
  sendNow: HTMLElement;
  intelligence: HTMLElement;
  aim(): void;
  toggleIntelligence(view: string, button: HTMLElement): void;
}
