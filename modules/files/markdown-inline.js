// @ts-check

import { NOTE_DEF, NOTE_REF } from "./markdown-notes.js";

/** @import {CodeMirror, Decoration, EditorState, EditorView, StateField, WidgetType} from "./cm-types.d.ts" */

/** @import {Line} from "@codemirror/state" */

/** @import {SyntaxNode, SyntaxNodeRef, Tree} from "@lezer/common" */

/** @import {PageBlocks} from "./markdown-blocks.js" */

/** @import {Notes} from "./markdown-notes.js" */

/** @import {CalloutKind} from "./markdown-inline-widgets.js" */

/** @typedef {import("@codemirror/state").Range<Decoration>} DecoRange */

/** @typedef {ReturnType<typeof import("./markdown-inline-widgets.js").createInlineWidgets>} Marks */

/** @typedef {Marks & {bullet: WidgetType, MathWidget: new (src: string, from: number) => WidgetType}} InlineWidgets */

/** @typedef {ReturnType<typeof looks>} Look */

const INLINE_MATH = /(?<![\\$\w])\$(?=[^\s$])((?:\\.|[^$\\\n])*?[^\s\\$])\$(?![\w$])/g;
const HIDE_MARKS = new Set(["HeaderMark", "EmphasisMark", "StrikethroughMark", "CodeMark", "QuoteMark", "LinkMark", "URL", "LinkTitle"]);
const CALLOUT = /^(\s{0,3}>\s?)\[!(note|tip|important|warning|caution)\][+-]?[ \t]?(.*)$/i;
const CLOSING_FENCE = /^\s{0,3}(`{3,}|~{3,})\s*$/;

/** The decorations a page reuses on every pass. @param {CodeMirror["Decoration"]} Decoration @param {InlineWidgets} widgets */
function looks(Decoration, widgets) {
  /** @type {Map<string, Decoration>} */
  const lineClasses = new Map();
  return {
    Decoration,
    widgets,
    headings: [1, 2, 3, 4, 5, 6].map((n) => Decoration.line({ class: `cm-md-h cm-md-h${n}` })),
    quoteLine: Decoration.line({ class: "cm-md-quote" }),
    frontLine: Decoration.line({ class: "cm-md-frontsrc" }),
    noteLine: Decoration.line({ class: "cm-md-fn" }),
    hide: Decoration.replace({}),
    codeMark: Decoration.mark({ class: "cm-md-code" }),
    linkMark: Decoration.mark({ class: "cm-md-link" }),
    doneMark: Decoration.mark({ class: "cm-md-done" }),
    /** @param {string} cls */
    lineOf(cls) {
      let d = lineClasses.get(cls);
      if (!d) { d = Decoration.line({ class: cls }); lineClasses.set(cls, d); }
      return d;
    },
  };
}

/** One drawing of the visible page: the ranges it collects and what it knows about the document. */
class Pass {
  /** @param {Look} look @param {EditorState} state @param {Tree} tree @param {number} frontTo @param {Notes} notes */
  constructor(look, state, tree, frontTo, notes) {
    this.look = look;
    this.state = state;
    this.tree = tree;
    this.frontTo = frontTo;
    this.notes = notes;
    /** @type {DecoRange[]} */
    this.ranges = [];
    /** @type {DecoRange[]} */
    this.atomic = [];
    /** @type {Map<number, Decoration>} */
    this.lineDeco = new Map();
    this.markerFrom = -1;
    this.markerTo = -1;
  }

  /** @param {number} a @param {number} b */
  caretIn(a, b) { return this.state.selection.ranges.some((r) => r.from <= b && r.to >= a); }

  /** @param {number} a @param {number} b @param {WidgetType | null} widget */
  swap(a, b, widget) {
    const r = (widget ? this.look.Decoration.replace({ widget }) : this.look.hide).range(a, b);
    this.ranges.push(r);
    this.atomic.push(r);
  }

  /** @param {number} from @param {number} to @param {(line: Line) => Decoration} deco */
  eachLine(from, to, deco) {
    for (let p = from; p <= to;) { const l = this.state.doc.lineAt(p); this.lineDeco.set(l.from, deco(l)); p = l.to + 1; }
  }

  /** Whether a line's text at an offset sits in code. @param {Line} l @param {number} at */
  inCode(l, at) {
    const node = this.tree.resolveInner(l.from + at + 1, 1);
    return /Code/.test(node.name) || /Code/.test(node.parent?.name || "");
  }

  done() {
    for (const [at, d] of this.lineDeco) this.ranges.push(d.range(at));
    const { Decoration } = this.look;
    return { decorations: Decoration.set(this.ranges, true), atomic: Decoration.set(this.atomic, true) };
  }
}

/** A quote, or a callout whose marker becomes its label. @param {Pass} pass @param {SyntaxNodeRef} n */
function quote(pass, n) {
  const { state, look } = pass;
  const first = state.doc.lineAt(n.from), last = state.doc.lineAt(n.to);
  const callout = CALLOUT.exec(first.text);
  if (!callout) { pass.eachLine(n.from, n.to, () => look.quoteLine); return; }
  const kind = /** @type {CalloutKind} */ (callout[2].toLowerCase());

  /** @param {Line} l */
  const edge = (l) => (l.number === first.number ? " is-head" : "") + (l.number === last.number ? " is-end" : "");
  pass.eachLine(n.from, n.to, (l) => look.lineOf(`cm-md-callout is-${kind}${edge(l)}`));
  pass.markerFrom = first.from + callout[1].length;
  pass.markerTo = first.to - callout[3].length;
  pass.swap(pass.markerFrom, pass.markerTo, new look.widgets.CalloutLabel(kind, Boolean(callout[3].trim())));
}

/** Code reads as a well: its fences fold into a label until the caret reaches them. @param {Pass} pass @param {SyntaxNode} node */
function fence(pass, node) {
  const { state, look } = pass;
  const first = state.doc.lineAt(node.from), last = state.doc.lineAt(node.to);
  const closed = last.number > first.number && CLOSING_FENCE.test(last.text);

  /** @param {Line} l */
  const edge = (l) => (l.number === first.number ? " is-open" : "") + (closed && l.number === last.number ? " is-close" : "");
  pass.eachLine(node.from, node.to, (l) => look.lineOf(`cm-md-fence${edge(l)}`));
  const info = node.getChild("CodeInfo");
  if (!pass.caretIn(first.from, first.to) && first.to > first.from) {
    const language = info ? state.sliceDoc(info.from, info.to).trim() : "";
    pass.ranges.push(look.Decoration.replace({ widget: new look.widgets.CodeLabel(language) }).range(first.from, first.to));
  }
  if (closed && !pass.caretIn(last.from, last.to) && last.to > last.from) pass.ranges.push(look.hide.range(last.from, last.to));
}

/** A list's bullet, or a task's checkbox with its done text struck. @param {Pass} pass @param {SyntaxNodeRef} n */
function listMark(pass, n) {
  const { state, look } = pass;
  const space = state.sliceDoc(n.to, n.to + 1) === " " ? 1 : 0;
  if (n.name === "ListMark") {
    const t = state.sliceDoc(n.from, n.to);
    if (n.node.nextSibling?.name === "Task") pass.swap(n.from, n.to + space, null);
    else if (t === "-" || t === "*" || t === "+") pass.swap(n.from, n.to, look.widgets.bullet);
    return;
  }
  const done = /x/i.test(state.sliceDoc(n.from + 1, n.to - 1));
  pass.swap(n.from, n.to + space, new look.widgets.TaskBox(done, n.from));
  const task = n.node.parent;
  if (done && task && task.to > n.to + 1) pass.ranges.push(look.doneMark.range(n.to + 1, task.to));
}

/** Draws one syntax node; false skips its children. @param {Pass} pass @param {SyntaxNodeRef} n @returns {boolean | void} */
function markNode(pass, n) {
  const { state, look } = pass;
  const name = n.name;
  if (name === "Document") return true;
  if (n.from <= pass.frontTo || (n.from >= pass.markerFrom && n.to <= pass.markerTo)) return false;
  const h = /^(?:ATX|Setext)Heading(\d)$/.exec(name);
  if (h) pass.lineDeco.set(state.doc.lineAt(n.from).from, look.headings[+h[1] - 1]);
  else if (name === "Blockquote") quote(pass, n);
  else if (name === "FencedCode") { fence(pass, n.node); return false; }
  else if (name === "InlineCode") pass.ranges.push(look.codeMark.range(n.from, n.to));
  else if (name === "Link" || name === "LinkReference") {
    if (state.sliceDoc(n.from, n.from + 2) === "[^") return false;
    const marks = n.node.getChildren("LinkMark");
    const words = name === "Link" && marks.length >= 2 && marks[0].to < marks[1].from;
    if (words) pass.ranges.push(look.linkMark.range(marks[0].to, marks[1].from));
  } else if (name === "ListMark" || name === "TaskMarker") listMark(pass, n);
  else if (HIDE_MARKS.has(name)) {
    let end = n.to;
    if ((name === "HeaderMark" || name === "QuoteMark") && state.sliceDoc(end, end + 1) === " ") end++;
    if (end > n.from) pass.swap(n.from, end, null);
  }
}

/** Inline math, outside code: drawn, but its TeX while the caret is inside the formula. @param {Pass} pass @param {Line} l */
function maths(pass, l) {
  INLINE_MATH.lastIndex = 0;
  let m;
  while ((m = INLINE_MATH.exec(l.text))) {
    const a = l.from + m.index, b = a + m[0].length;
    if (pass.inCode(l, m.index)) continue;
    if (pass.state.selection.ranges.some((range) => (range.from > a && range.from < b) || (range.to > a && range.to < b))) continue;
    pass.ranges.push(pass.look.Decoration.replace({ widget: new pass.look.widgets.MathWidget(m[0], a) }).range(a, b));
  }
}

/** A citation becomes its number; a definition line, a numbered note. @param {Pass} pass @param {Line} l */
function footnotes(pass, l) {
  const { numbers, defs, refs } = pass.notes;
  const { NoteNumber, NoteRef } = pass.look.widgets;
  const def = NOTE_DEF.exec(l.text);
  if (def) {
    pass.lineDeco.set(l.from, pass.look.noteLine);
    const end = l.from + def[0].length;
    if (!pass.caretIn(l.from, end)) pass.swap(l.from, end, new NoteNumber(numbers.get(def[1]) ?? 0, refs.get(def[1]) ?? null));
  }
  NOTE_REF.lastIndex = 0;
  let m;
  while ((m = NOTE_REF.exec(l.text))) {
    const a = l.from + m.index, b = a + m[0].length;
    if (pass.inCode(l, m.index) || pass.caretIn(a, b)) continue;
    pass.swap(a, b, new NoteRef(numbers.get(m[1]) ?? 0, defs.get(m[1]) ?? null));
  }
}

/** @param {CodeMirror} CM @param {{widgets: InlineWidgets, blocks: StateField<PageBlocks>, notes: StateField<Notes>}} deps */
export function createInline({ Decoration, syntaxTree }, { widgets, blocks, notes }) {
  const look = looks(Decoration, widgets);

  /** @param {EditorView} view */
  return function inline(view) {
    const { state } = view;
    const { frontTo } = state.field(blocks);
    const pass = new Pass(look, state, syntaxTree(state), frontTo, state.field(notes));
    for (const { from, to } of view.visibleRanges) {
      if (frontTo >= from) pass.eachLine(from, Math.min(frontTo, to), () => look.frontLine);
      pass.tree.iterate({ from, to, enter: (n) => markNode(pass, n) });
      for (let p = from; p <= to;) {
        const l = state.doc.lineAt(p);
        p = l.to + 1;
        if (l.from <= frontTo) continue;
        if (l.text.includes("$")) maths(pass, l);
        if (l.text.includes("[^")) footnotes(pass, l);
      }
    }
    return pass.done();
  };
}
