import type { LocalMessage } from "./delivery-types.d.ts";

export interface LocalRecord {
  id: string;
  who: "rec";
  at: number;
  text: string;
  refused: boolean;
  undo: (() => unknown) | null;
  until: number;
}

interface Welcome {
  id: string;
  conv: string;
  who: "event";
  at: number;
  tone: "ok";
  text: string;
}

export type LocalRow = (LocalMessage & { merged?: boolean }) | LocalRecord | Welcome;
