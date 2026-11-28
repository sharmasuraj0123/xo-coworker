export type { EditorSelection, EditorState, Extension, StateField, Transaction, TransactionSpec } from "@codemirror/state";
export type { Decoration, DecorationSet, EditorView, ViewUpdate, WidgetType } from "@codemirror/view";
export type { LanguageSupport } from "@codemirror/language";

export type CodeMirror =
  typeof import("@codemirror/state")
  & typeof import("@codemirror/view")
  & typeof import("@codemirror/commands")
  & typeof import("@codemirror/search")
  & typeof import("@codemirror/language")
  & typeof import("@codemirror/autocomplete")
  & typeof import("@codemirror/lang-markdown")
  & typeof import("@lezer/highlight")
  & { languages: readonly import("@codemirror/language").LanguageDescription[] };

export type CodeMirrorMerge = typeof import("@codemirror/merge");
