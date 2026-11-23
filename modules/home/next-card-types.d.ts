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
    chatId?: string;
    plainSession?: string;
    asker?: boolean;
  };
  ask: {
    kind: string;
    options?: string[];
    item?: object;
    replyOnly?: boolean;
  };
}

export interface Evidence {
  preview?: { label: string, css: string, sample?: string }[] | null;
}

export interface NextCardDeps {
  D: {
    failedNote: (key: string) => string | null | undefined;
    parts: {
      chipsHtml: (need: NextCardNeed) => string;
      effTagHtml: (need: NextCardNeed) => string;
      leadHtml: (need: NextCardNeed, id: string, heading: string) => string;
    };
  };
  Kit: { isBinary: (ask: NextCardNeed["ask"]) => boolean };
  evidenceFor: (need: NextCardNeed) => Evidence;
  PROJ: (project: string) => string;
  convOfChat: (chat: string) => string;
}
