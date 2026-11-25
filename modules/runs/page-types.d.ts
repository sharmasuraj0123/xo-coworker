import type { createPages } from "../../shell/panel/pages.js";
import type { RunsOpening } from "./controller-types.d.ts";
import type { RunsPanelDeps } from "./panel-types.d.ts";
import type { RunsReadDeps } from "./read-types.d.ts";
import type { RunsStopOptions, RunStopResult } from "./stop-types.d.ts";

export interface RunsPageDeps {
  stage: RunsPanelDeps["STAGE"] & RunsOpening["STAGE"] & Pick<ReturnType<typeof createPages>, "page"> & RunsReadDeps["STAGE"];
  world: RunsReadDeps["world"] & RunsPanelDeps["world"] & {
    act: {
      stopRun(id: string): Promise<RunStopResult | null>;
      stopRuns(session: string): Promise<RunStopResult | null>;
    };
  };
  headFor: RunsOpening["headFor"];
  placeRegion: RunsPanelDeps["placeRegion"];
  threadScroller: RunsPanelDeps["threadScroller"];
  transcript: { open: RunsPanelDeps["transcriptOpen"]; toggle(key: string): void };
  pendingStops: RunsStopOptions["pendingStops"];
  stopsHerald: RunsStopOptions["stopsHerald"];
  announce: RunsStopOptions["announce"];
  heraldShow: RunsStopOptions["heraldShow"];
  commitMs: number;
}
