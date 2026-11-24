export interface IncomingRecord { text: string; refused?: boolean; undo?: (() => unknown) | null }

interface LocalRecord { id: string; text: string; until?: number; undo?: (() => unknown) | null }

export interface RecordDeps {
  S: { n: number; view: string; local: Record<string, LocalRecord[]>; herald: { undo?: string | null; until: number } | null };
  announce: (text: string) => void;
  schedule: () => void;
  heraldShow: (notice: { kind: "rec"; text: string; undo: string | null; undoUntil: number }, ms: number) => void;
  heraldNext: () => void;
  placeRegion: () => HTMLElement;
}
