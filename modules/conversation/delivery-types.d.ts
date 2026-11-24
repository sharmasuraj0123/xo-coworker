import type { createHerald } from "../../core/services/notices.js";
import type { sendBlock } from "../../core/services/world/conn.js";

export type Chip = { blob: Blob };
export type Thread = { id: string; project: string; title?: string };

export type Composer = {
  view: string;
  say: HTMLTextAreaElement;
  send: HTMLButtonElement;
  conv: { follow: { toLatest(smooth?: boolean): void }; msgs: HTMLElement };
};

export type LocalMessage = {
  id: string;
  conv: string;
  at: number;
  who: "you";
  text: string;
  status: "sending" | "sent" | "failed";
  target: string | null;
  to: string;
  cid: string;
  files?: Chip[];
  err?: { title: string; text: string };
};

export type SendFailure = Error & { fileErr?: boolean; code?: string; status?: number };

type SendOptions = { clientId: string; attachments?: string[] };
type Herald = ReturnType<typeof createHerald>;

export type DeliveryDeps = {
  S: {
    view: string;
    n: number;
    lref: Record<string, { path: string; a: number; b: number }>;
    local: Record<string, LocalMessage[]>;
  };
  world: {
    state: NonNullable<Parameters<typeof sendBlock>[0]> & { projects: { id: string; name?: string }[] };
    act: {
      chatId?: (project: string) => string | null;
      ask(project: string, text: string, options: SendOptions): Promise<unknown>;
      reply(id: string, text: string, options: SendOptions): Promise<unknown>;
    };
  };
  MK: Composer;
  say: HTMLTextAreaElement;
  CH: { isChats(view: string): boolean; blocked(view: string): string | null; send(view: string, text: string): void };
  STAGE: { resumeFollow(view: string): void };
  PROJ: (project: string | null) => string;
  chatOf: (view: string) => string | null;
  convOfChat: (chat: string) => string;
  convThread: (view: string) => Thread | null;
  convProject: (view: string) => string | null | undefined;
  composerAt: (node: Element | null) => Composer;
  filesHere: (view: string) => { count: number; busy: boolean; failed: boolean };
  tray: {
    take(view: string): Chip[];
    restore(view: string, files: Chip[]): void;
    ensure(files: Chip[], chat: string | null | undefined, options?: { again?: boolean }): Promise<string[]>;
  };
  dropThumb: (chip: Chip) => void;
  saveDraft: (composer: Composer) => void;
  updateComposer: (composer: Composer) => void;
  growSay: (composer: Composer) => void;
  announce: (text: string) => void;
  heraldShow: Herald["show"];
  heraldFor: Herald["forMsg"];
  schedule: () => void;
  render: () => void;
  go: (view: string, options: { carry: boolean }) => void;
};
