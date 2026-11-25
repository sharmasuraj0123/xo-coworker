// @ts-check

// Markdown as a page you type in: the same CodeMirror editor as Source, drawn as a document you type straight into.

import { createBlockField } from "./markdown-blocks.js";
import { createTableWidget } from "./markdown-table.js";
import { createMarkdownWidgets } from "./markdown-widgets.js";
import { reportFailure } from "../../core/services/notices/failures.js";

/** @import {CodeMirror, Decoration, EditorState, EditorView, Extension, TransactionSpec, ViewUpdate} from "./cm-types.d.ts" */

const INLINE_MATH = /(?<![\\$\w])\$(?=[^\s$])((?:\\.|[^$\\\n])*?[^\s\\$])\$(?![\w$])/g;
const HIDE_MARKS = new Set(["HeaderMark", "EmphasisMark", "StrikethroughMark", "CodeMark", "QuoteMark", "LinkMark", "URL", "LinkTitle"]);

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

/** @param {CodeMirror} CM @returns {Extension} */
export function pageView(CM) {
  const { ViewPlugin, Decoration, WidgetType, EditorView, syntaxTree, Prec, keymap } = CM;
  const TableWidget = createTableWidget(WidgetType);

  const { BlockWidget, MathWidget, bullet } = createMarkdownWidgets(WidgetType);
  const blockField = createBlockField(CM, TableWidget, BlockWidget);

  // ── inline: the visible lines only, again as the view scrolls or the caret moves ──
  const H = [1, 2, 3, 4, 5, 6].map((n) => Decoration.line({ class: `cm-md-h cm-md-h${n}` }));
  const quoteLine = Decoration.line({ class: "cm-md-quote" });
  const fenceLine = Decoration.line({ class: "cm-md-fence" });
  const hide = Decoration.replace({});
  const codeMark = Decoration.mark({ class: "cm-md-code" });
  const linkMark = Decoration.mark({ class: "cm-md-link" });

  /** @param {EditorView} view */
  function inline(view) {
    const { state } = view;
    const tree = syntaxTree(state);
    /** @type {import("@codemirror/state").Range<Decoration>[]} */
    const ranges = [];
    /** @type {import("@codemirror/state").Range<Decoration>[]} */
    const atomic = [];
    /** @type {Map<number, Decoration>} */
    const lineDeco = new Map();
    for (const { from, to } of view.visibleRanges) {
      tree.iterate({
        from, to,
        enter(n) {
          const name = n.name;
          const h = /^(?:ATX|Setext)Heading(\d)$/.exec(name);
          if (h) { lineDeco.set(state.doc.lineAt(n.from).from, H[+h[1] - 1]); }
          else if (name === "Blockquote") { for (let p = n.from; p <= n.to;) { const l = state.doc.lineAt(p); lineDeco.set(l.from, quoteLine); p = l.to + 1; } }
          else if (name === "FencedCode") { for (let p = n.from; p <= n.to;) { const l = state.doc.lineAt(p); lineDeco.set(l.from, fenceLine); p = l.to + 1; } return false; }
          else if (name === "InlineCode") ranges.push(codeMark.range(n.from, n.to));
          else if (name === "Link") {
            const marks = n.node.getChildren("LinkMark");
            if (marks.length >= 2 && marks[0].to < marks[1].from) ranges.push(linkMark.range(marks[0].to, marks[1].from));
          } else if (name === "ListMark") {
            const t = state.sliceDoc(n.from, n.to);
            if (t === "-" || t === "*" || t === "+") { const r = Decoration.replace({ widget: bullet }).range(n.from, n.to); ranges.push(r); atomic.push(r); }
          } else if (HIDE_MARKS.has(name)) {
            // a heading's # takes its space with it
            let end = n.to;
            if (name === "HeaderMark" && state.sliceDoc(end, end + 1) === " ") end++;
            if (name === "QuoteMark" && state.sliceDoc(end, end + 1) === " ") end++;
            if (end > n.from) { const r = hide.range(n.from, end); ranges.push(r); atomic.push(r); }
          }
        },
      });
      // inline math, outside code: drawn, but its TeX while the caret is inside the formula itself
      for (let p = from; p <= to;) {
        const l = state.doc.lineAt(p);
        if (l.text.includes("$")) {
          INLINE_MATH.lastIndex = 0;
          let m;
          while ((m = INLINE_MATH.exec(l.text))) {
            const a = l.from + m.index, b = a + m[0].length;
            const node = tree.resolveInner(a + 1, 1);
            if (/Code/.test(node.name) || /Code/.test(node.parent?.name || "")) continue;
            if (state.selection.ranges.some((range) => (range.from > a && range.from < b) || (range.to > a && range.to < b))) continue;
            ranges.push(Decoration.replace({ widget: new MathWidget(m[0], a) }).range(a, b));
          }
        }
        p = l.to + 1;
      }
    }
    for (const [at, d] of lineDeco) ranges.push(d.range(at));
    return { decorations: Decoration.set(ranges, true), atomic: Decoration.set(atomic, true) };
  }

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
    blockField, inlinePlugin, keys, EditorView.exceptionSink.of(reportFailure),
    EditorView.editorAttributes.of({ class: "cm-xo-page" }),
  ];
}
