import type { RunsState } from "./controller-types";
import type { Ancestry, Run, RunCounts, TranscriptItem } from "./types";

export interface RunsReadDeps {
  RS: RunsState & {
    gen: number;
    runCmds?: boolean;
    run: Run | null;
    anc: Ancestry | null;
    items: TranscriptItem[];
    cursor: string | null;
    children: Run[];
    loading: boolean;
    error: string | null;
    gone: string | null;
  };
  world: {
    state: { runs: Map<string, Run> };
    act: {
      listRuns(session: string, options?: ReadOptions): Promise<{ runs?: Run[]; counts?: RunCounts }>;
      run(id: string, options?: ReadOptions): Promise<Run & { ancestry?: Ancestry | null }>;
      transcript(id: string, cursor: string | null, options?: ReadOptions): Promise<{ items?: TranscriptItem[]; next?: string | null }>;
    };
  };
  STAGE: { repaint: () => void };
  runsRender: () => void;
  scope: ReturnType<typeof import("../../core/kernel/scope.js").createScope>;
}

interface ReadOptions {
  signal: AbortSignal;
}
