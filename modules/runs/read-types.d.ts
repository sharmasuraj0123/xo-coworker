import type { RunsState } from "./controller-types";
import type { Ancestry, Run, RunCounts, TranscriptItem } from "./types";

export interface RunError extends Error {
  code?: string;
  summary?: string;
  status?: number;
}

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
    pollT: ReturnType<typeof setTimeout> | null;
  };
  world: {
    state: { runs: Map<string, Run> };
    act: {
      listRuns(session: string): Promise<{ runs?: Run[]; counts?: RunCounts }>;
      run(id: string): Promise<Run & { ancestry?: Ancestry }>;
      transcript(id: string, cursor: string | null): Promise<{ items?: TranscriptItem[]; next?: string | null }>;
    };
  };
  STAGE: { repaint: () => void };
  runsRender: () => void;
}
