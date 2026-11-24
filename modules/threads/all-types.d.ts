import type { ThreadGroup, ThreadInfo, ThreadNeed } from "./groups-types";

export interface AllThread extends ThreadInfo {
  checklist: { done: number; total: number };
  label?: string;
}

export interface AllThreadsDeps {
  S: { view: string; allFilter: ThreadGroup | "all"; allDone: boolean };
  world: { state: { threads: AllThread[] } };
  D: { needItems: () => ThreadNeed[] };
  SHAPE: { word: (key: string) => string };
  PROJ: (project: string | null | undefined) => string;
  convProject: (view: string) => string | null | undefined;
  threadState: (thread: ThreadInfo, needs: ThreadNeed[]) => ThreadGroup;
  threadMark: (thread: AllThread) => string;
  glyphOf: (thread: AllThread) => string;
  rtTag: (thread: AllThread, target: string) => string;
  STATE_WORDS: Record<ThreadGroup, string>;
}
