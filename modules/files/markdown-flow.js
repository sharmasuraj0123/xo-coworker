// @ts-check

/** @import {CodeMirror, DecorationSet, EditorState, StateField, TransactionSpec, WidgetType} from "./cm-types.d.ts" */

/** @import {SyntaxNode} from "@lezer/common" */

/** @import {PageBlocks} from "./markdown-blocks.js" */

const HARD_BREAK = /(?: {2,}|\\)$/;
const CONTAINER = /^[ \t]*(?:>[ \t]?)*[ \t]*/;
const OPEN = new Set(["Document", "Blockquote", "BulletList", "OrderedList", "ListItem"]);
const QUOTE = /^[ \t]*(?:>[ \t]?)*/;

/** Soft breaks, line end to next text. @param {EditorState} state @param {number} from @param {number} to */
function softBreaksIn(state, from, to) {
  /** @type {[number, number][]} */
  const breaks = [];
  for (let n = state.doc.lineAt(from).number; n < state.doc.lineAt(to).number; n++) {
    const line = state.doc.line(n), next = state.doc.line(n + 1);
    if (HARD_BREAK.test(line.text)) continue;
    const end = line.from + line.text.trimEnd().length;
    breaks.push([end, next.from + (CONTAINER.exec(next.text)?.[0].length ?? 0)]);
  }
  return breaks;
}

/** @param {EditorState} state @param {CodeMirror["syntaxTree"]} syntaxTree @param {PageBlocks} page */
function breaksOf(state, syntaxTree, page) {
  /** @type {[number, number][]} */
  const breaks = [];
  syntaxTree(state).iterate({
    enter({ name, from, to }) {
      if (name !== "Paragraph") return OPEN.has(name);
      const drawn = from <= page.frontTo || page.blocks.some((block) => block.from <= to && block.to >= from);
      if (!drawn) breaks.push(...softBreaksIn(state, from, to));
      return false;
    },
  });
  return breaks;
}

/** @param {WidgetType} space @param {CodeMirror} CM @param {[number, number][]} breaks */
const decorate = (space, { Decoration }, breaks) =>
  Decoration.set(breaks.map(([a, b]) => Decoration.replace({ widget: space }).range(a, b)));

/** Wrapped source lines flow as one paragraph. @param {CodeMirror} CM @param {StateField<PageBlocks>} blocks */
export function createFlowField(CM, blocks) {
  const { StateField, EditorView, WidgetType, syntaxTree } = CM;
  const space = new (class extends WidgetType {
    /** @override */
    toDOM() {
      const gap = document.createElement("span");
      gap.textContent = " ";
      return gap;
    }
    /** @override */
    eq() { return true; }
  })();
  /** @param {EditorState} state @returns {DecorationSet} */
  const flow = (state) => decorate(space, CM, breaksOf(state, syntaxTree, state.field(blocks)));
  return StateField.define({
    create: flow,
    update: (value, tr) => (tr.docChanged || syntaxTree(tr.state) !== syntaxTree(tr.startState) ? flow(tr.state) : value),
    provide: (field) => [EditorView.decorations.from(field), EditorView.atomicRanges.of((view) => view.state.field(field))],
  });
}

/** Enter in a flowing paragraph starts a new one. @param {CodeMirror["syntaxTree"]} tree @param {EditorState} state */
export function breakParagraph(tree, state) {
  if (state.selection.ranges.length > 1) return null;
  const { from, to } = state.selection.main;
  let paragraph = false;
  for (let n = /** @type {SyntaxNode | null} */ (tree(state).resolveInner(from, -1)); n; n = n.parent) {
    if (n.name === "ListItem" || n.name === "FencedCode" || n.name === "CodeBlock") return null;
    if (n.name === "Paragraph") paragraph = n.to >= to;
  }
  if (!paragraph) return null;
  const quote = QUOTE.exec(state.doc.lineAt(from).text)?.[0] ?? "";
  const insert = `\n${quote.trimEnd()}\n${quote}`;
  /** @type {TransactionSpec} */
  const spec = { changes: { from, to, insert }, selection: { anchor: from + insert.length }, userEvent: "input", scrollIntoView: true };
  return spec;
}
