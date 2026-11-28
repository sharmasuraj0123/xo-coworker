// @ts-check

import { frontMatterOf } from "./markdown-front-matter.js";

/** @import {CodeMirror, Decoration, EditorState, StateField, WidgetType} from "./cm-types.d.ts" */

/** @typedef {{from: number, to: number, always?: boolean, table?: boolean, image?: boolean, front?: [string, string][]}} BlockRange */

/** @typedef {{at: number, label: string | null}} Caption */

/** @typedef {{blocks: BlockRange[], captions: Caption[], notesAt: number | null, frontTo: number}} PageBlocks */

/** @typedef {new (source: string, from: number) => WidgetType} Table */

/** @typedef {new (source: string, from: number, preview?: boolean) => WidgetType} Block */

/** @typedef {new (fields: [string, string][]) => WidgetType} Front */

/** @typedef {{Table: Table, Block: Block, Image: Block, Front: Front, notesHead: WidgetType}} BlockWidgets */

const RICH_FENCE = /^(math|katex|latex|mermaid|chart)$/i;
const FIGURE_FENCE = /^(mermaid|chart)$/i;
const CAPTION = /^\s*([*_])(?![*_\s])(.*\S)\1\s*$/;
const LABELLED = /^(?:Table|Figure|Fig\.)\s*\d+/i;
const NOTE_DEF = /^\[\^[^\]\s]+\]:/m;

/** @param {EditorState} state @param {CodeMirror["syntaxTree"]} syntaxTree @returns {PageBlocks} */
function blocksOf(state, syntaxTree) {
  const front = frontMatterOf(state.sliceDoc(0, Math.min(state.doc.length, 8192)));
  const frontTo = front ? front.to : -1;
  /** @type {BlockRange[]} */
  const blocks = front ? [{ from: 0, to: front.to, front: front.fields }] : [];
  /** @type {Caption[]} */
  const captions = [];
  const count = { Table: 0, Figure: 0 };
  /** @type {{kind: "Table" | "Figure", line: number} | null} */
  let last = null;
  /** @param {"Table" | "Figure"} kind @param {number} to */
  const figure = (kind, to) => { last = { kind, line: state.doc.lineAt(to).number }; };
  syntaxTree(state).iterate({
    enter(node) {
      const { name, from, to } = node;
      if (name === "Document") return true;
      if (from <= frontTo) return false;
      const follows = last && state.doc.lineAt(from).number <= last.line + 2 ? last : null;
      last = null;
      if (name === "HorizontalRule") {
        blocks.push({ from, to, always: true });
        return false;
      }
      if (name === "Table") {
        blocks.push({ from, to, always: true, table: true });
        figure("Table", to);
        return false;
      }
      if (name === "FencedCode") {
        const info = node.node.getChild("CodeInfo");
        const language = info ? state.sliceDoc(info.from, info.to).trim() : "";
        if (RICH_FENCE.test(language)) blocks.push({ from, to });
        if (FIGURE_FENCE.test(language)) figure("Figure", to);
        return false;
      }
      if (name === "Paragraph") {
        const source = state.sliceDoc(from, to).trim();
        if (/^\$\$[\s\S]+\$\$$/.test(source) || /^\\\[[\s\S]+\\\]$/.test(source)) blocks.push({ from, to });
        else if (onlyImages(state, node.node)) {
          blocks.push({ from, to, image: true });
          figure("Figure", to);
        } else if (follows && !source.includes("\n")) {
          const words = CAPTION.exec(source);
          if (words) {
            const n = ++count[follows.kind];
            captions.push({ at: state.doc.lineAt(from).from, label: LABELLED.test(words[2]) ? null : `${follows.kind} ${n}.` });
          }
        }
        return false;
      }
      return name === "Blockquote" || name === "BulletList" || name === "OrderedList" || name === "ListItem";
    },
  });
  const note = NOTE_DEF.exec(state.sliceDoc(Math.max(0, frontTo)));
  const notesAt = note ? state.doc.lineAt(Math.max(0, frontTo) + note.index).from : null;
  return {
    blocks: blocks.map((block) => ({ ...block, from: state.doc.lineAt(block.from).from, to: state.doc.lineAt(block.to).to })),
    captions, notesAt, frontTo,
  };
}

/** @param {EditorState} state @param {import("@lezer/common").SyntaxNode} paragraph */
function onlyImages(state, paragraph) {
  const images = paragraph.getChildren("Image");
  if (!images.length) return false;
  let rest = state.sliceDoc(paragraph.from, paragraph.to);
  for (let i = images.length - 1; i >= 0; i--) {
    const a = images[i].from - paragraph.from, b = images[i].to - paragraph.from;
    rest = rest.slice(0, a) + rest.slice(b);
  }
  return !rest.trim();
}

/** @param {CodeMirror} CM @param {BlockWidgets} widgets @returns {StateField<PageBlocks>} */
export function createBlockField({ syntaxTree, StateField, EditorView, Decoration }, widgets) {
  const { Table, Block, Image, Front, notesHead } = widgets;
  return StateField.define({
    create: (state) => blocksOf(state, syntaxTree),
    update(previous, transaction) {
      const { state, startState, docChanged } = transaction;
      return docChanged || syntaxTree(state) !== syntaxTree(startState) ? blocksOf(state, syntaxTree) : previous;
    },
    provide: (field) => EditorView.decorations.compute([field, "selection"], (state) => {
      const { blocks, captions, notesAt } = state.field(field);
      /** @type {import("@codemirror/state").Range<Decoration>[]} */
      const ranges = [];
      for (const { from, to, table, always, image, front } of blocks) {
        if (to > state.doc.length) continue;
        const source = state.sliceDoc(from, to);
        if (table) {
          ranges.push(Decoration.replace({ widget: new Table(source, from), block: true }).range(from, to));
          continue;
        }
        const editing = !always && state.selection.ranges.some((range) => range.to >= from && range.from <= to);
        if (front) {
          const inside = state.selection.ranges.some((range) => range.to > from && range.from <= to);
          if (!inside) ranges.push(Decoration.replace({ widget: new Front(front), block: true }).range(from, to));
          continue;
        }
        const Widget = image ? Image : Block;
        if (editing) ranges.push(Decoration.widget({ widget: new Widget(source, from, true), block: true, side: 1 }).range(to));
        else ranges.push(Decoration.replace({ widget: new Widget(source, from), block: true }).range(from, to));
      }
      for (const { at, label } of captions) {
        if (at > state.doc.length) continue;
        ranges.push(Decoration.line({ class: "cm-md-caption", attributes: label ? { "data-label": label } : {} }).range(at));
      }
      if (notesAt != null && notesAt <= state.doc.length) {
        ranges.push(Decoration.widget({ widget: notesHead, block: true, side: -1 }).range(notesAt));
      }
      return Decoration.set(ranges, true);
    }),
  });
}
