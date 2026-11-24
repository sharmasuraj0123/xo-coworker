import type { Conversation } from "./draw-types.d.ts";
import type { Run } from "./stop-types.d.ts";

type MarkupNode = HTMLElement & { _h?: string | null };

export type Composer = {
  main: boolean;
  view: string;
  say: HTMLTextAreaElement;
  send: HTMLButtonElement;
  form: HTMLFormElement;
  target: MarkupNode;
  label: HTMLElement;
  conv: Conversation;
  tray: MarkupNode;
  attach: HTMLButtonElement;
  input: HTMLInputElement;
  note: HTMLElement;
  iq: MarkupNode | null;
  at: MarkupNode & { _sel: number; _shut?: string | null };
};

export type ComposerControlsDeps = {
  MK: Composer;
  S: { view: string };
  CH: {
    isChats(view: string): boolean;
    chipHtml(view: string): string;
    chipTitle(view: string): string;
    permHtml(view: string): string;
    permTitle(view: string): string;
    blocked(view: string): boolean | string | null;
    targetHtml(view: string): string;
    nowState(view: string): { on: boolean } | null;
  };
  IQ: {
    kindOf(session: string): string | null;
    chipHtml(session: string, phone: boolean): string;
    chipTitle(session: string): string;
    current(session: string): { pinned?: boolean };
  };
  PHONE: { matches: boolean };
  STOP_ICON: string;
  sessionOf(view: string): string;
  filesHere(view: string): { count: number; busy: boolean; failed: boolean };
  running(view: string): Run | null;
  liveBlock(view?: string, text?: string): string | null;
};
