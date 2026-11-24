import type { ViewerDocument } from "./document-types";

type EditorDocument = Pick<ViewerDocument, "kind" | "state" | "cmState" | "merge">;

interface EditorHooks {
  source?: (() => string) | null;
  length?: (() => number) | null;
  apply?: ((edit: { from: number; to: number; insert: string }, info?: { lines?: { from: number; to: number }[] } | null) => void) | null;
}

interface EditorDocuments {
  textOf(document: EditorDocument): string;
  attach(document: EditorDocument, hooks: EditorHooks): void;
  edited(document: EditorDocument): void;
  mergeProgress(document: EditorDocument, left: number): void;
  resolve(document: EditorDocument): boolean;
}

export interface EditorMountOptions {
  docs: EditorDocuments;
  doc: EditorDocument;
  name?: string;
  page?: boolean;
  onLines?: ((l: { a: number, b: number } | null) => void) | null;
  onAsk?: ((l: { a: number, b: number }) => void) | null;
  onSave?: (() => void) | null;
  onKey?: ((e: KeyboardEvent) => boolean) | null;
}
