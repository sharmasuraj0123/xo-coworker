import type { ChatDeps, ChatState, LocalPrompt, Session } from "./types.d.ts";
import type { createChatTitles } from "./titles.js";

export interface ChatReadDeps {
  world: ChatDeps["world"];
  sessions: () => Session[];
  session: (id: string) => Session | null;
  schedule: () => void;
  ensureModels: (name: string) => void;
  titles: Pick<ReturnType<typeof createChatTitles>, "remember">;
  signal: AbortSignal;
}

export interface TitleSource {
  native(id: string): string | null | undefined;
  read(id: string, native: string, signal: AbortSignal): Promise<void>;
  settled(): void;
}

export type PromptFailure = (
  confirm: ChatState["confirm"], ui: Pick<ChatDeps, "restore" | "heraldShow">,
  local: LocalPrompt, sid: string | null, error: unknown,
) => void;
