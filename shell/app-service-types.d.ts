import type { createWorld } from "../core/services/world/store.js";

export interface AppServices {
  world: ReturnType<typeof createWorld>;
  announce: (message: string) => void;
  projectName: (id: string | null | undefined) => string;
}

declare module "../core/kernel/types" {
  interface Services extends AppServices {}
}
