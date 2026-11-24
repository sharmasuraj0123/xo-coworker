// @ts-check

/** @import {CodeMirror, Decoration, EditorState, StateField, WidgetType} from "./cm-types.d.ts" */

/** @typedef {{from: number, to: number, always?: boolean, table?: boolean}} BlockRange */

/** @typedef {new (source: string, from: number) => WidgetType} Table */

/** @typedef {new (source: string, from: number, preview?: boolean) => WidgetType} Block */

const RICH_FENCE = /^(math|katex|latex|mermaid|chart)$/i;

/** @param {EditorState} state @param {CodeMirror["syntaxTree"]} syntaxTree */
function blocksOf(state, syntaxTree) {
  /** @type {BlockRange[]} */
  const blocks = [];
  syntaxTree(state).iterate({
    enter(node) {
      const { name, from, to } = node;
      if (name === "HorizontalRule") {
        blocks.push({ from, to, always: true });
        return false;
      }
      if (name === "Table") {
        blocks.push({ from, to, always: true, table: true });
        return false;
      }
      if (name === "FencedCode") {
        const info = node.node.getChild("CodeInfo");
        const language = info ? state.sliceDoc(info.from, info.to).trim() : "";
        if (RICH_FENCE.test(language)) blocks.push({ from, to });
        return false;
      }
      if (name === "Paragraph") {
        const source = state.sliceDoc(from, to).trim();
        if (/^\$\$[\s\S]+\$\$$/.test(source) || /^\\\[[\s\S]+\\\]$/.test(source)) blocks.push({ from, to });
        return false;
      }
      return name === "Document" || name === "Blockquote" || name === "BulletList" || name === "OrderedList" || name === "ListItem";
    },
  });
  return blocks.map((block) => ({
    ...block, from: state.doc.lineAt(block.from).from, to: state.doc.lineAt(block.to).to,
  }));
}

/** @param {CodeMirror} CM @param {Table} TableWidget @param {Block} BlockWidget @returns {StateField<BlockRange[]>} */
export function createBlockField({ syntaxTree, StateField, EditorView, RangeSetBuilder, Decoration }, TableWidget, BlockWidget) {
  return StateField.define({
    create: (state) => blocksOf(state, syntaxTree),
    update(previous, transaction) {
      const { state, startState, docChanged } = transaction;
      return docChanged || syntaxTree(state) !== syntaxTree(startState) ? blocksOf(state, syntaxTree) : previous;
    },
    provide: (field) => EditorView.decorations.compute([field, "selection"], (state) => {
      /** @type {import("@codemirror/state").RangeSetBuilder<Decoration>} */
      const decorations = new RangeSetBuilder();
      for (const { from, to, table, always } of state.field(field)) {
        if (to > state.doc.length) continue;
        const source = state.sliceDoc(from, to);
        if (table) {
          decorations.add(from, to, Decoration.replace({ widget: new TableWidget(source, from), block: true }));
          continue;
        }
        const editing = !always && state.selection.ranges.some((range) => range.to >= from && range.from <= to);
        if (editing) {
          decorations.add(to, to, Decoration.widget({ widget: new BlockWidget(source, from, true), block: true, side: 1 }));
        } else {
          decorations.add(from, to, Decoration.replace({ widget: new BlockWidget(source, from), block: true }));
        }
      }
      return decorations.finish();
    }),
  });
}
