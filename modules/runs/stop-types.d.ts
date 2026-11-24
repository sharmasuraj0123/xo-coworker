import type { Said } from "./types.d.ts";

export interface RunStopResult {
  stopping?: unknown;
}

export interface RunsStopOptions {
  pendingStops: ReturnType<typeof import("../../core/services/run-stops.js").createPendingRunStops>;
  stopsOut: Set<string>;
  stopsHerald(): void;
  runsRender(): void;
  announce(message: string): void;
  heraldShow(notice: Omit<Said, "key">, duration: number): void;
  readRunsList(session: string | null): Promise<boolean>;
  commitMs: number;
  scope: ReturnType<typeof import("../../core/kernel/scope.js").createScope>;
}
