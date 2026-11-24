export interface NextCardNeed {
  key: string;
  risk: string;
  effort: string;
  group: string;
  t: {
    id: string;
    project: string;
    title: string;
    host?: boolean;
    chatId?: string | null;
    plainSession?: string | null;
    asker?: string;
  };
  ask: {
    kind?: string;
    options?: string[];
    item?: object;
    replyOnly?: boolean;
  };
}

export interface Evidence {
  preview?: { label: string, css: string, sample?: string }[] | null;
}

export interface NextCardDeps<N extends NextCardNeed> {
  D: {
    failedNote: (key: string) => string | null | undefined;
    parts: {
      chipsHtml: (need: N) => string;
      effTagHtml: (need: N) => string;
      leadHtml: (need: N, id: string, heading: string) => string;
    };
  };
  Kit: { isBinary: (ask: NextCardNeed["ask"]) => boolean };
  evidenceFor: (need: N) => Evidence;
  PROJ: (project: string) => string;
  convOfChat: (chat: string) => string;
}
