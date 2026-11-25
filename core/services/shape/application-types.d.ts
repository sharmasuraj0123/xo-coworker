import type { createShapeStore } from "./store.js";
import type { createWorld } from "../world/store.js";
import type { ShapeStoreOptions } from "./store-options.d.ts";

export interface ApplicationShape {
  scope: import("../../kernel/types").Lifetime;
  events: Pick<ReturnType<typeof createWorld>, "onEvent">;
  notice: NonNullable<ShapeStoreOptions["notice"]>;
}
declare module "../../kernel/types" {
  interface Services {
    shape: ReturnType<typeof createShapeStore>;
    terminalCapability: (available: () => boolean) => () => void;
  }
}
