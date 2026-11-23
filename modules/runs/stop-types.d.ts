import type { Said } from "./types.d.ts";

export interface RunStopResult {
  stopping?: unknown;
}

interface PendingRunStop {
  what: string;
  key: string;
  session: string | null;
  until: number;
  cancelled: boolean;
  sent: boolean;
}

export interface RunsStopOptions {
  pendingStops: PendingRunStop[];
  stopsOut: Set<string>;
  stopsHerald(): void;
  runsRender(): void;
  announce(message: string): void;
  heraldShow(notice: Omit<Said, "key">, duration: number): void;
  readRunsList(session: string | null): Promise<boolean>;
  commitMs: number;
}
