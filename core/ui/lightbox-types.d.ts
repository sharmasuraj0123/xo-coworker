// @ts-check

export interface Picture {
  key: string;
  name: string;
  title: string | null;
  type: string;
  bytes: number | null;
  w: number | null;
  h: number | null;
  by: string;
  at: string | number | null;
  src: string | null;
  att: { chat: string; id: string } | null;
  project: string | null;
  rel: string | null;
  web: { url: string } | null;
}

export interface LightboxOptions<T extends Picture> {
  openFile?: ((it: T, from: Element | null) => void) | null;
  announce?: (words: string) => void;
  pictures: {
    mediaItemOf: (key: string, from: Element | null) => T | null;
    galleryOf: (root: ParentNode | null) => T[];
    slotOf: (root: ParentNode | null, key: string) => Element | null;
    showSrc: (img: HTMLImageElement, it: T, signal?: AbortSignal) => Promise<void>;
    labelOf: (it: T) => string;
    midName: (name: string, max?: number) => string;
    midNameHtml: (name: string) => string;
    typeWord: (type: string, name: string) => string;
    fmtSize: (n: unknown) => string;
    attachmentUrl: (chat: string, id: string) => string;
    projectDownload: (project: string, rel: string) => Promise<Blob>;
  };
}

export interface Drag {
  x: number;
  y: number;
  t: number;
  axis: "x" | "y" | null;
  dx: number;
  dy: number;
  onImg: boolean;
}

export interface LightboxState<T extends Picture> {
  open: boolean;
  items: T[];
  i: number;
  root: ParentNode | null;
  returnTo: Element | null;
  frame: HTMLElement | null;
  busy: Promise<unknown> | null;
  drag: Drag | null;
}
