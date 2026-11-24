import type { Hop } from "../../core/services/world/hop-types.d.ts";

type Host = { id: string; asks: unknown[]; asker?: string; title: string };

type Session = { role?: string; chat_id?: string };

export type MessageContextDeps = {
  world: {
    state: {
      hosts?: Host[];
      hops?: ReadonlyMap<string, Hop>;
      sessions?: Record<string, Session>;
    };
    act: { projectOf?(chatId: string): string | null };
    project(id: string): { chatId?: string } | null | undefined;
  };
  PROJ(id: string): string;
};
