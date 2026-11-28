// @ts-check

/** @import {CodeMirror, EditorState, TransactionSpec} from "./cm-types.d.ts" */

/** @import {SyntaxNode} from "@lezer/common" */

/** @typedef {TransactionSpec} Spec */

/** @typedef {"body" | "h1" | "h2" | "h3" | "quote" | "ul" | "ol" | "task"} LineStyle */

/** @typedef {"bold" | "italic" | "strike" | "code"} Mark */

/** @typedef {"table" | "image" | "diagram" | "code" | "divider" | "callout" | "formula" | "contents"} BlockKind */

/** What each mark writes and the syntax node it makes. */
const MARKS = {
  bold: { text: "**", node: "StrongEmphasis", mark: "EmphasisMark" },
  italic: { text: "*", node: "Emphasis", mark: "EmphasisMark" },
  strike: { text: "~~", node: "Strikethrough", mark: "StrikethroughMark" },
  code: { text: "`", node: "InlineCode", mark: "CodeMark" },
};

const LEAD = /^(\s*)(#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d{1,9}[.)][ \t]+)?/;

/** @type {Record<Exclude<LineStyle, "ol">, string>} */
const PREFIX = { body: "", h1: "# ", h2: "## ", h3: "### ", quote: "> ", ul: "- ", task: "- [ ] " };

/** The style a line of Markdown is written in. @param {string} text @returns {LineStyle} */
export function lineStyleOf(text) {
  const lead = LEAD.exec(text)?.[2] ?? "";
  if (lead.startsWith("#")) return lead.trim().length === 1 ? "h1" : lead.trim().length === 2 ? "h2" : "h3";
  if (lead.startsWith(">")) return "quote";
  if (/\[[ xX]\]/.test(lead)) return "task";
  if (/^[-*+]/.test(lead)) return "ul";
  return lead ? "ol" : "body";
}

/** @param {EditorState} state */
function selectedLines(state) {
  /** @type {Map<number, import("@codemirror/state").Line>} */
  const lines = new Map();
  for (const r of state.selection.ranges) {
    const end = r.to > r.from && state.doc.lineAt(r.to).from === r.to ? r.to - 1 : r.to;
    for (let n = state.doc.lineAt(r.from).number; n <= state.doc.lineAt(Math.max(r.from, end)).number; n++) {
      lines.set(n, state.doc.line(n));
    }
  }
  return [...lines.values()];
}

/** Writes the selected lines in a style, or back in body text. @param {EditorState} state @param {LineStyle} style @returns {Spec} */
export function setLineStyle(state, style) {
  const all = selectedLines(state);
  const lines = all.length > 1 ? all.filter((l) => l.text.trim()) : all;
  const target = style !== "body" && lines.every((l) => lineStyleOf(l.text) === style) ? "body" : style;
  let number = 0;
  const changes = lines.map((l) => {
    const m = /** @type {RegExpExecArray} */ (LEAD.exec(l.text));
    const keep = target === "ul" || target === "ol" || target === "task" ? m[1] : "";
    const insert = keep + (target === "ol" ? `${++number}. ` : PREFIX[target]);
    return { from: l.from, to: l.from + m[0].length, insert };
  });
  return { changes, userEvent: "input.format", scrollIntoView: true };
}

/** The node of a kind around the main selection, if any. @param {CodeMirror} CM @param {EditorState} state @param {string} name */
function around(CM, state, name) {
  const { from, to } = state.selection.main;
  for (let n = /** @type {SyntaxNode | null} */ (CM.syntaxTree(state).resolveInner(from, 1)); n; n = n.parent) {
    if (n.name === name && n.from <= from && n.to >= to) return n;
  }
  return null;
}

/** The marks and link the main selection sits in. @param {CodeMirror} CM @param {EditorState} state */
export function marksAt(CM, state) {
  /** @type {Set<Mark | "link">} */
  const on = new Set();
  for (const [mark, { node }] of Object.entries(MARKS)) if (around(CM, state, node)) on.add(/** @type {Mark} */ (mark));
  if (around(CM, state, "Link")) on.add("link");
  return on;
}

/** Wraps or unwraps a mark. @param {CodeMirror} CM @param {EditorState} state @param {Mark} mark @returns {Spec} */
export function toggleMark(CM, state, mark) {
  const { text, node, mark: markNode } = MARKS[mark];
  const inside = state.selection.ranges.length === 1 ? around(CM, state, node) : null;
  if (inside) {
    const ends = inside.getChildren(markNode);
    if (ends.length >= 2) {
      const [open, close] = [ends[0], ends[ends.length - 1]];
      return { changes: [{ from: open.from, to: open.to }, { from: close.from, to: close.to }], userEvent: "input.format" };
    }
  }
  const n = text.length;
  const wrapped = (/** @type {{from: number, to: number}} */ r) =>
    state.sliceDoc(r.from - n, r.from) === text && state.sliceDoc(r.to, r.to + n) === text;
  if (!state.selection.main.empty && state.selection.ranges.every(wrapped)) {
    return {
      ...state.changeByRange((r) => ({
        changes: [{ from: r.from - n, to: r.from }, { from: r.to, to: r.to + n }],
        range: CM.EditorSelection.range(r.from - n, r.to - n),
      })),
      userEvent: "input.format",
    };
  }
  return {
    ...state.changeByRange((r) => ({
      changes: [{ from: r.from, insert: text }, { from: r.to, insert: text }],
      range: CM.EditorSelection.range(r.from + n, r.to + n),
    })),
    userEvent: "input.format", scrollIntoView: true,
  };
}

/** Links the selection or readdresses its link. @param {CodeMirror} CM @param {EditorState} state @param {string} url @returns {Spec} */
export function linkTo(CM, state, url) {
  const address = url.trim().replace(/[()\s]/g, (c) => encodeURIComponent(c));
  const link = around(CM, state, "Link");
  const target = link?.getChild("URL");
  if (target) return { changes: { from: target.from, to: target.to, insert: address }, userEvent: "input.format" };
  const { from, to } = state.selection.main;
  const words = state.sliceDoc(from, to) || address;
  const insert = `[${words}](${address})`;
  return {
    changes: { from, to, insert },
    selection: { anchor: from + 1, head: from + 1 + words.length },
    userEvent: "input.format", scrollIntoView: true,
  };
}

/** @param {string} text */
const slug = (text) => text.toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, "").trim().replace(/\s+/g, "-");

/** A nested list of links to the document's headings. @param {CodeMirror} CM @param {EditorState} state */
function contentsOf(CM, state) {
  /** @type {[number, string][]} */
  const heads = [];
  CM.syntaxTree(state).iterate({
    enter(n) {
      const h = /^ATXHeading([1-3])$/.exec(n.name);
      if (!h) return n.name === "Document";
      const words = state.sliceDoc(n.from, n.to).replace(/^#+\s*/, "").replace(/\s#+\s*$/, "").trim();
      if (words) heads.push([+h[1], words]);
      return false;
    },
  });
  if (!heads.length) return "- [Contents appear here once the document has headings](#)";
  const top = Math.min(...heads.map(([level]) => level));
  return heads.map(([level, words]) => `${"  ".repeat(level - top)}- [${words}](#${slug(words)})`).join("\n");
}

/** @param {CodeMirror} CM @param {EditorState} state @param {BlockKind} kind @returns {{text: string, select: [number, number]}} */
function blockOf(CM, state, kind) {
  /** @param {string} text @param {string} [pick] the words to select, else the caret goes to the end */
  const place = (text, pick) => {
    const at = pick ? text.indexOf(pick) : text.length;
    return { text, select: /** @type {[number, number]} */ ([at, at + (pick ? pick.length : 0)]) };
  };
  if (kind === "table") return place("| Column | Column |\n| --- | --- |\n|  |  |", "Column");
  if (kind === "image") return place("![Describe the picture](picture.png)", "picture.png");
  if (kind === "diagram") return place("```mermaid\nflowchart LR\n  A[Start] --> B[Finish]\n```", "A[Start] --> B[Finish]");
  if (kind === "code") { const t = "```\n\n```"; return { text: t, select: [4, 4] }; }
  if (kind === "divider") return place("---");
  if (kind === "callout") return place("> [!NOTE]\n> Write the note here.", "Write the note here.");
  if (kind === "formula") return place("$$\nE = mc^2\n$$", "E = mc^2");
  return place(contentsOf(CM, state));
}

/** Puts a block after the caret's line. @param {CodeMirror} CM @param {EditorState} state @param {BlockKind} kind @returns {Spec} */
export function insertBlock(CM, state, kind) {
  const { text, select } = blockOf(CM, state, kind);
  const line = state.doc.lineAt(state.selection.main.head);
  const empty = !line.text.trim();
  const before = empty ? (line.number > 1 && state.doc.line(line.number - 1).text.trim() ? "\n" : "") : "\n\n";
  const next = line.number < state.doc.lines ? state.doc.line(line.number + 1) : null;
  const after = next && !next.text.trim() ? "" : "\n";
  const from = empty ? line.from : line.to;
  const start = from + before.length;
  return {
    changes: { from, to: line.to, insert: before + text + after },
    selection: { anchor: start + select[0], head: start + select[1] },
    userEvent: "input.insert", scrollIntoView: true,
  };
}

/** Cites a new footnote and starts its note at the end. @param {EditorState} state @returns {Spec} */
export function insertFootnote(state) {
  const text = state.doc.toString();
  let n = 1;
  while (text.includes(`[^${n}]`)) n++;
  const { to } = state.selection.main;
  const end = state.doc.length;
  const gap = text.endsWith("\n\n") ? "" : text.endsWith("\n") ? "\n" : "\n\n";
  const note = `${gap}[^${n}]: `;
  const cite = `[^${n}]`;
  return {
    changes: [{ from: to, insert: cite }, { from: end, insert: note }],
    selection: { anchor: end + cite.length + note.length },
    userEvent: "input.insert", scrollIntoView: true,
  };
}

/** Today's date in place of the selection. @param {EditorState} state @param {Date} now @returns {Spec} */
export function insertDate(state, now) {
  const words = now.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
  const { from, to } = state.selection.main;
  return { changes: { from, to, insert: words }, selection: { anchor: from + words.length }, userEvent: "input.insert" };
}

const WORD = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

/** Words and characters in the document and in the selection. @param {EditorState} state */
export function countsOf(state) {
  /** @param {string} text */
  const of = (text) => ({ words: text.match(WORD)?.length ?? 0, characters: text.replace(/\n/g, "").length });
  const picked = state.selection.ranges.map((r) => state.sliceDoc(r.from, r.to)).join("\n");
  return { all: of(state.doc.toString()), selected: picked ? of(picked) : null };
}
