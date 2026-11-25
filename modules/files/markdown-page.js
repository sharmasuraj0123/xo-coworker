// @ts-check

// Markdown as a page you type in: the same CodeMirror editor as Source, drawn as a document you type straight into.

import { createBlockField } from "./markdown-blocks.js";
import { createTableWidget } from "./markdown-table.js";
import { createMarkdownWidgets } from "./markdown-widgets.js";
import { createImageWidget } from "./markdown-figures.js";
import { createInlineWidgets } from "./markdown-inline-widgets.js";
import { createInline } from "./markdown-inline.js";
import { notesOf } from "./markdown-notes.js";
import { setLineStyle, toggleMark } from "./markdown-commands.js";
import { formatBar } from "./markdown-format-bar.js";
import { insertBar } from "./markdown-insert-bar.js";
import { restingCaret } from "./markdown-caret.js";
import { reportFailure } from "../../core/services/notices/failures.js";

/** @import {CodeMirror, EditorView, Extension, TransactionSpec, ViewUpdate} from "./cm-types.d.ts" */

/** @import {PageExtensionOptions} from "./editor-extensions.js" */

/** @import {LineStyle, Mark} from "./markdown-commands.js" */

/** @param {CodeMirror} CM @param {PageExtensionOptions} [options] @returns {Extension} */
export function pageView(CM, { images = null, askAbout = null } = {}) {
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

  /** @param {(view: EditorView) => TransactionSpec} spec @returns {(view: EditorView) => boolean} */
  const command = (spec) => (view) => {
    if (view.state.readOnly) return false;
    view.dispatch(view.state.update(spec(view)));
    return true;
  };

  /** @param {Mark} m */
  const mark = (m) => command((view) => toggleMark(CM, view.state, m));

  /** @param {LineStyle} s */
  const style = (s) => command((view) => setLineStyle(view.state, s));
  const keys = Prec.high(keymap.of([
    { key: "Mod-b", run: mark("bold") },
    { key: "Mod-i", run: mark("italic") },
    { key: "Mod-e", run: mark("code") },
    { key: "Mod-Shift-x", run: mark("strike") },
    { key: "Mod-Alt-0", run: style("body") },
    { key: "Mod-Alt-1", run: style("h1") },
    { key: "Mod-Alt-2", run: style("h2") },
    { key: "Mod-Alt-3", run: style("h3") },
    { key: "Mod-Shift-7", run: style("ol") },
    { key: "Mod-Shift-8", run: style("ul") },
    { key: "Mod-Shift-9", run: style("task") },
  ]));

  return [
    blocks, notes, inlinePlugin, keys, formatBar(CM, askAbout), insertBar(CM), restingCaret(CM), EditorView.exceptionSink.of(reportFailure),
    EditorView.editorAttributes.of({ class: "cm-xo-page" }),
  ];
}
