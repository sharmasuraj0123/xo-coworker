// @ts-check

// Markdown as a page you type in: the same CodeMirror editor as Source, drawn as a document you type straight into.

import { createBlockField } from "./markdown-blocks.js";
import { createTableWidget } from "./markdown-table.js";
import { createMarkdownWidgets } from "./markdown-widgets.js";
import { createImageWidget } from "./markdown-figures.js";
import { createInlineWidgets } from "./markdown-inline-widgets.js";
import { createInline } from "./markdown-inline.js";
import { notesOf } from "./markdown-notes.js";
import { reportFailure } from "../../core/services/notices/failures.js";

/** @import {CodeMirror, EditorState, EditorView, Extension, TransactionSpec, ViewUpdate} from "./cm-types.d.ts" */

/** @import {ImageSource} from "./markdown-figures.js" */

/** @param {CodeMirror} CM @param {EditorState} state @param {string} mark @returns {TransactionSpec} */
function toggleMark(CM, state, mark) {
  const n = mark.length;
  return {
    ...state.changeByRange((r) => {
      if (state.sliceDoc(r.from - n, r.from) === mark && state.sliceDoc(r.to, r.to + n) === mark) {
        return { changes: [{ from: r.from - n, to: r.from }, { from: r.to, to: r.to + n }], range: CM.EditorSelection.range(r.from - n, r.to - n) };
      }
      return { changes: [{ from: r.from, insert: mark }, { from: r.to, insert: mark }], range: CM.EditorSelection.range(r.from + n, r.to + n) };
    }),
    userEvent: "input.format", scrollIntoView: true,
  };
}

/** @param {CodeMirror} CM @param {{images?: ImageSource | null}} [options] @returns {Extension} */
export function pageView(CM, { images = null } = {}) {
  const { ViewPlugin, Decoration, WidgetType, EditorView, StateField, syntaxTree, Prec, keymap } = CM;
  const { BlockWidget, MathWidget, FrontWidget, bullet, notesHead } = createMarkdownWidgets(WidgetType);
  const blocks = createBlockField(CM, {
    Table: createTableWidget(WidgetType), Block: BlockWidget, Image: createImageWidget(WidgetType, images), Front: FrontWidget, notesHead,
  });
  const notes = StateField.define({
    create: (state) => notesOf(state.doc.toString()),
    update: (value, transaction) => (transaction.docChanged ? notesOf(transaction.state.doc.toString()) : value),
  });
  const inline = createInline(CM, { widgets: { bullet, MathWidget, ...createInlineWidgets(CM) }, blocks, notes });

  const inlinePlugin = ViewPlugin.fromClass(class {
    /** @param {EditorView} view */
    constructor(view) { this.ranges = inline(view); }
    /** @param {ViewUpdate} update */
    update(update) {
      const { docChanged, viewportChanged, selectionSet, state, startState, view } = update;
      if (docChanged || viewportChanged || selectionSet || syntaxTree(state) !== syntaxTree(startState)) this.ranges = inline(view);
    }
  }, {
    decorations: (plugin) => plugin.ranges.decorations,
    provide: (plugin) => EditorView.atomicRanges.of((view) => view.plugin(plugin)?.ranges.atomic ?? Decoration.none),
  });

  /** @param {string} mark */
  const wrap = (mark) => (/** @type {EditorView} */ view) => {
    view.dispatch(view.state.update(toggleMark(CM, view.state, mark)));
    return true;
  };
  const keys = Prec.high(keymap.of([
    { key: "Mod-b", run: wrap("**") },
    { key: "Mod-i", run: wrap("*") },
    { key: "Mod-e", run: wrap("`") },
    { key: "Mod-Shift-x", run: wrap("~~") },
  ]));

  return [
    blocks, notes, inlinePlugin, keys, EditorView.exceptionSink.of(reportFailure),
    EditorView.editorAttributes.of({ class: "cm-xo-page" }),
  ];
}
