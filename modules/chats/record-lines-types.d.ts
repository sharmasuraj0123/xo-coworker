export interface IncomingRecord { text: string; refused?: boolean; undo?: (() => unknown) | null }

interface RecordLine {
  at: number;
  text: string;
  refused: boolean;
  undo: (() => unknown) | null;
  until: number;
}

export interface RecordDeps {
  view: () => string;
  localMessages: {
    record(view: string, line: RecordLine): RecordLine & { id: string };
    get(id: string): ({ who: string; text: string } & Partial<Pick<RecordLine, "undo" | "until">>) | undefined;
  };
  announce: (text: string) => void;
  schedule: () => void;
  heraldShow: (notice: { kind: "rec"; text: string; undo: string | null; undoUntil: number }, ms: number) => void;
  dismissRecord: (id: string) => void;
  placeRegion: () => HTMLElement;
}
