import type { createRunsStrip } from "./strip.js";

declare module "../../core/kernel/types" {
  interface Services {
    runs: { working: ReturnType<typeof createRunsStrip>["workingRuns"]; isOpen(): boolean; back(): void };
  }
}
