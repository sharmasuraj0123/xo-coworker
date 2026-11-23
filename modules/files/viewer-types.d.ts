import type { ChangeInfo } from "./types";
import type { createDocs } from "./documents.js";
import type { mount } from "./editor.js";
import type { createViewerDiff, FileChange } from "./viewer-diff.js";

export interface ViewerFile {
  name?: string;
  path?: string;
  type?: string;
  project?: string;
  rel?: string;
  bytes?: number | null;
  att?: { chat: string; id: string };
  local?: string | null;
  why?: string;
  created?: string | boolean;
  lines?: [number, number];
  show?: string;
  pin?: boolean;
}

export type OpenFile = ViewerFile & { image: boolean; where: string };
export type FileVersion = ChangeInfo & { text?: string | null; gone?: boolean };
export interface ViewerDocument {
  key: string;
  project: string;
  rel: string;
  state: string;
  version: string | null;
  versions: FileVersion[];
  viewing: FileVersion | null;
  checkedSig?: string;
  err?: string | null;
  merge?: { left: number } | null;
  confirm?: boolean;
}

export interface ViewerData {
  kind: string;
  name?: string;
  content?: string;
  url?: string;
  size_bytes?: number | null;
  remote?: boolean;
  editable?: boolean;
  not_editable_reason?: string;
  truncated?: boolean;
  place?: string;
  doc?: ViewerDocument;
}

export interface ViewerTab { file: OpenFile; data: ViewerData | null; doc: ViewerDocument | null; preview: boolean }
export interface BusyState { kind: "copy" | "download"; shown: boolean }
export interface UnsavedQuestion { docs: ViewerDocument[]; then(): void; cancel: (() => void) | null }
export interface ViewerState {
  open: boolean;
  parked: boolean;
  file: OpenFile | null;
  data: ViewerData | null;
  error: string | null;
  loading: boolean;
  mode: string;
  textMode: string;
  imgMode: string;
  returnTo: Element | null;
  gen: number;
  copied: false | BusyState;
  dims: { w: number; h: number } | null;
  busy: BusyState | null;
  saveError: string | { text: string; select?: string } | null;
  show: string;
  split: boolean;
  menu: boolean;
  tabs: ViewerTab[];
  showChanges: boolean;
  why?: string | null;
  asking?: UnsavedQuestion | null;
  savedFlash?: ViewerDocument | null;
  tab?: ViewerTab | null;
  focusText?: boolean;
  keepScroll?: boolean;
  keep?: number;
}

type Lines = { a: number; b: number };
export interface ViewerTextState {
  el: HTMLElement | null;
  h: Awaited<ReturnType<typeof mount>> | null;
  key: string | null;
  gen: number;
  sel: Lines | null;
  asking: false | Lines;
  q: HTMLFormElement | null;
}

type DiffDeps = Parameters<typeof createViewerDiff>[0];
export type ViewerChanges = DiffDeps["changes"] & { at(project: string, rel: string): FileChange | null };
export interface ViewerOptions {
  announce(text: string): void;
  onChange?: () => void;
  tabs?: () => string;
  changes?: ViewerChanges | null;
  ask?: {
    target(file: ViewerFile): string | null;
    compose?(file: ViewerFile, from: number, to: number): boolean;
    send(file: ViewerFile, from: number, to: number, text: string): boolean;
    file?(file: ViewerFile): void;
  } | null;
  edits?: { saved?(file: { project: string; rel: string }): void } | null;
  away?: (() => boolean) | null;
  home?: (() => HTMLElement | null) | null;
  threadTitle?: (timestamp: string) => string | null;
  opened?: ((file: ViewerFile, options: { focus: boolean }) => void) | null;
  closed?: (() => void) | null;
}

export interface ViewerRenderers extends Pick<DiffDeps, "diff" | "isImageChange" | "drawImageChange"> {
  $(selector: string): Element | null;
  jump(host: HTMLElement, direction: -1 | 1): void;
}

type DocumentApi = ReturnType<typeof createDocs>;
export interface ViewerContext {
  V: ViewerState;
  TX: ViewerTextState;
  el: HTMLElement;
  docs: DocumentApi;
  doc(): ViewerDocument | null;
}

export interface ViewerHeadDependencies extends Pick<ViewerContext, "V" | "TX" | "el" | "doc"> {
  canSave(): boolean;
  chg(): FileChange | null;
  showsDiff(): boolean;
  showsText(): boolean;
  runsCode(): boolean;
  ask: ViewerOptions["ask"];
  threadTitle: NonNullable<ViewerOptions["threadTitle"]>;
}

export interface ViewerTextDependencies extends ViewerContext {
  isMd(): boolean;
  ask: ViewerOptions["ask"];
  inRegion(host: HTMLElement, change: () => void): void;
  announce: ViewerOptions["announce"];
  threadTitle: NonNullable<ViewerOptions["threadTitle"]>;
  paintHead(): void;
}

export interface ViewerReadDependencies extends Pick<ViewerContext, "V" | "docs" | "doc"> {
  changes: ViewerOptions["changes"];
  dropImage(): void;
  render(): void;
  announce: ViewerOptions["announce"];
  paintHead(): void;
}

type ViewerHead = ReturnType<typeof import("./viewer-head.js").createViewerHead>;
type ViewerText = ReturnType<typeof import("./viewer-text.js").createViewerText>;
type ViewerDiff = ReturnType<typeof createViewerDiff>;
export interface ViewerEventDependencies extends ViewerContext,
  Pick<ViewerHead, "headFocus" | "menuItems" | "menuOff" | "paintHead" | "shown">,
  Pick<ViewerText, "drawText" | "showChangesNow" | "stepVersion">,
  Pick<ViewerDiff, "DF" | "diffBody" | "drawDiff"> {
  ask: ViewerOptions["ask"];
  away: ViewerOptions["away"];
  chg(): FileChange | null;
  close(options: { ask: boolean }): void;
  closeTab(index: number): void;
  copy(text: string, what?: string): Promise<void>;
  download(): Promise<void>;
  dropImage(): void;
  isMd(): boolean;
  load(): Promise<void>;
  localPath(): string;
  onChange: ViewerOptions["onChange"];
  render(): void;
  showTab(tab: ViewerTab): void;
  showsDiff(): boolean;
  announce: ViewerOptions["announce"];
  answerUnsaved(how: string | undefined): Promise<void>;
  jump: ViewerRenderers["jump"];
}

export type FileChangeEvent = ChangeInfo & { project_id?: string; type?: string; path?: string; old_path?: string };
